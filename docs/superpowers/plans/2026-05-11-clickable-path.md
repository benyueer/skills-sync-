# Clickable Skill Path Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the skill path shown at the bottom of the SkillDetail page clickable, opening the skill directory in the system file explorer (Windows Explorer / macOS Finder).

**Architecture:** Add a new `reveal_path` Tauri command that uses `opener::reveal` to open the file manager at the given path. Wire it up in the frontend as a clickable link replacing the plain text path display.

**Tech Stack:** Rust (`opener` crate's `reveal` function), React + TypeScript

---

### Task 1: Add `reveal_path` Tauri command

**Files:**
- Modify: `src-tauri/src/commands.rs`
- Modify: `src-tauri/src/lib.rs`

- [ ] **Step 1: Add the `reveal_path` command to `commands.rs`**

Add this function at the end of `src-tauri/src/commands.rs` (before the closing of the file, after `execute_restore`):

```rust
#[tauri::command]
pub fn reveal_path(path: String) -> Result<(), String> {
    opener::reveal(&path).map_err(|e| format!("Failed to open path: {}", e))?;
    Ok(())
}
```

- [ ] **Step 2: Register the command in `lib.rs`**

In `src-tauri/src/lib.rs`, add `commands::reveal_path` to the `invoke_handler` macro:

```rust
.invoke_handler(tauri::generate_handler![
    commands::get_skills,
    commands::get_config,
    commands::save_config,
    commands::sync_from_git,
    commands::open_skills_dir,
    commands::read_skill_file,
    commands::save_custom_dir,
    commands::backup_skills,
    commands::preview_restore,
    commands::execute_restore,
    commands::open_skill_with_app,
    commands::reveal_path,
])
```

- [ ] **Step 3: Verify it compiles**

Run: `cd src-tauri && cargo build`
Expected: successful build with no errors.

- [ ] **Step 4: Commit**

```bash
git add src-tauri/src/commands.rs src-tauri/src/lib.rs
git commit -m "feat: add reveal_path command to open path in file manager"
```

---

### Task 2: Make path clickable in SkillDetail

**Files:**
- Modify: `src/components/SkillDetail.tsx`

- [ ] **Step 1: Import `invoke` (already imported) and update the path display**

Replace the bottom path display section (lines 117-119):

```tsx
<div className="p-4 border-t border-gray-200 dark:border-gray-700 text-xs text-gray-400">
  {skill.path}
</div>
```

With a clickable version:

```tsx
<div className="p-4 border-t border-gray-200 dark:border-gray-700">
  <button
    onClick={() => invoke("reveal_path", { path: skill.path })}
    className="text-xs text-gray-400 hover:text-blue-500 dark:hover:text-blue-400 hover:underline cursor-pointer"
    title="Open in file explorer"
  >
    {skill.path}
  </button>
</div>
```

- [ ] **Step 2: Verify frontend compiles**

Run: `npm run build` (or `npx tsc --noEmit`)
Expected: no TypeScript errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/SkillDetail.tsx
git commit -m "feat: make skill path clickable to open in file explorer"
```
