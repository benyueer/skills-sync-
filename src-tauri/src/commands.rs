use crate::{config, skill, skill::Skill, sync, sync::SkillSyncStatus, tools::Tool};
use serde::Serialize;
use std::collections::{HashMap, HashSet};

fn resolve_skills_dir(tool: &Tool) -> std::path::PathBuf {
    let cfg = config::load();
    if let Some(custom) = cfg.custom_skills_dirs.get(tool.id()) {
        let path = std::path::PathBuf::from(custom);
        if !path.as_os_str().is_empty() {
            return path;
        }
    }
    tool.skills_dir()
}

#[tauri::command]
pub fn save_custom_dir(tool_id: String, path: String) -> Result<(), String> {
    let mut cfg = config::load();
    if path.is_empty() {
        cfg.custom_skills_dirs.remove(&tool_id);
    } else {
        cfg.custom_skills_dirs.insert(tool_id, path);
    }
    config::save(&cfg)
}

#[tauri::command]
pub fn get_skills(tool_id: String) -> Result<Vec<Skill>, String> {
    let tool = parse_tool(&tool_id)?;
    let dir = resolve_skills_dir(&tool);
    Ok(skill::discover_skills(&dir, tool.id()))
}

#[tauri::command]
pub fn get_config() -> Result<config::AppConfig, String> {
    Ok(config::load())
}

#[tauri::command]
pub fn save_config(git_repo_url: String) -> Result<(), String> {
    let mut cfg = config::load();
    cfg.git_repo_url = git_repo_url;
    config::save(&cfg)
}

#[tauri::command]
pub async fn sync_from_git() -> Result<Vec<String>, String> {
    let cfg = config::load();
    if cfg.git_repo_url.is_empty() {
        return Err("Git repo URL is not configured".to_string());
    }

    let repo_dir = sync::ensure_repo(&cfg.git_repo_url)?;
    let tools: Vec<Tool> = Tool::all().to_vec();
    let synced = sync::sync_skills(&repo_dir, &tools)?;

    // Update last sync time
    let mut cfg = config::load();
    cfg.last_sync = Some(
        chrono::Utc::now()
            .format("%Y-%m-%d %H:%M:%S UTC")
            .to_string(),
    );
    cfg.repo_local_path = repo_dir.to_string_lossy().to_string();
    config::save(&cfg)?;

    Ok(synced)
}

#[tauri::command]
pub fn compare_skills(tool_id: String) -> Result<Vec<SkillSyncStatus>, String> {
    let cfg = config::load();
    if cfg.repo_local_path.is_empty() {
        return Err("Git repo not cloned yet. Set a Git URL and sync first.".to_string());
    }

    let repo_skills_dir = std::path::PathBuf::from(&cfg.repo_local_path).join("skills");
    let tool = parse_tool(&tool_id)?;
    let agent_skills_dir = resolve_skills_dir(&tool);

    Ok(sync::compare_skill_dirs(&repo_skills_dir, &agent_skills_dir))
}

#[tauri::command]
pub fn get_skill_diff(tool_id: String, skill_name: String, repo_path: String) -> Result<HashMap<String, String>, String> {
    let tool = parse_tool(&tool_id)?;
    let agent_skill_dir = resolve_skills_dir(&tool).join(&skill_name);
    let repo_skill_dir = std::path::PathBuf::from(&repo_path);

    if !agent_skill_dir.exists() {
        return Err(format!("Agent skill directory not found: {}", agent_skill_dir.display()));
    }
    if !repo_skill_dir.exists() {
        return Err(format!("Repo skill directory not found: {}", repo_skill_dir.display()));
    }

    Ok(sync::compute_skill_diff(&agent_skill_dir, &repo_skill_dir))
}

#[tauri::command]
pub fn list_repo_skill_files(repo_path: String) -> Result<Vec<FileEntry>, String> {
    let skill_dir = std::path::PathBuf::from(&repo_path);
    if !skill_dir.exists() {
        return Err(format!("Skill directory does not exist: {}", skill_dir.display()));
    }
    build_file_tree(&skill_dir, 20)
}

#[tauri::command]
pub fn read_repo_file_content(path: String) -> Result<String, String> {
    let file_path = std::path::PathBuf::from(&path);
    let metadata = std::fs::metadata(&file_path).map_err(|e| e.to_string())?;
    if !metadata.is_file() {
        return Err(format!("Path is not a file: {}", path));
    }
    if metadata.len() > 1_048_576 {
        return Err("File is too large (>1MB)".to_string());
    }
    let bytes = std::fs::read(&file_path).map_err(|e| e.to_string())?;
    let preview = &bytes[..bytes.len().min(8192)];
    if preview.contains(&0) {
        return Err("Binary file cannot be displayed".to_string());
    }
    String::from_utf8(bytes).map_err(|e| format!("Invalid UTF-8: {}", e))
}

#[tauri::command]
pub fn open_skills_dir(tool_id: String) -> Result<(), String> {
    let tool = parse_tool(&tool_id)?;
    let dir = resolve_skills_dir(&tool);
    if !dir.exists() {
        std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    }
    opener::open(&dir).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn read_skill_file(tool_id: String, skill_name: String) -> Result<String, String> {
    let tool = parse_tool(&tool_id)?;
    let skill_md = resolve_skills_dir(&tool).join(&skill_name).join("SKILL.md");
    std::fs::read_to_string(&skill_md).map_err(|e| format!("Cannot read {}: {}", skill_md.display(), e))
}

#[tauri::command]
pub fn open_skill_with_app(tool_id: String, skill_name: String, app_path: String) -> Result<(), String> {
    let tool = parse_tool(&tool_id)?;
    let skill_md = resolve_skills_dir(&tool).join(&skill_name).join("SKILL.md");
    if !skill_md.exists() {
        return Err(format!("SKILL.md not found: {}", skill_md.display()));
    }
    let mut cmd = std::process::Command::new(&app_path);
    cmd.arg(&skill_md);
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW
    }
    cmd.spawn().map_err(|e| format!("Failed to launch {}: {}", app_path, e))?;
    Ok(())
}

#[tauri::command]
pub fn backup_skills(tool_id: String) -> Result<String, String> {
    let tool = parse_tool(&tool_id)?;
    let src = resolve_skills_dir(&tool);

    if !src.exists() {
        return Err(format!("Skills directory does not exist: {}", src.display()));
    }

    let parent = src.parent().ok_or("Cannot determine parent directory")?;
    let dir_name = src.file_name()
        .ok_or("Cannot determine directory name")?
        .to_string_lossy();

    let date_suffix = chrono::Local::now().format("%Y%m%d-%H%M%S").to_string();
    let backup_name = format!("{}-{}", dir_name, date_suffix);
    let dst = parent.join(&backup_name);

    crate::sync::copy_dir_recursive(&src, &dst)?;

    Ok(dst.to_string_lossy().to_string())
}

fn parse_tool(tool_id: &str) -> Result<Tool, String> {
    match tool_id {
        "claude-code" => Ok(Tool::ClaudeCode),
        "opencode" => Ok(Tool::OpenCode),
        "codex" => Ok(Tool::Codex),
        "hermes" => Ok(Tool::Hermes),
        _ => Err(format!("Unknown tool: {}", tool_id)),
    }
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SkillDiff {
    pub name: String,
    pub status: String,
    pub diff: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BackupDiff {
    pub backup_path: String,
    pub added: Vec<String>,
    pub deleted: Vec<String>,
    pub changed: Vec<SkillDiff>,
}

#[tauri::command]
pub fn preview_restore(tool_id: String, backup_path: String) -> Result<BackupDiff, String> {
    let tool = parse_tool(&tool_id)?;
    let current_dir = resolve_skills_dir(&tool);
    let backup_dir = std::path::PathBuf::from(&backup_path);

    if !backup_dir.exists() {
        return Err(format!("Backup directory does not exist: {}", backup_path));
    }

    let current_skills = crate::skill::discover_skills(&current_dir, tool.id());
    let backup_skills = crate::skill::discover_skills(&backup_dir, tool.id());

    let current_names: HashSet<String> =
        current_skills.iter().map(|s| s.name.clone()).collect();
    let backup_names: HashSet<String> =
        backup_skills.iter().map(|s| s.name.clone()).collect();

    let mut added: Vec<String> = backup_names.difference(&current_names).cloned().collect();
    added.sort();
    let mut deleted: Vec<String> = current_names.difference(&backup_names).cloned().collect();
    deleted.sort();

    let mut changed = Vec::new();
    for name in current_names.intersection(&backup_names) {
        let current_md = current_dir.join(name).join("SKILL.md");
        let backup_md = backup_dir.join(name).join("SKILL.md");

        let current_content = std::fs::read_to_string(&current_md).unwrap_or_default();
        let backup_content = std::fs::read_to_string(&backup_md).unwrap_or_default();

        if current_content != backup_content {
            let diff = sync::compute_diff(&current_content, &backup_content);
            changed.push(SkillDiff {
                name: name.clone(),
                status: "changed".to_string(),
                diff,
            });
        }
    }

    Ok(BackupDiff {
        backup_path,
        added,
        deleted,
        changed,
    })
}

#[tauri::command]
pub fn execute_restore(tool_id: String, backup_path: String) -> Result<Vec<String>, String> {
    let tool = parse_tool(&tool_id)?;
    let current_dir = resolve_skills_dir(&tool);
    let backup_dir = std::path::PathBuf::from(&backup_path);

    if !backup_dir.exists() {
        return Err(format!("Backup directory does not exist: {}", backup_path));
    }

    let preview = preview_restore(tool_id.clone(), backup_path)?;

    let mut actions = Vec::new();

    // Delete skills not in backup
    for name in &preview.deleted {
        let skill_dir = current_dir.join(name);
        if skill_dir.exists() {
            std::fs::remove_dir_all(&skill_dir)
                .map_err(|e| format!("Failed to delete {}: {}", name, e))?;
            actions.push(format!("deleted: {}", name));
        }
    }

    // Copy skills from backup (both new and changed)
    for name in preview.added.iter().chain(preview.changed.iter().map(|d| &d.name)) {
        let src = backup_dir.join(name);
        let dst = current_dir.join(name);
        crate::sync::copy_dir_recursive(&src, &dst)?;
        if preview.added.contains(name) {
            actions.push(format!("added: {}", name));
        } else {
            actions.push(format!("updated: {}", name));
        }
    }

    Ok(actions)
}

#[tauri::command]
pub fn save_window_state(width: u32, height: u32, x: i32, y: i32) -> Result<(), String> {
    let mut cfg = config::load();
    cfg.window_width = width;
    cfg.window_height = height;
    cfg.window_x = Some(x);
    cfg.window_y = Some(y);
    config::save(&cfg)
}

#[tauri::command]
pub fn save_dark_mode(dark: bool) -> Result<(), String> {
    let mut cfg = config::load();
    cfg.dark_mode = dark;
    config::save(&cfg)
}

#[tauri::command]
pub fn save_active_tab(tab: String) -> Result<(), String> {
    let mut cfg = config::load();
    cfg.last_active_tab = tab;
    config::save(&cfg)
}

#[tauri::command]
pub fn git_status() -> Result<String, String> {
    let cfg = config::load();
    if cfg.repo_local_path.is_empty() {
        return Err("No repo cloned yet. Set a Git URL and sync first.".to_string());
    }
    let repo_dir = std::path::PathBuf::from(&cfg.repo_local_path);
    sync::git_status(&repo_dir)
}

#[tauri::command]
pub fn git_pull() -> Result<String, String> {
    let cfg = config::load();
    if cfg.git_repo_url.is_empty() {
        return Err("Git repo URL is not configured".to_string());
    }
    let repo_dir = sync::ensure_repo(&cfg.git_repo_url)?;
    let mut cfg = config::load();
    cfg.repo_local_path = repo_dir.to_string_lossy().to_string();
    config::save(&cfg)?;
    sync::git_pull(&repo_dir)
}

#[tauri::command]
pub fn get_repo_skills() -> Result<Vec<crate::skill::Skill>, String> {
    let cfg = config::load();
    if cfg.repo_local_path.is_empty() {
        return Err("No repo cloned yet. Set a Git URL and sync first.".to_string());
    }
    let repo_dir = std::path::PathBuf::from(&cfg.repo_local_path);
    let skill_dirs = sync::find_skill_dirs(&repo_dir);
    let mut skills = Vec::new();
    for dir in skill_dirs {
        if let Some(skill) = crate::skill::parse_skill(&dir, "repo") {
            skills.push(skill);
        }
    }
    skills.sort_by(|a, b| a.name.cmp(&b.name));
    Ok(skills)
}

#[tauri::command]
pub fn open_repo_dir() -> Result<(), String> {
    let cfg = config::load();
    if cfg.repo_local_path.is_empty() {
        return Err("No repo cloned yet. Set a Git URL and sync first.".to_string());
    }
    let repo_dir = std::path::PathBuf::from(&cfg.repo_local_path);
    if !repo_dir.exists() {
        return Err(format!("Repo directory does not exist: {}", repo_dir.display()));
    }
    opener::open(&repo_dir).map_err(|e| format!("Failed to open repo dir: {}", e))?;
    Ok(())
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FileEntry {
    pub name: String,
    pub path: String,
    pub is_directory: bool,
    pub children: Option<Vec<FileEntry>>,
}

#[tauri::command]
pub fn list_skill_files(tool_id: String, skill_name: String) -> Result<Vec<FileEntry>, String> {
    let tool = parse_tool(&tool_id)?;
    let skill_dir = resolve_skills_dir(&tool).join(&skill_name);

    if !skill_dir.exists() {
        return Err(format!("Skill directory does not exist: {}", skill_dir.display()));
    }

    build_file_tree(&skill_dir, 20)
}

#[tauri::command]
pub fn read_file_content(tool_id: String, path: String) -> Result<String, String> {
    let tool = parse_tool(&tool_id)?;
    let skills_root = resolve_skills_dir(&tool);
    let file_path = std::path::PathBuf::from(&path);

    // Normalize path by removing \\?\ prefix on Windows
    fn normalize_path(p: &std::path::Path) -> String {
        let s = p.to_string_lossy().to_string();
        if s.starts_with(r"\\?\") {
            s[4..].to_string()
        } else {
            s
        }
    }

    // Check if the path is within the skills directory
    let root_str = normalize_path(&skills_root);
    let path_str = normalize_path(&file_path);

    if !path_str.starts_with(&root_str) {
        return Err(format!("Access denied: path outside skills directory. Root: {}, Path: {}", root_str, path_str));
    }

    // Use the original path for file operations
    let read_path = std::path::PathBuf::from(&path_str);

    // Check file metadata (limit to 1MB)
    let metadata = std::fs::metadata(&read_path).map_err(|e| e.to_string())?;
    if !metadata.is_file() {
        return Err(format!("Path is not a file: {}", path));
    }
    if metadata.len() > 1_048_576 {
        return Err("File is too large (>1MB)".to_string());
    }

    // Check if file is binary by reading first 8KB
    let bytes = std::fs::read(&read_path).map_err(|e| e.to_string())?;
    let preview = &bytes[..bytes.len().min(8192)];
    if preview.contains(&0) {
        return Err("Binary file cannot be displayed".to_string());
    }

    String::from_utf8(bytes).map_err(|e| format!("Invalid UTF-8: {}", e))
}

fn build_file_tree(dir: &std::path::Path, max_depth: u32) -> Result<Vec<FileEntry>, String> {
    if max_depth == 0 {
        return Ok(Vec::new());
    }

    let mut entries = Vec::new();

    let read_dir = std::fs::read_dir(dir)
        .map_err(|e| format!("Failed to read directory {}: {}", dir.display(), e))?;

    for entry in read_dir.flatten() {
        let path = entry.path();
        let name = path.file_name()
            .unwrap_or_default()
            .to_string_lossy()
            .to_string();

        let is_directory = path.is_dir();
        let children = if is_directory {
            Some(build_file_tree(&path, max_depth - 1)?)
        } else {
            None
        };

        entries.push(FileEntry {
            name,
            path: path.to_string_lossy().to_string(),
            is_directory,
            children,
        });
    }

    entries.sort_by(|a, b| {
        // Directories first, then files
        if a.is_directory && !b.is_directory {
            std::cmp::Ordering::Less
        } else if !a.is_directory && b.is_directory {
            std::cmp::Ordering::Greater
        } else {
            a.name.cmp(&b.name)
        }
    });

    Ok(entries)
}

#[tauri::command]
pub fn reveal_path(path: String) -> Result<(), String> {
    opener::reveal(&path).map_err(|e| format!("Failed to open path: {}", e))?;
    Ok(())
}
