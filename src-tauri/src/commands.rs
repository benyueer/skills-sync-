use crate::{config, skill, skill::Skill, sync, tools::Tool};

#[tauri::command]
pub fn get_skills(tool_id: String) -> Result<Vec<Skill>, String> {
    let tool = parse_tool(&tool_id)?;
    Ok(skill::discover_skills(&tool.skills_dir(), tool.id()))
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
pub fn open_skills_dir(tool_id: String) -> Result<(), String> {
    let tool = parse_tool(&tool_id)?;
    let dir = tool.skills_dir();
    if !dir.exists() {
        std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    }
    opener::open(&dir).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn read_skill_file(tool_id: String, skill_name: String) -> Result<String, String> {
    let tool = parse_tool(&tool_id)?;
    let skill_md = tool.skills_dir().join(&skill_name).join("SKILL.md");
    std::fs::read_to_string(&skill_md).map_err(|e| format!("Cannot read {}: {}", skill_md.display(), e))
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
