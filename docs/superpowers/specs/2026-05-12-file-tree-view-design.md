# File Tree View for Complex Skills - Design Spec

## Overview

Extend the `SkillDetail` component to display a file tree sidebar for complex skills that contain multiple files (scripts, references, etc.), not just the main SKILL.md file.

## Problem

Currently, `SkillDetail` only reads and displays the main `SKILL.md` file. Skills can have:
- `scripts/` directory with setup/run scripts
- `references/` directory with documentation
- Other files and directories

Users cannot browse or view these files in the app.

## Solution

Add a file tree sidebar to `SkillDetail` that shows all files in the skill directory. Users can click files to view their content in the main pane.

## Architecture

### Components

1. **FileTree.tsx** - New recursive tree component
   - Displays file/folder hierarchy
   - Expand/collapse directories
   - File-type icons (📄 .md, 🐍 .py, 🔧 .sh, 📁 folders)
   - Click to select file
   - Visual indicator for selected file

2. **SkillDetail.tsx** - Modified
   - Split layout: left sidebar (200px) + right pane (flex-1)
   - Sidebar contains FileTree component
   - Content pane shows selected file with syntax highlighting
   - Edit button opens skill folder in external editor

### Data Types

```typescript
interface FileEntry {
  name: string;
  path: string;
  isDirectory: boolean;
  children?: FileEntry[];
}
```

### Tauri Commands

1. **list_skill_files(tool_id, skill_name)** → `FileEntry[]`
   - Recursively lists all files in skill directory
   - Returns tree structure with directories and files

2. **read_file_content(path)** → `string`
   - Reads any file by absolute path
   - Used to display file content in pane

### Syntax Highlighting

- Use `highlight.js` for code syntax highlighting
- Detect language from file extension
- Supported: .js, .ts, .py, .sh, .md, .json, .yaml, etc.
- Fallback to plain text for unknown types

## UI Layout

```
┌─────────────────────────────────────┐
│ ← Back   skill-name        [Edit]  │
├──────────────┬──────────────────────┤
│ 📄 SKILL.md  │ # Skill Name        │
│ 📁 scripts/  │                      │
│   ├ setup.sh │ Description of the  │
│   └ run.py   │ skill...             │
│ 📁 refs/     │                      │
│   └ api.md   │                      │
├──────────────┴──────────────────────┤
│ /path/to/skill                      │
└─────────────────────────────────────┘
```

## Behavior

1. **Initial load**: Show SKILL.md by default (backward compatible)
2. **File click**: Load and display clicked file content
3. **Folder click**: Expand/collapse directory
4. **Edit button**: Opens skill folder in external editor (existing behavior)
5. **Path click**: Opens skill folder in file explorer (existing behavior)

## Edge Cases

- **Empty directories**: Show folder icon, no children
- **Large files**: Truncate display for files > 1MB
- **Binary files**: Show "Binary file not displayed" message
- **Permission errors**: Show error message in content pane
- **Single-file skills**: Hide sidebar, show content directly (current behavior)

## Dependencies

- `highlight.js` - For syntax highlighting (npm package)
- No new Tauri plugins required

## Testing

1. View skill with only SKILL.md → no sidebar shown
2. View skill with scripts/ → sidebar shows file tree
3. Click script file → content displayed with syntax highlighting
4. Click folder → expand/collapse works
5. Edit button → opens folder in external editor
6. Path click → opens folder in file explorer
