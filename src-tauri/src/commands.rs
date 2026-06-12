use crate::{config, skill, skill::Skill, tools::Tool};
use serde::Serialize;
use std::collections::{HashMap, HashSet};
use std::path::Path;
use std::io::{Read, Write};
use std::sync::Mutex;
use tauri::Emitter;

static ACTIVE_PROCESS: Mutex<Option<std::process::Child>> = Mutex::new(None);

fn expand_tilde(path_str: &str) -> std::path::PathBuf {
    if path_str.starts_with('~') {
        if let Some(home) = dirs::home_dir() {
            if path_str == "~" {
                return home;
            }
            if path_str.starts_with("~/") || path_str.starts_with(r"~\") {
                return home.join(&path_str[2..]);
            }
            return home.join(&path_str[1..]);
        }
    }
    std::path::PathBuf::from(path_str)
}

fn resolve_skills_dir(tool: &Tool) -> std::path::PathBuf {
    if let Tool::Central = tool {
        let cfg = config::load();
        let base = expand_tilde(&cfg.central_skills_dir);
        let skills_sub = base.join("skills");
        if skills_sub.exists() && skills_sub.is_dir() {
            return skills_sub;
        }
        return base;
    }
    let cfg = config::load();
    if let Some(custom) = cfg.custom_skills_dirs.get(tool.id()) {
        let path = expand_tilde(custom);
        if !path.as_os_str().is_empty() {
            return path;
        }
    }
    tool.skills_dir()
}

fn discover_central_skills() -> Vec<Skill> {
    let cfg = config::load();
    if cfg.central_skills_dir.is_empty() {
        return Vec::new();
    }
    let base = expand_tilde(&cfg.central_skills_dir);
    let central_skills_root = resolve_skills_dir(&Tool::Central);

    let mut search_dirs = Vec::new();
    if central_skills_root.exists() {
        search_dirs.push(central_skills_root.clone());
    }

    let hidden_dirs = vec![
        base.join(".claude").join("skills"),
        base.join(".gemini").join("skills"),
        base.join(".agents").join("skills"),
        base.join(".antigravity").join("skills"),
        base.join(".hermes").join("skills"),
    ];

    for path in hidden_dirs {
        if path.exists() && path.is_dir() {
            search_dirs.push(path);
        }
    }

    for (_, custom_path) in &cfg.custom_skills_dirs {
        if !custom_path.is_empty() {
            search_dirs.push(expand_tilde(custom_path));
        }
    }

    let mut skills_map: HashMap<String, Skill> = HashMap::new();

    for dir in search_dirs {
        let list = skill::discover_skills(&dir, "central");
        for s in list {
            if let Ok(meta) = std::fs::symlink_metadata(&s.path) {
                if meta.file_type().is_symlink() {
                    continue;
                }
            } else {
                continue;
            }

            let in_central_skills_root = s.path.starts_with(&central_skills_root);
            if !skills_map.contains_key(&s.name) || in_central_skills_root {
                skills_map.insert(s.name.clone(), s);
            }
        }
    }

    let mut result: Vec<Skill> = skills_map.into_values().collect();
    result.sort_by(|a, b| a.name.cmp(&b.name));
    result
}

fn find_skill_physical_path(skill_name: &str) -> Option<std::path::PathBuf> {
    let cfg = config::load();
    if cfg.central_skills_dir.is_empty() {
        return None;
    }
    let base = expand_tilde(&cfg.central_skills_dir);
    let central_skills_root = resolve_skills_dir(&Tool::Central);

    let mut search_dirs = Vec::new();
    if central_skills_root.exists() {
        search_dirs.push(central_skills_root);
    }

    let hidden_dirs = vec![
        base.join(".claude").join("skills"),
        base.join(".gemini").join("skills"),
        base.join(".agents").join("skills"),
        base.join(".antigravity").join("skills"),
        base.join(".hermes").join("skills"),
    ];

    for path in hidden_dirs {
        if path.exists() && path.is_dir() {
            search_dirs.push(path);
        }
    }

    for (_, custom_path) in &cfg.custom_skills_dirs {
        if !custom_path.is_empty() {
            search_dirs.push(expand_tilde(custom_path));
        }
    }

    for dir in search_dirs {
        let p = dir.join(skill_name);
        if p.exists() && p.is_dir() {
            if let Ok(meta) = std::fs::symlink_metadata(&p) {
                if !meta.file_type().is_symlink() {
                    return Some(p);
                }
            }
        }
    }

    None
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
    if let Tool::Central = tool {
        return Ok(discover_central_skills());
    }
    let dir = resolve_skills_dir(&tool);
    Ok(skill::discover_skills(&dir, tool.id()))
}

#[tauri::command]
pub fn get_config() -> Result<config::AppConfig, String> {
    Ok(config::load())
}

#[tauri::command]
pub fn save_config(central_skills_dir: String) -> Result<(), String> {
    let mut cfg = config::load();
    cfg.central_skills_dir = central_skills_dir;
    config::save(&cfg)
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
pub fn open_central_dir() -> Result<(), String> {
    let cfg = config::load();
    if cfg.central_skills_dir.is_empty() {
        return Err("Central skills directory is not configured".to_string());
    }
    let dir = resolve_skills_dir(&Tool::Central);
    if !dir.exists() {
        return Err(format!("Central skills directory does not exist: {}", dir.display()));
    }
    opener::open(&dir).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn open_agent_dir(tool_id: String) -> Result<(), String> {
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
        "antigravity" => Ok(Tool::Antigravity),
        "hermes" => Ok(Tool::Hermes),
        "central" => Ok(Tool::Central),
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
            let diff = compute_diff(&current_content, &backup_content);
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
            let meta = std::fs::symlink_metadata(&skill_dir).map_err(|e| e.to_string())?;
            if meta.file_type().is_symlink() {
                remove_symlink_or_junction(&skill_dir)?;
            } else {
                std::fs::remove_dir_all(&skill_dir)
                    .map_err(|e| format!("Failed to delete {}: {}", name, e))?;
            }
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

// ── 单向控制软链接管理命令 ──

#[tauri::command]
pub fn get_skills_distribution_status() -> Result<HashMap<String, HashMap<String, String>>, String> {
    let cfg = config::load();
    if cfg.central_skills_dir.is_empty() {
        return Ok(HashMap::new());
    }
    let central_dir = resolve_skills_dir(&Tool::Central);
    if !central_dir.exists() {
        return Ok(HashMap::new());
    }

    let central_skills = discover_central_skills();
    let tools = Tool::all();

    let mut distribution = HashMap::new();

    for skill in central_skills {
        let mut status_map = HashMap::new();
        for tool in tools {
            let agent_skills_dir = resolve_skills_dir(tool);
            let link_path = agent_skills_dir.join(&skill.name);

            // If this agent's folder is the physical home of this skill, mark as linked
            let is_physical_host = link_path.canonicalize().unwrap_or_else(|_| link_path.clone())
                == skill.path.canonicalize().unwrap_or_else(|_| skill.path.clone());

            let status = if is_physical_host {
                "linked".to_string()
            } else if !link_path.exists() {
                // If it is a broken symlink, exists() might return false.
                // We should check symlink_metadata to verify if a broken symlink actually exists.
                if let Ok(meta) = std::fs::symlink_metadata(&link_path) {
                    if meta.file_type().is_symlink() {
                        "linked".to_string()
                    } else {
                        "unlinked".to_string()
                    }
                } else {
                    "unlinked".to_string()
                }
            } else {
                match std::fs::symlink_metadata(&link_path) {
                    Ok(meta) => {
                        if meta.file_type().is_symlink() {
                            // Verify target matches
                            match std::fs::read_link(&link_path) {
                                Ok(target) => {
                                    // Normalize target path to check
                                    let target_normalized = target.canonicalize().unwrap_or(target);
                                    let skill_physical_normalized = skill.path.canonicalize().unwrap_or_else(|_| skill.path.clone());
                                    if target_normalized == skill_physical_normalized {
                                        "linked".to_string()
                                    } else {
                                        "conflict".to_string()
                                    }
                                }
                                Err(_) => "linked".to_string(), // broken symlink is still a link we manage
                            }
                        } else {
                            "conflict".to_string() // regular directory exists
                        }
                    }
                    Err(_) => "unlinked".to_string(),
                }
            };
            status_map.insert(tool.id().to_string(), status);
        }
        distribution.insert(skill.name, status_map);
    }

    Ok(distribution)
}

#[tauri::command]
pub fn link_skill_to_agent(tool_id: String, skill_name: String) -> Result<(), String> {
    let cfg = config::load();
    if cfg.central_skills_dir.is_empty() {
        return Err("Central skills directory is not configured".to_string());
    }
    let tool = parse_tool(&tool_id)?;
    let agent_dir = resolve_skills_dir(&tool);
    if !agent_dir.exists() {
        std::fs::create_dir_all(&agent_dir).map_err(|e| e.to_string())?;
    }

    let central_skill_path = find_skill_physical_path(&skill_name).unwrap_or_else(|| {
        let central_dir = resolve_skills_dir(&Tool::Central);
        central_dir.join(&skill_name)
    });
    if !central_skill_path.exists() {
        return Err(format!("Skill '{}' not found in central directory", skill_name));
    }

    let link_path = agent_dir.join(&skill_name);
    if link_path.exists() {
        let meta = std::fs::symlink_metadata(&link_path).map_err(|e| e.to_string())?;
        if meta.file_type().is_symlink() {
            remove_symlink_or_junction(&link_path)?;
        } else {
            return Err("Conflict: A regular folder with this skill name already exists on Agent side".to_string());
        }
    }

    create_symlink(&central_skill_path, &link_path)?;
    Ok(())
}

#[tauri::command]
pub fn unlink_skill_from_agent(tool_id: String, skill_name: String) -> Result<(), String> {
    let tool = parse_tool(&tool_id)?;
    let agent_dir = resolve_skills_dir(&tool);
    let link_path = agent_dir.join(&skill_name);

    let meta = std::fs::symlink_metadata(&link_path).map_err(|e| format!("Skill link not found: {}", e))?;
    if meta.file_type().is_symlink() {
        remove_symlink_or_junction(&link_path)?;
    } else {
        return Err("Cannot unlink: This is a regular folder, not a managed link".to_string());
    }
    Ok(())
}

#[tauri::command]
pub fn create_central_skill(skill_name: String, description: String) -> Result<(), String> {
    let cfg = config::load();
    if cfg.central_skills_dir.is_empty() {
        return Err("Central skills directory is not configured".to_string());
    }

    // Normalize skill_name to be file-friendly
    let normalized_name = skill_name
        .trim()
        .replace(|c: char| !c.is_alphanumeric() && c != '-' && c != '_', "-");
    
    if normalized_name.is_empty() {
        return Err("Invalid skill name".to_string());
    }

    let central_dir = resolve_skills_dir(&Tool::Central);
    let skill_path = central_dir.join(&normalized_name);
    if skill_path.exists() {
        return Err(format!("Skill directory already exists: {}", normalized_name));
    }

    std::fs::create_dir_all(&skill_path).map_err(|e| e.to_string())?;

    let skill_md_path = skill_path.join("SKILL.md");
    let content = format!(
        "---\nname: {}\ndescription: {}\n---\n\n# {}\n\n{}",
        normalized_name, description, normalized_name, description
    );
    std::fs::write(&skill_md_path, content).map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub fn delete_central_skill(skill_name: String) -> Result<(), String> {
    let cfg = config::load();
    if cfg.central_skills_dir.is_empty() {
        return Err("Central skills directory is not configured".to_string());
    }

    let skill_path = find_skill_physical_path(&skill_name).unwrap_or_else(|| {
        let central_skills_root = resolve_skills_dir(&Tool::Central);
        central_skills_root.join(&skill_name)
    });
    if !skill_path.exists() {
        return Err("Skill not found in central directory".to_string());
    }

    // First delete the actual skill folder
    std::fs::remove_dir_all(&skill_path).map_err(|e| e.to_string())?;

    // Secondly, clean up broken links in all agent directories to prevent dangling files
    let tools = Tool::all();
    for tool in tools {
        let agent_dir = resolve_skills_dir(tool);
        let link_path = agent_dir.join(&skill_name);
        
        // Use symlink_metadata to catch broken links
        if let Ok(meta) = std::fs::symlink_metadata(&link_path) {
            if meta.file_type().is_symlink() {
                let _ = remove_symlink_or_junction(&link_path);
            }
        }
    }

    Ok(())
}

#[tauri::command]
pub fn link_all_skills_to_agent(tool_id: String) -> Result<(), String> {
    let cfg = config::load();
    if cfg.central_skills_dir.is_empty() {
        return Err("Central skills directory is not configured".to_string());
    }

    let central_skills = discover_central_skills();

    for skill in central_skills {
        let _ = link_skill_to_agent(tool_id.clone(), skill.name);
    }

    Ok(())
}

#[tauri::command]
pub fn unlink_all_skills_from_agent(tool_id: String) -> Result<(), String> {
    let tool = parse_tool(&tool_id)?;
    let agent_dir = resolve_skills_dir(&tool);
    if !agent_dir.exists() {
        return Ok(());
    }

    if let Ok(entries) = std::fs::read_dir(&agent_dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_dir() {
                if let Ok(meta) = std::fs::symlink_metadata(&path) {
                    if meta.file_type().is_symlink() {
                        let name = path.file_name().unwrap_or_default().to_string_lossy().to_string();
                        let _ = unlink_skill_from_agent(tool_id.clone(), name);
                    }
                }
            }
        }
    }

    Ok(())
}

// ── 软链接/Junction 兼容处理辅助函数 ──

fn create_symlink(target: &Path, link: &Path) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        let mut cmd = std::process::Command::new("cmd");
        cmd.arg("/C")
           .arg("mklink")
           .arg("/J")
           .arg(link.to_string_lossy().to_string())
           .arg(target.to_string_lossy().to_string());
        
        use std::os::windows::process::CommandExt;
        cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW
        
        let output = cmd.output().map_err(|e| format!("Failed to run mklink: {}", e))?;
        if !output.status.success() {
            return Err(String::from_utf8_lossy(&output.stderr).to_string());
        }
    }
    #[cfg(not(target_os = "windows"))]
    {
        std::os::unix::fs::symlink(target, link).map_err(|e| format!("Failed to create symlink: {}", e))?;
    }
    Ok(())
}

fn remove_symlink_or_junction(path: &Path) -> Result<(), String> {
    let meta = std::fs::symlink_metadata(path).map_err(|e| e.to_string())?;
    if meta.file_type().is_symlink() {
        #[cfg(target_os = "windows")]
        {
            if meta.is_dir() {
                std::fs::remove_dir(path).map_err(|e| e.to_string())?;
            } else {
                std::fs::remove_file(path).map_err(|e| e.to_string())?;
            }
        }
        #[cfg(not(target_os = "windows"))]
        {
            std::fs::remove_file(path).map_err(|e| e.to_string())?;
        }
    } else {
        return Err("Not a symlink or junction".to_string());
    }
    Ok(())
}

// ── 交互式终端安装命令实现 ──

#[tauri::command]
pub async fn run_interactive_command(app: tauri::AppHandle, command_line: String) -> Result<(), String> {
    let cfg = config::load();
    if cfg.central_skills_dir.is_empty() {
        return Err("Central skills directory is not configured".to_string());
    }
    let central_dir = expand_tilde(&cfg.central_skills_dir);
    if !central_dir.exists() {
        return Err(format!("Central skills directory does not exist: {}", central_dir.display()));
    }

    // 强杀已在运行的终端命令
    {
        let mut proc = ACTIVE_PROCESS.lock().unwrap();
        if let Some(mut child) = proc.take() {
            let _ = child.kill();
        }
    }

    #[cfg(not(target_os = "windows"))]
    let mut child = std::process::Command::new("sh")
        .arg("-c")
        .arg(&command_line)
        .current_dir(&central_dir)
        .stdin(std::process::Stdio::piped())
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::piped())
        .spawn()
        .map_err(|e| format!("Failed to spawn command: {}", e))?;

    #[cfg(target_os = "windows")]
    let mut child = std::process::Command::new("cmd")
        .arg("/C")
        .arg(&command_line)
        .current_dir(&central_dir)
        .stdin(std::process::Stdio::piped())
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::piped())
        .spawn()
        .map_err(|e| format!("Failed to spawn command: {}", e))?;

    let stdout = child.stdout.take().ok_or("Failed to open stdout pipe")?;
    let stderr = child.stderr.take().ok_or("Failed to open stderr pipe")?;

    {
        let mut proc = ACTIVE_PROCESS.lock().unwrap();
        *proc = Some(child);
    }

    // 异步逐字推送 stdout 到前端
    let app_stdout = app.clone();
    std::thread::spawn(move || {
        let mut reader = std::io::BufReader::new(stdout);
        let mut buffer = [0; 64];
        while let Ok(n) = reader.read(&mut buffer) {
            if n == 0 {
                break;
            }
            let text = String::from_utf8_lossy(&buffer[..n]).to_string();
            let _ = app_stdout.emit("term-stdout", text);
        }
    });

    // 异步逐字推送 stderr 到前端
    let app_stderr = app.clone();
    std::thread::spawn(move || {
        let mut reader = std::io::BufReader::new(stderr);
        let mut buffer = [0; 64];
        while let Ok(n) = reader.read(&mut buffer) {
            if n == 0 {
                break;
            }
            let text = String::from_utf8_lossy(&buffer[..n]).to_string();
            let _ = app_stderr.emit("term-stdout", text);
        }
    });

    // 异步等待子进程完成并清理 Mutex，向前端推送 term-exit
    let app_exit = app.clone();
    std::thread::spawn(move || {
        let mut exit_code = 0;
        loop {
            let finished = {
                let mut proc = ACTIVE_PROCESS.lock().unwrap();
                if let Some(child) = proc.as_mut() {
                    match child.try_wait() {
                        Ok(Some(status)) => {
                            exit_code = status.code().unwrap_or(0);
                            true
                        }
                        Ok(None) => false,
                        Err(_) => true,
                    }
                } else {
                    true
                }
            };

            if finished {
                let mut proc = ACTIVE_PROCESS.lock().unwrap();
                *proc = None;
                break;
            }
            std::thread::sleep(std::time::Duration::from_millis(100));
        }
        let _ = app_exit.emit("term-exit", exit_code);
    });

    Ok(())
}

#[tauri::command]
pub fn send_command_input(input: String) -> Result<(), String> {
    let mut proc = ACTIVE_PROCESS.lock().unwrap();
    if let Some(child) = proc.as_mut() {
        if let Some(stdin) = child.stdin.as_mut() {
            stdin.write_all(input.as_bytes()).map_err(|e| e.to_string())?;
            stdin.flush().map_err(|e| e.to_string())?;
        } else {
            return Err("Stdin pipe not open".to_string());
        }
    } else {
        return Err("No active command running".to_string());
    }
    Ok(())
}

#[tauri::command]
pub fn kill_interactive_command() -> Result<(), String> {
    let mut proc = ACTIVE_PROCESS.lock().unwrap();
    if let Some(mut child) = proc.take() {
        let _ = child.kill();
    }
    Ok(())
}
