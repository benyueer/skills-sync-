---
name: SkillsSync
description: Local symlink skills console for agents and developers
colors:
  primary: "#10b981"
  neutral-bg: "#030712"
  neutral-surface: "#111827"
  neutral-text: "#f9fafb"
  neutral-muted: "#9ca3af"
  border-dim: "#1f2937"
  accent-purple: "#a855f7"
  accent-green: "#22c55e"
  accent-red: "#ef4444"
typography:
  display:
    fontFamily: "Inter, Avenir, Helvetica, Arial, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 700
    lineHeight: 1.25
    letterSpacing: "-0.02em"
  body:
    fontFamily: "Inter, Avenir, Helvetica, Arial, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "normal"
rounded:
  sm: "4px"
  md: "8px"
  lg: "12px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.neutral-bg}"
    rounded: "{rounded.md}"
    padding: "8px 16px"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.neutral-muted}"
    rounded: "{rounded.md}"
    padding: "8px 16px"
  card:
    backgroundColor: "{colors.neutral-surface}"
    rounded: "{rounded.lg}"
    padding: "16px"
---

# Design System: SkillsSync

## 1. Overview

**Creative North Star: "The Terminal Console"**

本设计系统专为 SkillsSync——本地中央软链接技能控制台打造。界面视觉遵循“终端控制台”这一极客极简主义美学。它的核心是数据、状态与高效率的操作，界面主体为信息紧凑的表格，剔除所有冗余的装饰，保留最纯粹的数据信息和操作链路。

本系统在视觉上强力拒绝虚华的色彩渐变、花哨的 3D 插图和高对比度色彩污染，旨在为 AI Agent 创作者与极客开发者提供一个专注、沉浸、舒适的工作空间。

**Key Characteristics:**
- 极暗的背景色调与高清晰度的文本对比。
- 严谨的 1px 细线边框与网格化对齐。
- 局部的单色调高饱和状态指示（Emerald 翡翠绿为同步成功，Purple 为脚本状态）。
- 扁平化无阴影的轻量化布局。

## 2. Colors

本系统的颜色搭配遵循“极客极简”策略，主色调为深灰色系，辅以状态点亮色。

### Primary
- **Emerald Sync Green** (#10b981): 用于指示同步成功、状态正常、已激活链接等积极且核心的状态操作。

### Neutral
- **Console Dark Bg** (#030712): 应用的主背景色，确保夜间和长时间使用的舒适度。
- **Console Panel Surface** (#111827): 卡片、弹窗和列表的容器表面颜色，与主背景形成微妙的层级对比。
- **Pure Text White** (#f9fafb): 主要文字和操作按钮文字的颜色，保证极限的清晰度。
- **Console Muted Gray** (#9ca3af): 辅助文本、次要说明和占位符的颜色，对比度达到 WCAG AA。
- **Console Wireframe Border** (#1f2937): 整个系统的分割线和边框颜色，奠定冷峻的网格骨架。

### Accent
- **Script Violet** (#a855f7): 用于带有 scripts 的技能高亮标识。
- **Ref Green** (#22c55e): 用于 references 技能的同步状态标识。
- **Alert Red** (#ef4444): 用于警告、删除、断开链接或备份冲突等异常状态的强调色。

### Named Rules
**The Zero-Bleed Rule.** 翡翠绿及彩色高亮（Script Violet, Alert Red）作为强调色，必须控制在单屏视口总面积的 10% 以下。色彩的稀缺性就是其语义的精确性。
**The Contrast Rule.** 任何文本对比度必须达到 WCAG AA 级以上（中灰辅助文字 `#9ca3af` 与背景的对比度需满足 4.5:1 限制）。

## 3. Typography

我们使用无衬线字体作为主体搭配，并在路径、脚本和特定代码字段部分使用等宽字体以强调技术感。

**Display Font:** Inter, Avenir, Helvetica, Arial, sans-serif
**Body Font:** Inter, Avenir, Helvetica, Arial, sans-serif
**Label/Mono Font:** ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace

**Character:** 界面文字追求清晰与紧凑。Display 标题采用中粗体且略微收紧字距，Body 部分强调行高与行宽平衡。

### Hierarchy
- **Display** (Bold (700), 1.25rem, 1.25): 用于主要板块标题（如应用名、核心详情标题）。
- **Headline** (Semi-Bold (600), 1.05rem, 1.3): 用于各级卡片和表格行标题。
- **Body** (Regular (400), 0.875rem, 1.5): 用于描述性文字、长段文本，最大限制宽度为 70ch。
- **Label** (Medium (500), 0.75rem, normal, tracking-wide): 用于标签（Scripts、Refs）、状态指示器和表头。

### Named Rules
**The Code-Like Rule.** 凡是表示技能名称、终端命令、本地软链接路径（Symlink Path）或文件树节点的，一律强制使用等宽字体 (Monospace Font Family)。

## 4. Elevation

本系统摒弃所有的三维空间和投影隐喻，专注扁平的线条与色块层级。

本系统不使用多层模糊投影，而是通过 1px 细线边框 (`#1f2937`) 和不同明暗度的背景色块组合来表达内容的主次。

### Named Rules
**The Flat-By-Default Rule.** 所有卡片、表格、面板在静止状态下均为扁平设计，没有 box-shadow。只有在鼠标悬停或元素获得焦点（Focus）时，方可通过微弱的 border 颜色变亮进行状态响应。

## 5. Components

组件应具备利落的物理边界感，强调状态的灵敏切换。

### Buttons
- **Shape:** 微圆角 (8px, `rounded-md`)。
- **Primary:** 背景色 `#10b981`，前景色 `#030712`，横向内边距 16px，纵向内边距 8px。
- **Hover / Focus:** 悬停时背景色微调，且加入 1px 的白色聚焦框或细边框增亮，过渡时间 `0.15s`。
- **Ghost:** 背景透明，文字色 `#9ca3af`，悬停时文字变为 `#f9fafb` 并微弱亮起背景 (`#111827`)。

### Cards / Containers
- **Corner Style:** 较明显圆角 (12px, `rounded-lg`)。
- **Background:** `#111827` 容器表面色。
- **Shadow Strategy:** 无投影。
- **Border:** 1px 的 `#1f2937` 细线边框。
- **Internal Padding:** 16px (`p-4`)。

### Inputs / Fields
- **Style:** 背景 `#030712`，1px 边框 `#1f2937`，圆角 8px (`rounded-md`)。
- **Focus:** 焦点态下边框高亮为 `#10b981`。

## 6. Do's and Don'ts

### Do:
- **Do** 强制文本和操作对比，文字色首选亮白 `#f9fafb`，配合极暗底色。
- **Do** 对路径、文件名、技术术语使用等宽字体排版。
- **Do** 仅在状态极其重要或关键分支时，才使用高饱和的 Emerald 绿色和 Script 紫色作为高亮。
- **Do** 在所有边角上保持一致的微圆角（控件用 8px，大卡片用 12px）。

### Don't:
- **Don't** 使用超过 16px 的超大圆角（禁止使用 24px/32px 等过分圆滑的过渡）。
- **Don't** 在卡片、按钮、表格上附加任何复杂的 box-shadow。
- **Don't** 使用手绘风（sketchy/loose-sketch）SVG 矢量插图。
- **Don't** 使用 side-stripe 侧边粗彩色线条作为卡片或呼出框的左边装饰（禁止使用 >1px 的 border-left 装饰）。
- **Don't** 在文字中使用渐变背景裁剪 (`background-clip: text` + 渐变) 效果。
- **Don't** 引入玻璃拟态 (glassmorphism) 的高强度毛玻璃滤镜背景。
