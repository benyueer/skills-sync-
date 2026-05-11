# Add Hermes Tool Support

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Hermes as a fourth supported tool in SkillsSync, with its skills directory at `~/.hermes/skills/`.

**Architecture:** Extend the existing `Tool` enum and frontend `TOOLS` array with a new `Hermes` variant. No new files needed — changes are additive to existing modules.

**Tech Stack:** Rust (serde, dirs), TypeScript, React, Tauri v2

---

### Task 1: Add Hermes to Rust Tool enum

**Files:**
- Modify: `src-tauri/src/tools.rs`

- [ ] **Step 1: Add Hermes variant to the Tool enum and implement all methods**

In `src-tauri/src/tools.rs`, add `Hermes` to the enum and every `match` arm:

```rust
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
```

- [ ] **Step 2: Add Hermes to parse_tool in commands.rs**

In `src-tauri/src/commands.rs`, add the `"hermes"` match arm to `parse_tool`:

```rust
fn parse_tool(tool_id: &str) -> Result<Tool, String> {
    match tool_id {
        "claude-code" => Ok(Tool::ClaudeCode),
        "opencode" => Ok(Tool::OpenCode),
        "codex" => Ok(Tool::Codex),
        "hermes" => Ok(Tool::Hermes),
        _ => Err(format!("Unknown tool: {}", tool_id)),
    }
}
```

- [ ] **Step 3: Verify Rust compiles**

Run: `cd src-tauri && cargo build`
Expected: Compiles without errors

- [ ] **Step 4: Commit**

```bash
git add src-tauri/src/tools.rs src-tauri/src/commands.rs
git commit -m "feat: add Hermes tool with ~/.hermes/skills/ path"
```

---

### Task 2: Add Hermes to TypeScript frontend

**Files:**
- Modify: `src/types.ts`

- [ ] **Step 1: Add "hermes" to ToolId and TOOLS array**

In `src/types.ts`, update the type and constant:

```typescript
export type ToolId = "claude-code" | "opencode" | "codex" | "hermes";

export const TOOLS: ToolTab[] = [
  { id: "claude-code", label: "Claude Code" },
  { id: "opencode", label: "OpenCode" },
  { id: "codex", label: "Codex" },
  { id: "hermes", label: "Hermes" },
];
```

- [ ] **Step 2: Verify frontend builds**

Run: `npm run build`
Expected: tsc + vite build succeeds

- [ ] **Step 3: Commit**

```bash
git add src/types.ts
git commit -m "feat: add Hermes tab to frontend"
```

---

### Task 3: Verify end-to-end

- [ ] **Step 1: Create a test skill for Hermes**

```bash
mkdir -p ~/.hermes/skills/test-skill
cat > ~/.hermes/skills/test-skill/SKILL.md << 'EOF'
---
name: test-skill
description: A test skill for Hermes
---
This is a test skill.
EOF
```

- [ ] **Step 2: Run the app and verify**

Run: `cd src-tauri && cargo tauri dev`
Expected: Four tabs visible (Claude Code, OpenCode, Codex, Hermes). Clicking Hermes tab shows the test-skill.

- [ ] **Step 3: Clean up test skill**

```bash
rm -rf ~/.hermes/skills/test-skill
```
