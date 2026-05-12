# Cache User Settings Design

## Overview

Extend the existing `AppConfig` to persist all user-entered information and UI state, so that each program startup uses stored values and updates them when the user makes changes.

## Requirements

1. **Git Repository URL** - Already implemented, restore on startup
2. **Custom Skill Directories** - Already implemented, restore on startup
3. **Window Size/Position** - Cache window width, height, x, y position
4. **Dark Mode Preference** - Cache dark/light mode selection
5. **Last Active Tab** - Cache which tool tab was last active

## Architecture

### Data Model

Extend `AppConfig` in `src-tauri/src/config.rs`:

```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AppConfig {
    // Existing fields
    pub git_repo_url: String,
    pub last_sync: Option<String>,
    pub repo_local_path: String,
    pub custom_skills_dirs: HashMap<String, String>,
    
    // New fields
    pub window_width: u32,
    pub window_height: u32,
    pub window_x: Option<i32>,
    pub window_y: Option<i32>,
    pub dark_mode: bool,
    pub last_active_tab: String,
}
```

Default values:
- `window_width`: 800
- `window_height`: 600
- `window_x`: None (centered)
- `window_y`: None (centered)
- `dark_mode`: false (light mode)
- `last_active_tab`: "claude-code"

### Backend Commands

Add new Tauri commands in `src-tauri/src/commands.rs`:

1. `save_window_state(width: u32, height: u32, x: i32, y: i32)` - Save window dimensions and position
2. `save_dark_mode(dark: bool)` - Save dark mode preference
3. `save_active_tab(tab: String)` - Save last active tab

### Frontend Integration

1. **App.tsx** - Load all settings on mount, apply to state
2. **useSkills.ts** - Add hooks for window state, dark mode, tab persistence
3. **Window events** - Listen for resize/move events, debounce saves

### Data Flow

1. **Startup**:
   - Load `AppConfig` from `~/.config/skills-sync/settings.json`
   - Apply `window_width`, `window_height`, `window_x`, `window_y` to window
   - Apply `dark_mode` to document class and state
   - Set `last_active_tab` as active tab

2. **Runtime**:
   - On window resize/move: Debounce 500ms, save new dimensions/position
   - On dark mode toggle: Save immediately
   - On tab change: Save immediately
   - On git repo URL / custom dir change: Already handled (save immediately)

### Error Handling

- Config load failures: Use default values (current behavior)
- Config save failures: Log error but don't block UI
- Window position out of bounds: Reset to centered on next startup

## Files to Modify

### Backend (Rust)

1. `src-tauri/src/config.rs`
   - Add new fields to `AppConfig` struct
   - Update `Default` impl with default values

2. `src-tauri/src/commands.rs`
   - Add `save_window_state` command
   - Add `save_dark_mode` command
   - Add `save_active_tab` command

3. `src-tauri/src/lib.rs`
   - Register new commands in `invoke_handler`

### Frontend (TypeScript/React)

1. `src/types.ts`
   - Update `AppConfig` interface with new fields

2. `src/hooks/useSkills.ts`
   - Add `useWindowState` hook
   - Add `useDarkMode` hook
   - Add `useActiveTab` hook

3. `src/App.tsx`
   - Load settings on mount
   - Apply window state, dark mode, active tab
   - Save on changes

## Testing

### Manual Tests

1. **Window State**:
   - Resize window to 1000x800
   - Move window to position (100, 200)
   - Close and reopen app
   - Expected: Window restores to 1000x800 at (100, 200)

2. **Dark Mode**:
   - Toggle dark mode on
   - Close and reopen app
   - Expected: Dark mode is still on

3. **Last Active Tab**:
   - Switch to "opencode" tab
   - Close and reopen app
   - Expected: "opencode" tab is active

4. **Existing Settings**:
   - Enter git repo URL
   - Set custom skill directory
   - Close and reopen app
   - Expected: Both values are restored

## Migration

Existing `settings.json` files will be missing the new fields. The `#[serde(default)]` attribute on the new fields will ensure backward compatibility - missing fields will use their default values.

## Future Considerations

- Window maximized state (could add `window_maximized: bool`)
- Multiple window support (would need window ID in config)
- Sync settings across devices (would need cloud storage)
