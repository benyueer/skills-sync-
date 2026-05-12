use crate::tools::Tool;
use std::collections::BTreeMap;
use std::path::{Path, PathBuf};

/// Clone or pull the git repo. Returns the local path.
pub fn ensure_repo(git_url: &str) -> Result<PathBuf, String> {
    let repo_dir = repo_local_path(git_url);

    if repo_dir.join(".git").exists() {
        run_git(&repo_dir, &["pull", "--ff-only"])?;
    } else {
        if repo_dir.exists() {
            std::fs::remove_dir_all(&repo_dir).map_err(|e| e.to_string())?;
        }
        let parent = repo_dir.parent().ok_or("Invalid repo path")?;
        std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
        run_git(parent, &["clone", git_url, &repo_dir.to_string_lossy()])?;
    }

    Ok(repo_dir)
}

/// Sync skills from repo to each tool's skills directory.
pub fn sync_skills(repo_dir: &Path, tools: &[Tool]) -> Result<Vec<String>, String> {
    let mut synced = Vec::new();
    let skill_dirs = find_skill_dirs(repo_dir);

    for tool in tools {
        let target_dir = tool.skills_dir();
        std::fs::create_dir_all(&target_dir).map_err(|e| e.to_string())?;

        for skill_dir in &skill_dirs {
            let skill_name = skill_dir
                .file_name()
                .unwrap_or_default()
                .to_string_lossy()
                .to_string();
            let target = target_dir.join(&skill_name);
            copy_dir_recursive(skill_dir, &target)?;
            synced.push(format!("{}/{}", tool.id(), skill_name));
        }
    }

    Ok(synced)
}

pub fn find_skill_dirs(repo_dir: &Path) -> Vec<PathBuf> {
    let mut dirs = Vec::new();
    find_skill_dirs_recursive(repo_dir, &mut dirs, 0);
    dirs
}

fn find_skill_dirs_recursive(dir: &Path, results: &mut Vec<PathBuf>, depth: u32) {
    if depth > 5 {
        return;
    }
    if let Ok(entries) = std::fs::read_dir(dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_dir() {
                if path.join("SKILL.md").exists() {
                    results.push(path);
                } else {
                    find_skill_dirs_recursive(&path, results, depth + 1);
                }
            }
        }
    }
}

pub fn copy_dir_recursive(src: &Path, dst: &Path) -> Result<(), String> {
    if dst.exists() {
        std::fs::remove_dir_all(dst).map_err(|e| format!("rm {}: {}", dst.display(), e))?;
    }
    std::fs::create_dir_all(dst).map_err(|e| e.to_string())?;

    for entry in walkdir::WalkDir::new(src) {
        let entry = entry.map_err(|e| e.to_string())?;
        let rel = entry.path().strip_prefix(src).unwrap();
        let target = dst.join(rel);
        if entry.file_type().is_dir() {
            std::fs::create_dir_all(&target).map_err(|e| e.to_string())?;
        } else {
            std::fs::copy(entry.path(), &target).map_err(|e| e.to_string())?;
        }
    }
    Ok(())
}

fn repo_local_path(git_url: &str) -> PathBuf {
    let data_dir = dirs::data_dir()
        .expect("Cannot determine data directory")
        .join("skills-sync")
        .join("repos");
    let hash = {
        use std::collections::hash_map::DefaultHasher;
        use std::hash::{Hash, Hasher};
        let mut h = DefaultHasher::new();
        git_url.hash(&mut h);
        format!("{:x}", h.finish())
    };
    data_dir.join(hash)
}

fn run_git(dir: &Path, args: &[&str]) -> Result<String, String> {
    let mut cmd = std::process::Command::new("git");
    cmd.current_dir(dir).args(args);

    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        cmd.creation_flags(0x08000000);
    }

    let output = cmd.output().map_err(|e| format!("git error: {}", e))?;
    if output.status.success() {
        Ok(String::from_utf8_lossy(&output.stdout).to_string())
    } else {
        Err(String::from_utf8_lossy(&output.stderr).to_string())
    }
}

/// Get git status of the repo at the given path.
pub fn git_status(repo_dir: &Path) -> Result<String, String> {
    if !repo_dir.join(".git").exists() {
        return Err("Not a git repository".to_string());
    }
    run_git(repo_dir, &["status", "--short"])
}

/// Pull latest changes from remote.
pub fn git_pull(repo_dir: &Path) -> Result<String, String> {
    if !repo_dir.join(".git").exists() {
        return Err("Not a git repository".to_string());
    }
    run_git(repo_dir, &["pull", "--ff-only"])
}

/// Stage all changes (git add -A).
pub fn git_add(repo_dir: &Path) -> Result<String, String> {
    if !repo_dir.join(".git").exists() {
        return Err("Not a git repository".to_string());
    }
    run_git(repo_dir, &["add", "-A"])
}

/// Commit staged changes with the given message.
pub fn git_commit(repo_dir: &Path, message: &str) -> Result<String, String> {
    if !repo_dir.join(".git").exists() {
        return Err("Not a git repository".to_string());
    }
    run_git(repo_dir, &["commit", "-m", message])
}

/// Abort an in-progress merge.
pub fn git_merge_abort(repo_dir: &Path) -> Result<String, String> {
    if !repo_dir.join(".git").exists() {
        return Err("Not a git repository".to_string());
    }
    run_git(repo_dir, &["merge", "--abort"])
}

/// Resolve conflicts by keeping our version.
pub fn git_resolve_ours(repo_dir: &Path) -> Result<String, String> {
    if !repo_dir.join(".git").exists() {
        return Err("Not a git repository".to_string());
    }
    run_git(repo_dir, &["checkout", "--ours", "."])?;
    run_git(repo_dir, &["add", "-A"])?;
    Ok("Resolved: kept our version".to_string())
}

/// Resolve conflicts by keeping their version.
pub fn git_resolve_theirs(repo_dir: &Path) -> Result<String, String> {
    if !repo_dir.join(".git").exists() {
        return Err("Not a git repository".to_string());
    }
    run_git(repo_dir, &["checkout", "--theirs", "."])?;
    run_git(repo_dir, &["add", "-A"])?;
    Ok("Resolved: kept their version".to_string())
}

/// Push committed changes to the remote.
pub fn git_push(repo_dir: &Path) -> Result<String, String> {
    if !repo_dir.join(".git").exists() {
        return Err("Not a git repository".to_string());
    }
    run_git(repo_dir, &["push"])
}

/// Collect all files in a skill directory as relative_path -> content bytes.
fn collect_skill_files(skill_dir: &std::path::Path) -> BTreeMap<String, Vec<u8>> {
    let mut files = BTreeMap::new();
    for entry in walkdir::WalkDir::new(skill_dir) {
        let Ok(entry) = entry else { continue };
        if !entry.file_type().is_file() {
            continue;
        }
        let rel = entry
            .path()
            .strip_prefix(skill_dir)
            .unwrap_or(entry.path())
            .to_string_lossy()
            .to_string();
        if let Ok(content) = std::fs::read(entry.path()) {
            files.insert(rel, content);
        }
    }
    files
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SkillSyncStatus {
    pub name: String,
    pub status: String, // "identical" | "agent-only" | "repo-only" | "different"
    pub repo_path: Option<std::path::PathBuf>,
    pub agent_path: Option<std::path::PathBuf>,
}

/// Compare skills in repo_dir/skills/ against agent's skills_dir.
/// Returns a list of SkillSyncStatus for every skill found in either location.
pub fn compare_skill_dirs(
    repo_skills_dir: &std::path::Path,
    agent_skills_dir: &std::path::Path,
) -> Vec<SkillSyncStatus> {
    let repo_skills = if repo_skills_dir.exists() {
        crate::skill::discover_skills(repo_skills_dir, "repo")
    } else {
        Vec::new()
    };
    let agent_skills = crate::skill::discover_skills(agent_skills_dir, "agent");

    let repo_map: std::collections::HashMap<String, &crate::skill::Skill> = repo_skills
        .iter()
        .map(|s| (s.name.clone(), s))
        .collect();
    let agent_map: std::collections::HashMap<String, &crate::skill::Skill> = agent_skills
        .iter()
        .map(|s| (s.name.clone(), s))
        .collect();

    let mut all_names: std::collections::HashSet<String> = std::collections::HashSet::new();
    all_names.extend(repo_map.keys().cloned());
    all_names.extend(agent_map.keys().cloned());

    let mut result: Vec<SkillSyncStatus> = all_names
        .into_iter()
        .map(|name| {
            let in_repo = repo_map.get(&name);
            let in_agent = agent_map.get(&name);

            let status = match (in_repo, in_agent) {
                (Some(repo_skill), Some(agent_skill)) => {
                    let repo_files = collect_skill_files(&repo_skill.path);
                    let agent_files = collect_skill_files(&agent_skill.path);
                    if repo_files == agent_files {
                        "identical"
                    } else {
                        "different"
                    }
                }
                (Some(_), None) => "repo-only",
                (None, Some(_)) => "agent-only",
                (None, None) => unreachable!(),
            };

            SkillSyncStatus {
                name: name.clone(),
                status: status.to_string(),
                repo_path: in_repo.map(|s| s.path.clone()),
                agent_path: in_agent.map(|s| s.path.clone()),
            }
        })
        .collect();

    result.sort_by(|a, b| a.name.cmp(&b.name));
    result
}

/// Compute a unified diff between agent's skill files and repo's skill files.
/// Returns a map of relative_file_path -> diff_string.
pub fn compute_skill_diff(
    agent_skill_dir: &std::path::Path,
    repo_skill_dir: &std::path::Path,
) -> std::collections::HashMap<String, String> {
    let agent_files = collect_skill_files(agent_skill_dir);
    let repo_files = collect_skill_files(repo_skill_dir);

    let mut all_files: std::collections::HashSet<String> = std::collections::HashSet::new();
    all_files.extend(agent_files.keys().cloned());
    all_files.extend(repo_files.keys().cloned());

    let mut diffs = std::collections::HashMap::new();

    for file in all_files {
        let agent_content = agent_files.get(&file).map(|b| String::from_utf8_lossy(b).to_string());
        let repo_content = repo_files.get(&file).map(|b| String::from_utf8_lossy(b).to_string());

        let diff = match (&agent_content, &repo_content) {
            (Some(a), Some(r)) if a == r => continue, // identical, skip
            (Some(a), Some(r)) => compute_diff(a, r),
            (Some(a), None) => {
                a.lines().map(|l| format!("-{}", l)).collect::<Vec<_>>().join("\n")
            }
            (None, Some(r)) => {
                r.lines().map(|l| format!("+{}", l)).collect::<Vec<_>>().join("\n")
            }
            (None, None) => continue,
        };
        diffs.insert(file, diff);
    }

    diffs
}

pub fn compute_diff(current: &str, backup: &str) -> String {
    let current_lines: Vec<&str> = current.lines().collect();
    let backup_lines: Vec<&str> = backup.lines().collect();

    let mut result = String::new();
    let max_len = current_lines.len().max(backup_lines.len());

    for i in 0..max_len {
        match (current_lines.get(i), backup_lines.get(i)) {
            (Some(a), Some(b)) if a == b => {
                result.push_str(&format!(" {}\n", a));
            }
            (Some(a), Some(b)) => {
                result.push_str(&format!("-{}\n", a));
                result.push_str(&format!("+{}\n", b));
            }
            (Some(a), None) => {
                result.push_str(&format!("-{}\n", a));
            }
            (None, Some(b)) => {
                result.push_str(&format!("+{}\n", b));
            }
            (None, None) => {}
        }
    }

    result
}

/// Compute structured diff content (old/new) for each file in a skill.
/// Returns a map of relative_file_path -> (old_content, new_content).
/// Either may be None if the file only exists in one side.
pub fn compute_skill_diff_content(
    agent_skill_dir: &std::path::Path,
    repo_skill_dir: &std::path::Path,
) -> std::collections::HashMap<String, (Option<String>, Option<String>)> {
    let agent_files = collect_skill_files(agent_skill_dir);
    let repo_files = collect_skill_files(repo_skill_dir);

    let mut all_files: std::collections::HashSet<String> = std::collections::HashSet::new();
    all_files.extend(agent_files.keys().cloned());
    all_files.extend(repo_files.keys().cloned());

    let mut diffs = std::collections::HashMap::new();

    for file in all_files {
        let agent_content = agent_files.get(&file).map(|b| String::from_utf8_lossy(b).to_string());
        let repo_content = repo_files.get(&file).map(|b| String::from_utf8_lossy(b).to_string());

        // Skip identical files
        if agent_content == repo_content {
            continue;
        }

        diffs.insert(file, (agent_content, repo_content));
    }

    diffs
}
