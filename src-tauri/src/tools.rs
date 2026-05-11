use serde::Serialize;
use std::path::PathBuf;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum Tool {
    ClaudeCode,
    OpenCode,
    Codex,
    Hermes,
}

impl Tool {
    pub fn all() -> &'static [Tool] {
        &[Tool::ClaudeCode, Tool::OpenCode, Tool::Codex, Tool::Hermes]
    }

    pub fn display_name(&self) -> &'static str {
        match self {
            Tool::ClaudeCode => "Claude Code",
            Tool::OpenCode => "OpenCode",
            Tool::Codex => "Codex",
            Tool::Hermes => "Hermes",
        }
    }

    pub fn id(&self) -> &'static str {
        match self {
            Tool::ClaudeCode => "claude-code",
            Tool::OpenCode => "opencode",
            Tool::Codex => "codex",
            Tool::Hermes => "hermes",
        }
    }

    /// Global skills directory for this tool on the current platform.
    pub fn skills_dir(&self) -> PathBuf {
        let home = dirs::home_dir().expect("Cannot determine home directory");
        match self {
            Tool::ClaudeCode => home.join(".claude").join("skills"),
            #[cfg(target_os = "windows")]
            Tool::OpenCode => {
                let appdata = std::env::var("APPDATA").expect("APPDATA not set");
                PathBuf::from(appdata).join("opencode").join("skills")
            }
            #[cfg(not(target_os = "windows"))]
            Tool::OpenCode => home.join(".config").join("opencode").join("skills"),
            Tool::Codex => home.join(".agents").join("skills"),
            Tool::Hermes => home.join(".hermes").join("skills"),
        }
    }
}
