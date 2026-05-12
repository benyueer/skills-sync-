use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::PathBuf;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AppConfig {
    pub git_repo_url: String,
    pub last_sync: Option<String>,
    #[serde(default)]
    pub repo_local_path: String,
    #[serde(default)]
    pub custom_skills_dirs: HashMap<String, String>,
    #[serde(default = "default_window_width")]
    pub window_width: u32,
    #[serde(default = "default_window_height")]
    pub window_height: u32,
    #[serde(default)]
    pub window_x: Option<i32>,
    #[serde(default)]
    pub window_y: Option<i32>,
    #[serde(default)]
    pub dark_mode: bool,
    #[serde(default = "default_active_tab")]
    pub last_active_tab: String,
}

fn default_window_width() -> u32 {
    800
}

fn default_window_height() -> u32 {
    600
}

fn default_active_tab() -> String {
    "claude-code".to_string()
}

impl Default for AppConfig {
    fn default() -> Self {
        Self {
            git_repo_url: String::new(),
            last_sync: None,
            repo_local_path: String::new(),
            custom_skills_dirs: HashMap::new(),
            window_width: 800,
            window_height: 600,
            window_x: None,
            window_y: None,
            dark_mode: false,
            last_active_tab: "claude-code".to_string(),
        }
    }
}

fn config_path() -> PathBuf {
    let config_dir = dirs::config_dir()
        .expect("Cannot determine config directory")
        .join("skills-sync");
    std::fs::create_dir_all(&config_dir).ok();
    config_dir.join("settings.json")
}

pub fn load() -> AppConfig {
    let path = config_path();
    if path.exists() {
        let content = std::fs::read_to_string(&path).unwrap_or_default();
        serde_json::from_str(&content).unwrap_or_default()
    } else {
        AppConfig::default()
    }
}

pub fn save(config: &AppConfig) -> Result<(), String> {
    let path = config_path();
    let json = serde_json::to_string_pretty(config).map_err(|e| e.to_string())?;
    std::fs::write(&path, json).map_err(|e| e.to_string())
}
