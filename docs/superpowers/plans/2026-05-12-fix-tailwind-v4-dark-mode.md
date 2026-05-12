# Tailwind CSS v4 Dark Mode Fix Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix dark mode toggle not working in a Tailwind CSS v4 + React + Vite project

**Architecture:** Tailwind v4 uses CSS-first configuration and defaults to `prefers-color-scheme` media query for dark mode. Class-based dark mode requires an explicit `@custom-variant` directive in CSS. The `darkMode: "class"` setting in `tailwind.config.js` is a v3 pattern and is ignored by v4.

**Tech Stack:** Tailwind CSS v4, React, Vite, TypeScript

---

## Problem Diagnosis

### Symptom
Clicking the dark mode toggle button adds/removes the `.dark` class on `<html>`, but the visual theme doesn't change.

### Root Cause
1. **Tailwind v4 ignores `tailwind.config.js`** — the `darkMode: "class"` setting is a v3 pattern. V4 uses CSS-first config via `@import "tailwindcss"` and defaults to media-query-based dark mode.
2. **Legacy `@media (prefers-color-scheme: dark)` CSS** in scaffold files overrides Tailwind's `dark:` utilities independently of the `.dark` class.
3. **No localStorage persistence** — theme resets to OS preference on every reload.

### How to Verify the Bug Exists
1. Open browser dev tools, check `<html>` element
2. Click toggle — confirm `.dark` class is added/removed
3. Inspect a `dark:bg-*` element — styles don't change
4. Check computed styles — they respond to `prefers-color-scheme`, not the `.dark` class

---

## File Structure

| File | Responsibility |
|------|---------------|
| `src/index.css` | Tailwind imports + dark mode variant config |
| `src/main.tsx` | Pre-render theme initialization (prevents FOUC) |
| `src/App.tsx` | Theme toggle state + localStorage sync |
| `src/App.css` | Legacy scaffold styles (remove dark media query) |
| `tailwind.config.js` | DELETE — v4 doesn't read it for dark mode |

---

### Task 1: Configure class-based dark mode in Tailwind v4

**Files:**
- Modify: `src/index.css`

**Why:** Tailwind v4 defaults to `prefers-color-scheme` media query. The `@custom-variant` directive overrides the `dark` variant to use the `.dark` class selector instead.

- [ ] **Step 1: Add custom variant directive**

Add `@custom-variant dark (&:where(.dark, .dark *));` after the `@import "tailwindcss"` line in `src/index.css`:

```css
@import "tailwindcss";
@custom-variant dark (&:where(.dark, .dark *));
```

This tells Tailwind: "apply `dark:` utilities when `.dark` class exists on an ancestor element."

- [ ] **Step 2: Verify Tailwind processes the variant**

Run: `pnpm dev` and inspect the generated CSS in browser dev tools. The `dark:` utilities should now use `.dark &` selectors instead of `@media (prefers-color-scheme: dark)`.

- [ ] **Step 3: Commit**

```bash
git add src/index.css
git commit -m "fix: configure class-based dark mode for Tailwind v4"
```

---

### Task 2: Remove conflicting legacy dark styles

**Files:**
- Modify: `src/App.css`

**Why:** Tauri scaffold's `@media (prefers-color-scheme: dark)` block styles `:root`, `input`, and `button` based on OS preference. This overrides Tailwind's `dark:` utilities and ignores the `.dark` class entirely.

- [ ] **Step 1: Remove the media query block**

Delete the entire `@media (prefers-color-scheme: dark) { ... }` block from `src/App.css`. It typically looks like:

```css
/* DELETE THIS ENTIRE BLOCK */
@media (prefers-color-scheme: dark) {
  :root {
    color: #f6f6f6;
    background-color: #2f2f2f;
  }
  a:hover {
    color: #24c8db;
  }
  input,
  button {
    color: #ffffff;
    background-color: #0f0f0f98;
  }
  button:active {
    background-color: #0f0f0f69;
  }
}
```

- [ ] **Step 2: Verify no visual regression**

Run: `pnpm dev`. Toggle dark mode. Input and button elements should now follow Tailwind's `dark:` classes instead of the removed media query.

- [ ] **Step 3: Commit**

```bash
git add src/App.css
git commit -m "fix: remove legacy dark mode media query that overrides Tailwind"
```

---

### Task 3: Add localStorage persistence for theme preference

**Files:**
- Modify: `src/main.tsx`
- Modify: `src/App.tsx`

**Why:** Without persistence, the theme resets to OS preference on every reload. The theme must be set before React mounts (in `main.tsx`) to prevent flash of wrong theme (FOUC).

- [ ] **Step 1: Update `main.tsx` to read from localStorage**

Replace the simple `matchMedia` check with localStorage-aware logic:

```tsx
// src/main.tsx
const savedTheme = localStorage.getItem("theme");
if (
  savedTheme === "dark" ||
  (!savedTheme && window.matchMedia("(prefers-color-scheme: dark)").matches)
) {
  document.documentElement.classList.add("dark");
}
```

Logic: use saved preference if it exists, otherwise fall back to OS preference.

- [ ] **Step 2: Update `App.tsx` initial state to read from DOM**

Change the `useState` initializer to read from the DOM class (already set by `main.tsx`):

```tsx
// src/App.tsx
const [dark, setDark] = useState(() => document.documentElement.classList.contains("dark"));
```

- [ ] **Step 3: Update `toggleDark` to persist to localStorage**

```tsx
// src/App.tsx
const toggleDark = () => {
  setDark((d) => {
    const next = !d;
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("theme", next ? "dark" : "light");
    return next;
  });
};
```

- [ ] **Step 4: Verify persistence**

Run: `pnpm dev`. Toggle to dark mode. Reload page. Theme should persist. Clear localStorage in dev tools. Reload. Theme should follow OS preference.

- [ ] **Step 5: Commit**

```bash
git add src/main.tsx src/App.tsx
git commit -m "feat: persist theme preference to localStorage"
```

---

### Task 4: Remove unused `tailwind.config.js`

**Files:**
- Delete: `tailwind.config.js`

**Why:** In Tailwind v4, `darkMode: "class"` in `tailwind.config.js` is ignored. The config is now handled via CSS (`@custom-variant`). Content paths are auto-detected by v4. The file is dead code.

- [ ] **Step 1: Delete the file**

```bash
rm tailwind.config.js
```

- [ ] **Step 2: Verify build still works**

Run: `pnpm build`. Tailwind v4 should auto-detect content paths without the config file.

- [ ] **Step 3: Commit**

```bash
git add tailwind.config.js
git commit -m "chore: remove unused tailwind.config.js (v4 uses CSS config)"
```

---

## Verification Checklist

After all tasks, verify end-to-end:

1. `npx tsc --noEmit` — no type errors
2. `pnpm dev` — app loads without flash of wrong theme
3. Toggle button switches theme visually (all `dark:` utilities apply)
4. Reload — theme persists from localStorage
5. Clear localStorage — falls back to OS preference
6. `pnpm build` — production build succeeds

## Key Takeaways

- **Tailwind v4 is CSS-first.** `tailwind.config.js` is not automatically read. Use `@custom-variant` in CSS for dark mode configuration.
- **Always check scaffold CSS.** Tauri/Next.js/Vite scaffolds often include `@media (prefers-color-scheme: dark)` blocks that conflict with class-based dark mode.
- **Set theme before React mounts.** Inline script in `main.tsx` prevents FOUC. React state alone is too late.
- **`@custom-variant dark (&:where(.dark, .dark *));`** is the official Tailwind v4 class-based dark mode pattern.
