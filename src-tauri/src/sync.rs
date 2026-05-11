use crate::tools::Tool;
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

fn find_skill_dirs(repo_dir: &Path) -> Vec<PathBuf> {
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

fn copy_dir_recursive(src: &Path, dst: &Path) -> Result<(), String> {
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
