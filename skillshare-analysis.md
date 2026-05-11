# Skillshare 项目分析文档

> 项目地址: https://github.com/runkids/skillshare
> 分析时间: 2026-05-11

## 1. 项目概述

Skillshare 是一个用 Go 语言编写的 CLI 工具，用于统一管理 AI CLI 工具的 skills、agents、rules、commands 等资源。它解决了"每个 AI CLI 都有自己的 skills 目录，编辑一个忘记复制到另一个"的问题。

**核心理念**: 一个源，同步到所有 agent —— 通过 `skillshare sync` 命令将 skills 同步到 Claude、Cursor、Codex 等 60+ 个目标。

### 1.1 支持的目标平台

- Claude Code
- Cursor
- OpenCode
- OpenClaw
- Codex
- 以及 60+ 更多 AI CLI 工具

### 1.2 核心特性

| 特性 | 描述 |
|------|------|
| **单一源同步** | 一个源目录同步到所有目标 |
| **Agent 管理** | 同步自定义 agents 到支持 agent 的目标 |
| **多资源管理** | 管理 rules、commands、prompts 等基于文件的资源 |
| **多平台安装** | 支持 GitHub、GitLab、Bitbucket、Azure DevOps 或自托管 Git |
| **安全审计** | 安装前扫描 skills 的 prompt injection 和数据泄露风险 |
| **团队协作** | 项目级 skills 在 `.skillshare/`，组织级通过 git 仓库管理 |
| **本地轻量** | 单二进制文件，无注册中心，无遥测，完全离线 |
| **精细过滤** | 通过 `.skillignore`、SKILL.md `targets`、include/exclude 控制同步范围 |

---

## 2. 技术栈

### 2.1 后端 (CLI)

| 组件 | 技术 |
|------|------|
| **语言** | Go 1.25.5 |
| **TUI 框架** | Bubble Tea (charmbracelet/bubbletea) |
| **终端样式** | Lipgloss (charmbracelet/lipgloss) |
| **Markdown 渲染** | Glamour (charmbracelet/glamour) |
| **YAML 解析** | gopkg.in/yaml.v3 |
| **差异对比** | sergi/go-diff |
| **终端输出** | pterm/pterm |

### 2.2 前端 (Web UI)

| 组件 | 技术 |
|------|------|
| **框架** | React 19 |
| **构建工具** | Vite 8 |
| **样式** | Tailwind CSS 4 |
| **路由** | React Router 7 |
| **数据获取** | TanStack React Query |
| **代码编辑器** | CodeMirror 6 |
| **Markdown 渲染** | react-markdown + remark-gfm |
| **虚拟列表** | react-virtuoso |
| **图标** | Lucide React |
| **类型检查** | TypeScript 5.9 |
| **测试** | Vitest + Testing Library |

---

## 3. 项目结构

```
skillshare/
├── cmd/skillshare/          # CLI 命令入口
│   ├── main.go             # 主入口，命令路由
│   ├── init.go             # init 命令
│   ├── install.go          # install 命令
│   ├── sync.go             # sync 命令
│   ├── audit.go            # audit 命令
│   ├── list.go             # list 命令
│   ├── collect.go          # collect 命令
│   ├── diff.go             # diff 命令
│   ├── backup.go           # backup/restore 命令
│   ├── extras.go           # extras 管理
│   ├── hub.go              # hub 管理
│   ├── ui.go               # Web UI 启动
│   └── ...                 # 其他命令
│
├── internal/                # 核心业务逻辑
│   ├── audit/              # 安全审计引擎
│   │   ├── audit.go        # 审计主逻辑
│   │   ├── patterns.go     # 安全规则模式
│   │   ├── dataflow.go     # 数据流分析
│   │   ├── tiers.go        # 命令层级检测
│   │   ├── crossskill.go   # 跨 skill 分析
│   │   └── ...
│   ├── config/             # 配置管理
│   │   ├── config.go       # 配置加载/保存
│   │   ├── targets.go      # 目标配置
│   │   ├── registry.go     # 注册中心
│   │   └── ...
│   ├── sync/               # 同步引擎
│   │   ├── sync.go         # 同步核心逻辑
│   │   ├── merge.go        # 合并模式
│   │   └── ...
│   ├── install/            # 安装逻辑
│   ├── backup/             # 备份/恢复
│   ├── check/              # 更新检查
│   ├── git/                # Git 操作
│   ├── github/             # GitHub API
│   ├── hub/                # Hub 管理
│   ├── skillignore/        # .skillignore 解析
│   ├── theme/              # 主题管理
│   ├── ui/                 # UI 辅助
│   ├── utils/              # 工具函数
│   └── version/            # 版本管理
│
├── ui/                      # Web UI (React)
│   ├── src/
│   │   ├── App.tsx         # 应用入口
│   │   ├── api/            # API 客户端
│   │   ├── components/     # UI 组件
│   │   └── ...
│   └── package.json
│
├── schemas/                 # JSON Schema
│   ├── config.schema.json
│   ├── project-config.schema.json
│   └── registry.schema.json
│
├── skills/skillshare/       # 内置 skillshare skill
├── .skillshare/             # 项目级 skills
├── ai_docs/                 # AI 文档和测试 runbooks
├── website/                 # 文档网站
├── tests/                   # 集成测试
└── scripts/                 # 构建脚本
```

---

## 4. 核心功能详解

### 4.1 初始化 (`skillshare init`)

创建配置文件、源目录和检测到的目标。

**实现位置**: `cmd/skillshare/init.go`

**功能**:
- 创建 `~/.config/skillshare/config.yaml` 配置文件
- 创建源目录 (`~/.config/skillshare/skills/`)
- 自动检测已安装的 AI CLI 工具并配置目标
- 支持项目级初始化 (`-p` 参数)

### 4.2 安装 (`skillshare install`)

从各种来源安装 skills/agents。

**实现位置**: `cmd/skillshare/install.go`, `internal/install/`

**支持的来源**:
- GitHub 仓库: `skillshare install github.com/reponame/skills`
- GitLab 仓库
- Bitbucket 仓库
- Azure DevOps 仓库
- 自托管 Git 仓库
- 本地路径

**功能**:
- 自动解析 Git URL
- 克隆仓库到源目录
- 支持安装特定 agent (`-a` 参数)
- 安装后自动运行安全审计
- 支持跟踪仓库 (`--track` 参数)

### 4.3 同步 (`skillshare sync`)

将 skills/agents/extras 同步到目标。

**实现位置**: `cmd/skillshare/sync.go`, `internal/sync/sync.go`

**同步模式**:

| 模式 | 描述 |
|------|------|
| **symlink** | 创建符号链接（默认，macOS/Linux） |
| **merge** | 每个 skill 单独创建符号链接，保留目标特定的 skills |
| **copy** | 复制文件（Windows 或符号链接不可用时） |

**Windows 支持**:
- 使用 NTFS Junction（无需管理员权限）
- 自动处理路径分隔符

**功能**:
- 支持 dry-run 预览
- 支持仅同步 agents (`sync agents`)
- 支持同步所有资源 (`sync --all`)
- 自动清理孤立链接
- 支持相对符号链接（项目模式）

### 4.4 安全审计 (`skillshare audit`)

扫描 skills 中的安全威胁。

**实现位置**: `cmd/skillshare/audit.go`, `internal/audit/`

**审计分析器**:

| 分析器 | 功能 |
|--------|------|
| **static** | 静态正则匹配，检测已知危险模式 |
| **dataflow** | 数据流分析，追踪污点传播 |
| **tier** | 命令层级检测，识别高危命令组合 |
| **integrity** | 内容完整性检查，检测文件篡改 |
| **structure** | 结构检查，检测断开的链接 |
| **cross-skill** | 跨 skill 分析，检测跨文件风险 |
| **metadata** | 元数据分析 |

**检测类别**:

| 类别 | 描述 |
|------|------|
| **injection** | Prompt injection 攻击 |
| **exfiltration** | 数据泄露风险 |
| **credential** | 硬编码凭证 |
| **obfuscation** | 代码混淆 |
| **privilege** | 权限提升 |
| **integrity** | 内容完整性 |
| **structure** | 结构问题 |
| **risk** | 风险评估 |

**风险评分**:
- CRITICAL: 25 分
- HIGH: 15 分
- MEDIUM: 8 分
- LOW: 3 分
- INFO: 1 分

**风险等级**:
- clean: 0 分
- low: 1-25 分
- medium: 26-50 分
- high: 51-75 分
- critical: 76-100 分

### 4.5 目标管理 (`skillshare target`)

管理同步目标。

**实现位置**: `cmd/skillshare/target.go`, `internal/config/targets.go`

**内置目标** (macOS/Linux):
- `~/.claude/skills/` (Claude Code)
- `~/.cursor/skills/` (Cursor)
- `~/.opencode/skills/` (OpenCode)
- `~/.openclaw/skills/` (OpenClaw)

**内置目标** (Windows):
- `%APPDATA%\claude\skills\`
- `%APPDATA%\cursor\skills\`
- 等等

**操作**:
- `target add <name> [path]` - 添加目标
- `target remove <name>` - 移除目标
- `target list` - 列出所有目标
- `target <name> --mode copy` - 切换同步模式

### 4.6 Extras 管理

管理非 skill 资源（rules、commands、prompts 等）。

**实现位置**: `cmd/skillshare/extras.go`

**操作**:
- `extras init <name>` - 创建新的 extra 类型
- `extras list` - 列出所有 extras
- `extras remove <name>` - 移除 extra
- `extras collect <name>` - 从目标收集本地文件

### 4.7 Hub 管理

管理 skill 来源中心。

**实现位置**: `cmd/skillshare/hub.go`, `internal/config/hub.go`

**功能**:
- 添加/移除 hub
- 设置默认 hub
- 索引 hub 内容

### 4.8 备份/恢复

**实现位置**: `cmd/skillshare/backup.go`, `internal/backup/`

**功能**:
- `backup` - 创建目标备份
- `restore <target>` - 从最新备份恢复

### 4.9 Web UI

提供可视化控制面板。

**实现位置**: `cmd/skillshare/ui.go`, `ui/`

**技术栈**: React + Vite + Tailwind CSS

**功能**:
- Skills 列表和详情
- 安全审计结果展示
- 目标状态监控
- 配置管理

---

## 5. 配置系统

### 5.1 配置文件位置

| 平台 | 路径 |
|------|------|
| macOS/Linux | `~/.config/skillshare/config.yaml` |
| Windows | `%AppData%\skillshare\config.yaml` |

### 5.2 配置结构

```yaml
# 源目录
source: ~/.config/skillshare/skills/
agents_source: ~/.config/skillshare/agents/
extras_source: ~/.config/skillshare/extras/

# 默认同步模式
mode: symlink  # symlink, merge, copy

# 目标命名模式
target_naming: flat  # flat, standard

# 目标配置
targets:
  claude:
    skills:
      path: ~/.claude/skills/
      mode: symlink
      include: []
      exclude: []
    agents:
      path: ~/.claude/agents/
  cursor:
    skills:
      path: ~/.cursor/skills/

# Extras 配置
extras:
  - name: rules
    source: ~/.config/skillshare/extras/rules/
    targets:
      - path: ~/.claude/rules/
        mode: merge

# 忽略规则
ignore:
  - "*.test"
  - "docs/"

# 审计配置
audit:
  block_threshold: CRITICAL  # CRITICAL, HIGH, MEDIUM, LOW, INFO
  profile: default           # default, strict, permissive

# Hub 配置
hub:
  default: runkids
  hubs:
    - label: runkids
      url: https://hub.skillshare.runkids.cc

# 日志配置
log:
  max_entries: 1000

# Token 预算警告
context_budget:
  warn_always_loaded_tokens: 10000
  warn_on_demand_tokens: 100000

# TUI 模式
tui: true

# 自定义 GitLab/Azure 主机
gitlab_hosts:
  - gitlab.example.com
azure_hosts:
  - dev.azure.com
```

### 5.3 项目级配置

在项目根目录创建 `.skillshare/config.yaml`，支持项目特定的 skills 和配置。

---

## 6. 数据流架构

```
┌─────────────────────────────────────────────────────────────┐
│                    Source Directory                         │
│   ~/.config/skillshare/skills/    ← skills (SKILL.md)       │
│   ~/.config/skillshare/agents/    ← agents                   │
│   ~/.config/skillshare/extras/    ← rules, commands, etc.   │
└─────────────────────────────────────────────────────────────┘
                              │ sync
              ┌───────────────┼───────────────┐
              ▼               ▼               ▼
       ┌───────────┐   ┌───────────┐   ┌───────────┐
       │  Claude   │   │  OpenCode │   │ OpenClaw  │   ...
       └───────────┘   └───────────┘   └───────────┘
```

### 6.1 同步流程

1. **发现阶段**: 扫描源目录，发现所有 SKILL.md 文件
2. **过滤阶段**: 应用 .skillignore、include/exclude 规则
3. **解析阶段**: 解析 SKILL.md frontmatter，提取元数据
4. **冲突检测**: 检查名称冲突
5. **同步执行**: 根据模式创建符号链接/复制文件
6. **清理阶段**: 移除孤立链接
7. **manifest 更新**: 更新 manifest 文件

### 6.2 Skill 发现

**实现位置**: `internal/sync/sync.go`

```go
type DiscoveredSkill struct {
    SourcePath  string      // 完整路径
    RelPath     string      // 相对路径
    FlatName    string      // 扁平名称（用于目标）
    IsInRepo    bool        // 是否在跟踪的仓库中
    Targets     []string    // SKILL.md frontmatter 中的目标
    Description string      // 描述
    Disabled    bool        // 是否被 .skillignore 禁用
}
```

---

## 7. 安全审计引擎

### 7.1 架构

```
┌─────────────────────────────────────────────────────────┐
│                   Audit Engine                          │
├─────────────────────────────────────────────────────────┤
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐  │
│  │ Static  │  │Dataflow │  │  Tier   │  │Integrity│  │
│  │Analyzer │  │Analyzer │  │Analyzer │  │Analyzer │  │
│  └─────────┘  └─────────┘  └─────────┘  └─────────┘  │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐                │
│  │Structure│  │CrossSkill│  │Metadata │                │
│  │Analyzer │  │Analyzer │  │Analyzer │                │
│  └─────────┘  └─────────┘  └─────────┘                │
└─────────────────────────────────────────────────────────┘
                              │
                              ▼
                    ┌─────────────────┐
                    │  Risk Scoring   │
                    │  & Deduplication│
                    └─────────────────┘
```

### 7.2 规则系统

**实现位置**: `internal/audit/patterns.go`, `internal/audit/rules_list.go`

规则通过 YAML 配置，支持:
- 正则表达式匹配
- 严重级别分类
- 置信度评分
- 排除模式
- 预过滤器优化

### 7.3 数据流分析

**实现位置**: `internal/audit/dataflow.go`

追踪 shell 脚本中的污点传播:
- 识别 source（用户输入、环境变量）
- 追踪 through pipes 和重定向
- 检测 sink（网络请求、文件写入）

### 7.4 输出格式

- **终端输出**: 彩色格式化
- **JSON**: 机器可读
- **SARIF**: 静态分析结果交换格式
- **Markdown**: 文档友好

---

## 8. 命令参考

### 8.1 核心命令

| 命令 | 描述 |
|------|------|
| `skillshare init` | 初始化 skillshare |
| `skillshare install <source>` | 安装 skills/agents |
| `skillshare uninstall <name>` | 移除 skills/agents |
| `skillshare list` | 列出已安装的 skills |
| `skillshare sync` | 同步到目标 |
| `skillshare status` | 显示目标状态 |

### 8.2 Skill & Agent 管理

| 命令 | 描述 |
|------|------|
| `skillshare new <name>` | 创建新 skill |
| `skillshare enable <name>` | 启用 skill |
| `skillshare disable <name>` | 禁用 skill |
| `skillshare check` | 检查更新 |
| `skillshare update <name>` | 更新 skill |
| `skillshare upgrade` | 升级 CLI |

### 8.3 目标管理

| 命令 | 描述 |
|------|------|
| `skillshare target add <name>` | 添加目标 |
| `skillshare target remove <name>` | 移除目标 |
| `skillshare target list` | 列出目标 |
| `skillshare diff [target]` | 显示差异 |

### 8.4 同步 & 备份

| 命令 | 描述 |
|------|------|
| `skillshare collect [target]` | 收集本地 skills |
| `skillshare backup` | 创建备份 |
| `skillshare restore <target>` | 恢复备份 |
| `skillshare trash list` | 列出已删除的 skills |

### 8.5 Extras

| 命令 | 描述 |
|------|------|
| `skillshare extras init <name>` | 创建 extra |
| `skillshare extras list` | 列出 extras |
| `skillshare extras remove <name>` | 移除 extra |
| `skillshare extras collect <name>` | 收集 extra |

### 8.6 Git 远程

| 命令 | 描述 |
|------|------|
| `skillshare push` | 推送到远程 |
| `skillshare pull` | 从远程拉取 |

### 8.7 工具

| 命令 | 描述 |
|------|------|
| `skillshare audit` | 安全审计 |
| `skillshare hub <subcmd>` | Hub 管理 |
| `skillshare log` | 查看操作日志 |
| `skillshare ui` | 启动 Web UI |
| `skillshare doctor` | 诊断问题 |
| `skillshare completion <shell>` | 生成补全脚本 |

---

## 9. 安装方式

### 9.1 macOS / Linux

```bash
curl -fsSL https://raw.githubusercontent.com/runkids/skillshare/main/install.sh | sh
```

### 9.2 Windows PowerShell

```powershell
irm https://raw.githubusercontent.com/runkids/skillshare/main/install.ps1 | iex
```

### 9.3 Homebrew

```bash
brew install skillshare
```

### 9.4 GitHub Actions

```yaml
- uses: runkids/setup-skillshare@v1
  with:
    source: ./skills
- run: skillshare sync
```

### 9.5 升级

```bash
skillshare upgrade
```

---

## 10. 开发指南

### 10.1 环境要求

- Go 1.25.5+
- Node.js (用于 Web UI 开发)

### 10.2 构建

```bash
git clone https://github.com/runkids/skillshare.git
cd skillshare
make check  # 格式化 + lint + 测试
```

### 10.3 测试

```bash
# 运行所有测试
go test ./...

# 运行特定包的测试
go test ./internal/audit/...

# 运行集成测试
cd tests && go test ./...
```

### 10.4 Web UI 开发

```bash
cd ui
npm install
npm run dev
```

---

## 11. 设计决策

### 11.1 为什么选择 Go?

- **单二进制分发**: 无需运行时依赖
- **跨平台编译**: 支持 macOS、Linux、Windows
- **性能**: 快速的文件系统操作
- **标准库丰富**: 内置符号链接、文件操作支持

### 11.2 为什么使用符号链接?

- **零拷贝**: 不占用额外磁盘空间
- **实时同步**: 源文件修改立即生效
- **可逆操作**: 删除符号链接不影响源文件

### 11.3 为什么需要安全审计?

AI CLI 的 skills 本质上是 prompt，可能包含:
- **Prompt injection**: 诱导 AI 执行恶意操作
- **数据泄露**: 将敏感信息发送到外部
- **权限提升**: 执行危险的系统命令
- **代码混淆**: 隐藏恶意意图

---

## 12. 总结

Skillshare 是一个设计精良的 AI CLI skill 管理工具，具有以下优势:

1. **统一管理**: 一个源同步到所有目标
2. **安全优先**: 内置安全审计引擎
3. **灵活配置**: 支持多种同步模式和过滤规则
4. **团队友好**: 支持项目级和组织级配置
5. **本地优先**: 无外部依赖，完全离线工作
6. **跨平台**: 支持 macOS、Linux、Windows

项目代码结构清晰，测试覆盖完善，文档齐全，是一个高质量的开源项目。
