# Claude Code Proxy — Complete Reference Guide

> **Version**: v3.3 | **Last Updated**: 2026-04-24 | **Repository**: [github.com/m07o/claude-code](https://github.com/m07o/claude-code)

---

## Table of Contents

1. [Overview](#1-overview)
2. [Architecture & How It Works](#2-architecture--how-it-works)
3. [Supported Providers (8)](#3-supported-providers-8)
4. [Model Mappings](#4-model-mappings)
5. [Project Structure](#5-project-structure)
6. [Installation & Setup](#6-installation--setup)
7. [Configuration (.env)](#7-configuration-env)
8. [Batch Files Reference](#8-batch-files-reference)
9. [VS Code Integration](#9-vs-code-integration)
10. [OpenCode Integration](#10-opencode-integration)
11. [Third-Party Integrations](#11-third-party-integrations)
12. [Web Dashboard](#12-web-dashboard)
13. [API Endpoints](#13-api-endpoints)
14. [SSE Streaming Implementation](#14-sse-streaming-implementation)
15. [Payload Compression](#15-payload-compression)
16. [Testing & Troubleshooting](#16-testing--troubleshooting)
17. [Git Workflow](#17-git-workflow)
18. [proxy.cjs Source Code Reference](#18-proxycjs-source-code-reference)
19. [Changelog](#19-changelog)
20. [License & Credits](#20-license--credits)

---

## 1. Overview

Claude Code Proxy is a **universal AI proxy server** built in Node.js (zero dependencies) that translates between the **Anthropic Messages API** format and the **OpenAI Chat Completions API** format. This allows **Claude Code v2.1.88** (Anthropic's CLI coding assistant) to work with **any OpenAI-compatible AI provider** instead of the official paid Anthropic API.

### What It Does

- Claude Code sends requests in **Anthropic format** to `localhost:3002`
- The proxy translates them to **OpenAI format**
- Forwards to the selected provider (Groq, GitHub Models, Chinese AI, custom, or local)
- Translates responses back to **Anthropic format**
- Returns them to Claude Code, which works normally

### Key Features

- 8 provider backends (Groq, GitHub Models, Zhipu AI, MiniMax, Moonshot, Ollama Cloud, Custom, Local)
- Full SSE streaming support with `event:` lines
- Automatic payload compression (fixes 413 errors)
- Web dashboard with chat, logs, settings, model info
- VS Code tasks and debug configurations
- OpenCode integration
- Works with Cline, Continue.dev, Cursor, ChatBox, LibreChat, Open WebUI, Lobe Chat, and more
- Zero npm dependencies (uses only Node.js built-in modules)

---

## 2. Architecture & How It Works

```
┌─────────────────────────────────────────────────────────────────┐
│                        FLOW DIAGRAM                              │
└─────────────────────────────────────────────────────────────────┘

  Claude Code CLI                 Proxy Server                AI Provider
  (Anthropic format)        (localhost:3002)            (OpenAI format)
  ─────────────────          ──────────────            ────────────────
         │                         │                          │
         │  POST /v1/messages      │                          │
         │  {                      │                          │
         │    model: "claude-opus",│                          │
         │    system: "...",      │                          │
         │    messages: [...]      │                          │
         │  }                      │                          │
         │ ──────────────────────> │                          │
         │                         │   anthropicToOpenAI()     │
         │                         │   compressPayload()       │
         │                         │   mapModel()              │
         │                         │                          │
         │                         │  POST /v1/chat/completions│
         │                         │  {                       │
         │                         │    model: "llama-4...",   │
         │                         │    messages: [...]        │
         │                         │  }                       │
         │                         │ ────────────────────────> │
         │                         │                          │
         │                         │  SSE/JSON Response        │
         │                         │  (OpenAI format)          │
         │                         │ <──────────────────────── │
         │                         │                          │
         │                         │   openAIToAnthropic()     │
         │                         │   handleStreamResponse()  │
         │                         │                          │
         │  SSE/JSON Response      │                          │
         │  (Anthropic format)     │                          │
         │ <────────────────────── │                          │
         │                         │                          │
    Claude Code works normally ✓
```

### Key Translation Functions

| Function | Purpose |
|----------|---------|
| `anthropicToOpenAI()` | Converts Anthropic request → OpenAI request format |
| `openAIToAnthropic()` | Converts OpenAI response → Anthropic response format |
| `flattenAnthropicContent()` | Flattens Anthropic content arrays (text, tool_result, image blocks) to string |
| `mapModel()` | Maps Claude model names → provider model names |
| `compressPayload()` | Removes tools/images, truncates system prompt to prevent 413 errors |
| `translateOpenAIError()` | Converts OpenAI/Groq errors → Anthropic error format |
| `handleStreamResponse()` | Handles SSE streaming with per-request state |
| `convertOpenAIStreamEvent()` | Converts individual OpenAI SSE chunks → Anthropic SSE events |

---

## 3. Supported Providers (8)

### 1. Groq (Default)

- **URL**: `https://api.groq.com/openai/v1/chat/completions`
- **Models**: Llama 4 Scout, Llama 3.3 70B, Llama 3.1 8B, Qwen3 32B, Mixtral 8x7B
- **Pricing**: From $0.05/1M tokens (free tier available)
- **Speed**: Up to 840 TPS
- **Key**: `GROQ_API_KEY` (get from https://console.groq.com)
- **Config**: `PROVIDER=groq`

### 2. GitHub Models

- **URL**: `https://models.inference.ai.azure.com/chat/completions`
- **Models**: GPT-4o, GPT-4o-mini, Llama-3.3-70B-Instruct, Phi-3.5-mini-instruct, Mistral-7B-Instruct
- **Pricing**: Free with GitHub token (rate limited)
- **Key**: `GITHUB_MODELS_TOKEN` (get from GitHub Settings → Developer Settings → Personal Access Token)
- **Config**: `PROVIDER=github` + `GITHUB_MODELS_ENABLED=true`

### 3. Zhipu AI (Chinese AI)

- **URL**: `https://open.bigmodel.cn/api/paas/v4/chat/completions`
- **Models**: GLM-5, GLM-5.1
- **API Docs**: https://open.bigmodel.cn/dev/api
- **Key**: `ZHIPU_API_KEY` (get from https://open.bigmodel.cn/)
- **Config**: `PROVIDER=zhipu` + `ZHIPU_ENABLED=true`

### 4. MiniMax (Chinese AI)

- **URL**: `https://api.minimax.chat/v1/text/chatcompletion_v2`
- **Models**: MiniMax-Text-01, MiniMax-2.7
- **API Docs**: https://www.minimaxi.com/document/guides/chat-model
- **Key**: `MINIMAX_API_KEY` (get from https://www.minimaxi.com/)
- **Config**: `PROVIDER=minimax` + `MINIMAX_ENABLED=true`

### 5. Moonshot AI (Chinese AI)

- **URL**: `https://api.moonshot.cn/v1/chat/completions`
- **Models**: Kimi-K2-0711, Kimi-2.5
- **API Docs**: https://platform.moonshot.cn/docs/api/chat
- **Key**: `MOONSHOT_API_KEY` (get from https://platform.moonshot.cn/)
- **Config**: `PROVIDER=moonshot` + `MOONSHOT_ENABLED=true`

### 6. Ollama Cloud

- **URL**: `https://api.ollama.cloud/v1/chat/completions`
- **Models**: Any Ollama model (llama2, llama3, mistral, etc.)
- **API Docs**: https://ollama.com/blog/ollama-cloud
- **Key**: `OLLAMA_CLOUD_API_KEY` (get from https://ollama.com/)
- **Config**: `PROVIDER=ollama-cloud` + `OLLAMA_CLOUD_ENABLED=true`

### 7. Custom Provider (ANY OpenAI-compatible API)

- **URL**: User-defined (`CUSTOM_BASE_URL`)
- **Models**: Any models supported by the target API
- **Compatible with**: OpenRouter, Together AI, Fireworks, DeepInfra, OpenAI, Azure, any self-hosted server
- **Key**: `CUSTOM_API_KEY` (if required by target)
- **Config**: `PROVIDER=custom` + `CUSTOM_ENABLED=true`

### 8. Local Model (Ollama, LM Studio, vLLM)

- **URL**: `http://localhost:11434/v1/chat/completions` (default Ollama)
- **Models**: Any model installed locally (`ollama list` to see available)
- **Pricing**: Free, offline, unlimited
- **No API key required**
- **Config**: `PROVIDER=local` + `LOCAL_MODEL_ENABLED=true`

---

## 4. Model Mappings

### Groq Model Map (Default Provider)

| Claude Model Name | Mapped Groq Model | Speed | Price/1M Tokens |
|-------------------|-------------------|-------|-----------------|
| `claude-opus-4` | `meta-llama/llama-4-scout-17b-16e-instruct` | 594 TPS | $0.11 / $0.34 |
| `claude-opus-4-0` | `meta-llama/llama-4-scout-17b-16e-instruct` | 594 TPS | $0.11 / $0.34 |
| `claude-opus-4-20250514` | `meta-llama/llama-4-scout-17b-16e-instruct` | 594 TPS | $0.11 / $0.34 |
| `claude-3-opus` | `meta-llama/llama-4-scout-17b-16e-instruct` | 594 TPS | $0.11 / $0.34 |
| `claude-3-opus-latest` | `meta-llama/llama-4-scout-17b-16e-instruct` | 594 TPS | $0.11 / $0.34 |
| `claude-sonnet-4` | `llama-3.3-70b-versatile` | 394 TPS | $0.59 / $0.79 |
| `claude-sonnet-4-0` | `llama-3.3-70b-versatile` | 394 TPS | $0.59 / $0.79 |
| `claude-sonnet-4-20250514` | `llama-3.3-70b-versatile` | 394 TPS | $0.59 / $0.79 |
| `claude-3-7-sonnet-latest` | `llama-3.3-70b-versatile` | 394 TPS | $0.59 / $0.79 |
| `claude-3-7-sonnet-20250219` | `llama-3.3-70b-versatile` | 394 TPS | $0.59 / $0.79 |
| `claude-3-5-sonnet-latest` | `llama-3.3-70b-versatile` | 394 TPS | $0.59 / $0.79 |
| `claude-3-5-sonnet-20241022` | `llama-3.3-70b-versatile` | 394 TPS | $0.59 / $0.79 |
| `claude-3-5-sonnet` | `llama-3.3-70b-versatile` | 394 TPS | $0.59 / $0.79 |
| `claude-3-sonnet` | `llama-3.3-70b-versatile` | 394 TPS | $0.59 / $0.79 |
| `claude-haiku-4` | `llama-3.1-8b-instant` | 840 TPS | $0.05 / $0.08 |
| `claude-haiku-4-20250514` | `llama-3.1-8b-instant` | 840 TPS | $0.05 / $0.08 |
| `claude-3-5-haiku-latest` | `llama-3.1-8b-instant` | 840 TPS | $0.05 / $0.08 |
| `claude-3-5-haiku-20241022` | `llama-3.1-8b-instant` | 840 TPS | $0.05 / $0.08 |
| `claude-3-5-haiku` | `llama-3.1-8b-instant` | 840 TPS | $0.05 / $0.08 |
| `claude-3-haiku` | `llama-3.1-8b-instant` | 840 TPS | $0.05 / $0.08 |

### GitHub Models Map

| Claude Model Name | Mapped GitHub Model |
|-------------------|-------------------|
| `claude-opus-4` / `claude-3-opus` | `gpt-4o` |
| `claude-sonnet-4` / `claude-3-5-sonnet` | `Llama-3.3-70B-Instruct` |
| `claude-haiku-4` / `claude-3-5-haiku` | `Phi-3.5-mini-instruct` |

### Local Model Map

| Claude Model Name | Mapped Local Model |
|-------------------|-------------------|
| `claude-local-1b` | (value of `LOCAL_MODEL_NAME`, e.g., `llama3.2:1b`) |
| `local-model` | (value of `LOCAL_MODEL_NAME`) |
| `claude-3-haiku-local` | (value of `LOCAL_MODEL_NAME`) |

### Chinese / Custom Provider Behavior

For Zhipu, MiniMax, Moonshot, Ollama Cloud, and Custom providers, Claude model names are **passed through as-is**. The target provider determines which model handles the request.

---

## 5. Project Structure

```
claude-code/
├── .claude-plugin/
│   └── marketplace.json           # Claude plugin marketplace config
├── .opencode/
│   └── opencode.json              # OpenCode integration config
├── .vscode/
│   ├── launch.json                # VS Code debug configurations (2 configs)
│   └── tasks.json                 # VS Code build tasks (4 tasks)
├── examples/
│   ├── hooks/
│   │   └── bash_command_validator_example.py
│   └── settings/
│       ├── README.md
│       ├── settings-bash-sandbox.json
│       ├── settings-lax.json
│       └── settings-strict.json
├── package/
│   ├── .env                       # *** CONFIGURATION FILE (all provider settings)
│   ├── .gitignore                 # Prevents .env and node_modules from being committed
│   ├── proxy.cjs                  # *** MAIN PROXY SERVER (2169 lines, zero dependencies)
│   ├── cli.js                     # Claude Code CLI (Anthropic original)
│   ├── cli.js.backup              # Backup of original CLI
│   ├── cli.js.map                 # CLI source map
│   ├── package.json               # npm package info + scripts
│   ├── patch_bundle.cjs           # Auto-update patch script
│   ├── sdk-tools.d.ts             # TypeScript definitions
│   ├── bun.lock                   # Bun lock file
│   ├── LICENSE.md                 # Package license
│   ├── README.md                  # Package readme
│   └── vendor/                    # Binary dependencies (audio-capture, ripgrep)
├── plugins/                       # Claude Code plugins (official community plugins)
│   ├── README.md
│   ├── agent-sdk-dev/
│   ├── claude-opus-4-5-migration/
│   ├── code-review/
│   ├── commit-commands/
│   ├── explanatory-output-style/
│   ├── feature-dev/
│   ├── frontend-design/
│   ├── hookify/
│   ├── learning-output-style/
│   ├── plugin-dev/
│   ├── pr-review-toolkit/
│   ├── ralph-wiggum/
│   ├── security-guidance/
│   └── ...
├── src/                           # Claude Code source (TypeScript, reference only)
│   ├── bridge/
│   ├── commands/
│   ├── components/
│   ├── constants/
│   ├── hooks/
│   ├── ink/
│   ├── plugins/
│   ├── services/
│   └── ...
├── Start.bat                      # Start proxy server
├── Stop.bat                       # Stop proxy server (kill port 3002)
├── Open-Terminal.bat              # Open CMD terminal in project directory
├── Open-Dashboard.bat             # Open http://localhost:3002/ in browser
├── Open-VSCode.bat                # Open project in VS Code
├── Switch-Provider.bat            # Interactive menu to switch PROVIDER in .env
├── Set-ApiKey.bat                 # Interactive menu to set API key for any provider
├── Quick-Test.bat                 # Send test request to proxy
├── Status.bat                     # Show current provider, keys, local model info
├── Start-Claude-Terminal.bat      # Open terminal for Claude Code
├── Start-Claude-VSCode.bat        # Open project in VS Code for Claude Code
├── Merge-to-Main.bat              # Merge dev branch into main and push
├── README.md                      # Arabic documentation
├── READMEen.md                    # English documentation
├── QUICK_START.md                 # Quick start guide
├── SETUP-VSCODE.md                # VS Code setup guide (all providers)
├── SETUP-INTEGRATIONS.md          # Third-party integrations guide
├── CHANGELOG.md                   # Project changelog
├── LICENSE                        # MIT License
└── ACKNOWLEDGEMENTS.md            # Credits and attributions
```

---

## 6. Installation & Setup

### Prerequisites

- **Node.js 18+** — Download from https://nodejs.org/
- **Git** — For cloning the repository
- **API Key(s)** — For the provider(s) you want to use
- **Ollama** (optional) — For local models, download from https://ollama.ai/

### Step 1: Clone the Repository

```bash
git clone https://github.com/m07o/claude-code.git
cd claude-code
git checkout dev
```

### Step 2: Configure `~/.claude/settings.json`

Claude Code must point to the proxy instead of Anthropic's API. Edit `~/.claude/settings.json`:

```json
{
  "permissions": {
    "allow": []
  },
  "env": {
    "ANTHROPIC_BASE_URL": "http://localhost:3002",
    "ANTHROPIC_API_KEY": "any"
  }
}
```

**IMPORTANT**: The URL must be `http://localhost:3002` — do NOT add `/v1` (the proxy adds it automatically, adding it here causes a double-path bug: `/v1/v1/messages`).

### Step 3: Configure Provider in `.env`

Edit `package/.env` to set your provider and API key:

```env
# For Groq (free tier available):
PROVIDER=groq
GROQ_API_KEY=gsk_your_actual_key_here

# Or for GitHub Models (free):
# PROVIDER=github
# GITHUB_MODELS_ENABLED=true
# GITHUB_MODELS_TOKEN=ghp_your_token_here
```

### Step 4: Start the Proxy

**Windows (batch file):**
```
Double-click Start.bat
```

**Terminal:**
```bash
cd package
npm run proxy
```

**VS Code:**
```
Ctrl+Shift+B → "Start Proxy Server"
```

### Step 5: Verify

```bash
curl http://localhost:3002/health
```

Or open http://localhost:3002/ in your browser to see the dashboard.

### Step 6: Run Claude Code

```bash
claude
```

Claude Code will now send requests through the proxy to your chosen provider.

---

## 7. Configuration (.env)

The `package/.env` file controls all proxy settings. Here is the complete reference:

```env
# ============================================
# Claude Code Proxy - Configuration
# ============================================

# --- Proxy Server ---
PORT=3002                # Port to listen on
DEBUG=false              # Enable debug logging (true/false)
TIMEOUT=120000           # Request timeout in milliseconds

# --- Active Provider ---
# Options: groq, github, zhipu, minimax, moonshot, ollama-cloud, custom, local
PROVIDER=groq

# --- Token Limits ---
# 0 = unlimited (model uses full context window)
# Any positive number = default max_tokens when request doesn't specify
MAX_TOKENS=0

# ============================================
# GROQ (Free tier available)
# ============================================
GROQ_API_KEY=your_groq_api_key_here
DEFAULT_MODEL=meta-llama/llama-4-scout-17b-16e-instruct

# ============================================
# GITHUB MODELS (Free with GitHub token)
# ============================================
GITHUB_MODELS_TOKEN=your_github_token_here
GITHUB_MODELS_ENABLED=false

# ============================================
# CUSTOM PROVIDER (ANY OpenAI-compatible API)
# ============================================
CUSTOM_ENABLED=false
CUSTOM_API_KEY=your_api_key_here
CUSTOM_BASE_URL=https://api.example.com/v1/chat/completions
CUSTOM_DEFAULT_MODEL=your-default-model-name

# ============================================
# ZHIPU AI (GLM-5, GLM-5.1)
# ============================================
ZHIPU_API_KEY=your_zhipu_api_key_here
ZHIPU_ENABLED=false
ZHIPU_BASE_URL=https://open.bigmodel.cn/api/paas/v4/chat/completions
ZHIPU_DEFAULT_MODEL=glm-5

# ============================================
# MINIMAX (MiniMax-Text-01, MiniMax-2.7)
# ============================================
MINIMAX_API_KEY=your_minimax_api_key_here
MINIMAX_ENABLED=false
MINIMAX_BASE_URL=https://api.minimax.chat/v1/text/chatcompletion_v2
MINIMAX_DEFAULT_MODEL=MiniMax-Text-01

# ============================================
# MOONSHOT AI (Kimi-K2, Kimi-2.5)
# ============================================
MOONSHOT_API_KEY=your_moonshot_api_key_here
MOONSHOT_ENABLED=false
MOONSHOT_BASE_URL=https://api.moonshot.cn/v1/chat/completions
MOONSHOT_DEFAULT_MODEL=kimi-k2-0711-chat

# ============================================
# OLLAMA CLOUD
# ============================================
OLLAMA_CLOUD_ENABLED=false
OLLAMA_CLOUD_API_KEY=your_ollama_cloud_api_key_here
OLLAMA_CLOUD_BASE_URL=https://api.ollama.cloud/v1/chat/completions
OLLAMA_CLOUD_DEFAULT_MODEL=llama2

# ============================================
# LOCAL MODEL (Ollama, LM Studio, vLLM)
# ============================================
LOCAL_MODEL_ENABLED=true
LOCAL_MODEL_URL=http://localhost:11434/v1/chat/completions
LOCAL_MODEL_NAME=llama3.2:1b
```

### Environment Variable Priority

1. **System environment variables** (highest priority) — Set via OS or terminal
2. **`.env` file values** — Loaded at startup, only if system env var is not set
3. **Default values in code** — Used if neither system env nor .env has the value

---

## 8. Batch Files Reference

All batch files are in the project root directory. They work by reading/modifying `package/.env`.

| File | Purpose | Usage |
|------|---------|-------|
| `Start.bat` | Start the proxy server | Double-click or run from CMD |
| `Stop.bat` | Kill the proxy process on port 3002 | Double-click |
| `Open-Terminal.bat` | Open a CMD window in the project directory | Double-click |
| `Open-Dashboard.bat` | Open http://localhost:3002/ in default browser | Double-click |
| `Open-VSCode.bat` | Open the project in VS Code | Double-click |
| `Switch-Provider.bat` | Interactive menu: select from 8 providers, updates `.env` | Double-click |
| `Set-ApiKey.bat` | Interactive menu: enter API key for any of 7 providers | Double-click |
| `Quick-Test.bat` | Sends a test POST request to the proxy | Double-click |
| `Status.bat` | Shows current provider, API keys (masked), local model, port | Double-click |
| `Start-Claude-Terminal.bat` | Opens CMD for running Claude Code | Double-click |
| `Start-Claude-VSCode.bat` | Opens VS Code with Cline setup instructions | Double-click |
| `Merge-to-Main.bat` | Merges dev branch into main and pushes to GitHub (asks confirmation) | Double-click |

### Switch-Provider.bat Walkthrough

1. Displays current provider (reads `PROVIDER=` from `.env`)
2. Shows 8 options:
   ```
   1. Groq (free tier)
   2. GitHub Models (free)
   3. Zhipu AI (GLM-5, GLM-5.1)
   4. MiniMax (MiniMax-2.7)
   5. Moonshot (Kimi-2.5)
   6. Ollama Cloud
   7. Custom (any API)
   8. Local (Ollama on this machine)
   ```
3. User selects a number
4. Uses PowerShell to update `PROVIDER=` line in `.env`
5. Shows confirmation and reminds to restart proxy

### Set-ApiKey.bat Walkthrough

1. Shows 7 provider options (1-7)
2. User enters API key
3. Uses PowerShell to update the corresponding key line in `.env`
4. Reminds to restart proxy

---

## 9. VS Code Integration

### tasks.json (4 Tasks)

Located at `.vscode/tasks.json`:

1. **Start Proxy Server** — Runs `node proxy.cjs` in background, waits for "Ready for connections" message
2. **Start Proxy (Debug Mode)** — Same as above but with `DEBUG=1`
3. **Open Proxy Dashboard** — Opens http://localhost:3002/ in browser
4. **Test Local Model** — Sends a test curl request for `claude-local-1b`

All tasks set `cwd` to `${workspaceFolder}/package` and inherit `GROQ_API_KEY` from environment.

**Usage**: Press `Ctrl+Shift+B` in VS Code, then select a task.

### launch.json (2 Configs)

Located at `.vscode/launch.json`:

1. **Debug Proxy Server** — Launch with `DEBUG=1`, integrated terminal, breakpoint support
2. **Run Proxy (Production)** — Launch with `DEBUG=0`, integrated terminal

**Usage**: Press `F5` in VS Code to start debugging.

---

## 10. OpenCode Integration

The file `.opencode/opencode.json` configures OpenCode to use the proxy:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "provider": {
    "claude-proxy": {
      "npm": "@ai-sdk/anthropic",
      "name": "Claude Code Proxy",
      "options": {
        "baseURL": "http://localhost:3002",
        "apiKey": "any"
      },
      "models": {
        "claude-opus-4": {
          "name": "Claude Opus (via Proxy)",
          "attachment": true,
          "reasoning": true
        },
        "claude-sonnet-4-20250514": {
          "name": "Claude Sonnet 4 (via Proxy)",
          "attachment": true,
          "reasoning": true
        },
        "claude-haiku-4": {
          "name": "Claude Haiku (via Proxy)",
          "attachment": true
        },
        "claude-local-1b": {
          "name": "Local Model (via Proxy)"
        }
      }
    }
  },
  "model": "claude-proxy/claude-sonnet-4-20250514",
  "small_model": "claude-proxy/claude-haiku-4"
}
```

To use: run `opencode` in the project folder after the proxy is running.

---

## 11. Third-Party Integrations

Base URL for all integrations: **http://localhost:3002**

### Code Editors

| Tool | How to Configure |
|------|-----------------|
| **VS Code + Cline** | Install "Cline" extension → Settings → Provider: Anthropic → API Key: `any` → Base URL: `http://localhost:3002` |
| **VS Code + Continue.dev** | Install "Continue" extension → gear icon → add model with `apiBase: http://localhost:3002` |
| **Cursor IDE** | Settings → Models → Base URL: `http://localhost:3002` → API Key: `any` |
| **Windsurf** | Settings → AI → Custom Provider → Base URL: `http://localhost:3002` |
| **JetBrains (IntelliJ, PyCharm)** | AI Assistant → Custom Model → Base URL: `http://localhost:3002` |

### Terminal Tools

| Tool | Command |
|------|---------|
| **Claude Code CLI** | Already configured via `~/.claude/settings.json` pointing to localhost:3002 |
| **Aider** | `aider --anthropic-api-base http://localhost:3002` |

### Desktop Apps

| Tool | Configuration |
|------|--------------|
| **ChatBox** | Settings → Anthropic → API Key: `any` → Host: `http://localhost:3002` |
| **Jan AI** | Settings → Local API → URL: `http://localhost:3002` |

### Web Apps (Self-Hosted)

| Tool | Configuration |
|------|--------------|
| **LibreChat** | Admin → Anthropic → Base URL: `http://localhost:3002` |
| **Open WebUI** | Settings → Connections → OpenAI → URL: `http://localhost:3002` → Key: `any` |
| **Lobe Chat** | Settings → Anthropic → API Key: `any` → Proxy URL: `http://localhost:3002` |

---

## 12. Web Dashboard

Access at: **http://localhost:3002/** (or http://localhost:3002/ui)

### Sections

1. **Dashboard** — Status cards for all 9 providers (Groq, GitHub, Custom, Zhipu, Minimax, Moonshot, Ollama Cloud, Local, + total requests) + real-time statistics (successful, errors, avg response time, total tokens)
2. **Chat** — Send messages to any model through the proxy with full conversation history, model selector, timing, and token count
3. **Logs** — Table of last 20 API requests with time, model, status code, response time, and token count
4. **Settings** — View and change configuration (active provider, default model, local model URL/name, custom provider settings, environment variables)
5. **Models** — Table of available Groq models with context window, speed, pricing, and best-use tags

### Dashboard Features

- Dark/light mode toggle
- Auto health check every 30 seconds
- Real-time stats updates
- Mobile-friendly responsive layout
- Animated status indicators

---

## 13. API Endpoints

| Method | Path | Purpose | Response |
|--------|------|---------|----------|
| `GET` | `/` | Web Dashboard | HTML page |
| `GET` | `/ui` | Web Dashboard (alias) | HTML page |
| `GET` | `/health` | Health check for all providers | JSON with status for each provider |
| `POST` | `/v1/messages` | Main API endpoint (Anthropic format) | JSON or SSE stream (Anthropic format) |
| `POST` | `/v1/messages/count_tokens` | Token counting stub | `{"input_tokens": 0, "completion_tokens": 0}` |
| `GET` | `/v1/models` | Available models list | JSON array of model objects |

### Health Check Response Format

```json
{
  "proxy": "running",
  "port": 3002,
  "groq_api": "connected",
  "github_models": "unreachable",
  "custom_provider": "disabled",
  "zhipu_ai": "disabled",
  "minimax": "disabled",
  "moonshot_ai": "disabled",
  "ollama_cloud": "disabled",
  "local_model": "connected"
}
```

Values: `connected`, `unreachable`, `disabled`, `not_configured`, `error_XXX`

---

## 14. SSE Streaming Implementation

The proxy implements full Anthropic SSE streaming. Each streaming connection has its own local state (no global state issues).

### SSE Event Types

The proxy sends these SSE events (all include the `event:` prefix line):

```
event: message_start
data: {"type":"message_start","message":{"id":"msg_xxx","type":"message","role":"assistant","content":[],"model":"claude-opus-4","stop_reason":null,"usage":{"input_tokens":0,"output_tokens":0}}}

event: content_block_start
data: {"type":"content_block_start","index":0,"content_block":{"type":"text","text":""}}

event: content_block_delta
data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"Hello"}}

event: content_block_stop
data: {"type":"content_block_stop","index":0}

event: message_delta
data: {"type":"message_delta","delta":{"stop_reason":"end_turn","stop_sequence":null},"usage":{"output_tokens":42}}

event: message_stop
data: {"type":"message_stop"}

event: ping
data: {"type":"ping"}
```

### Keep-Alive

A ping event is sent every **15 seconds** to keep the connection alive.

### Stream State

Each streaming request has its own `streamState` object:

```javascript
{
  blockStarted: false,    // Has content_block_start been sent?
  blockStopped: false,    // Has content_block_stop been sent?
  outputTokens: 0,        // Running token count
  stopReason: 'end_turn', // Mapped from OpenAI finish_reason
  finish_reason: null      // Raw OpenAI finish_reason
}
```

### OpenAI → Anthropic Stop Reason Mapping

| OpenAI `finish_reason` | Anthropic `stop_reason` |
|------------------------|------------------------|
| `stop` | `end_turn` |
| `length` | `max_tokens` |
| `content_filter` | `end_turn` |
| `function_call` | `tool_use` |
| `tool_calls` | `tool_use` |

---

## 15. Payload Compression

The `compressPayload()` function prevents **413 Payload Too Large** errors from Groq and other providers with size limits. Claude Code sends ~30KB system prompts which exceed provider limits.

### What It Removes

1. **Tool definitions** — `tools` and `tool_choice` fields deleted entirely
2. **Images** — Any content blocks with `type: "image"` are filtered out
3. **Tool use/result blocks** — `tool_use` and `tool_result` blocks are filtered from messages
4. **System prompt truncation** — If system message > 28,000 characters, truncated to 28K with `[System prompt truncated by proxy]` appended
5. **Empty messages** — Messages with empty content (after filtering) are removed

### Compression Rate

Typical Claude Code request: ~30KB → After compression: ~3KB (**~90% reduction**)

---

## 16. Testing & Troubleshooting

### Quick Health Check

```bash
curl http://localhost:3002/health
```

### Test Non-Streaming (Groq)

```bash
curl -X POST http://localhost:3002/v1/messages \
  -H "Content-Type: application/json" \
  -H "x-api-key: test" \
  -d '{"model":"claude-opus-4","max_tokens":50,"messages":[{"role":"user","content":"Say hello"}],"stream":false}'
```

### Test Streaming (Groq)

```bash
curl -X POST http://localhost:3002/v1/messages \
  -H "Content-Type: application/json" \
  -H "x-api-key: test" \
  -d '{"model":"claude-opus-4","max_tokens":50,"messages":[{"role":"user","content":"Count to 5"}],"stream":true}'
```

### Test Local Model

```bash
curl -X POST http://localhost:3002/v1/messages \
  -H "Content-Type: application/json" \
  -d '{"model":"claude-local-1b","max_tokens":50,"messages":[{"role":"user","content":"Hello"}]}'
```

### npm Scripts

```bash
npm run proxy          # Start proxy normally
npm run proxy:debug    # Start with DEBUG=1 (verbose logging)
npm run proxy:test     # Quick health check
```

### Common Issues & Fixes

| Issue | Cause | Fix |
|-------|-------|-----|
| **413 Payload Too Large** | System prompt too large for Groq | Automatically handled by `compressPayload()`. If still failing, reduce MAX_TOKENS or check system prompt size |
| **Connection refused** | Proxy not running | Run `Start.bat` or `npm run proxy` |
| **/v1/v1/ double path** | `~/.claude/settings.json` has `/v1` in URL | Remove `/v1` from `ANTHROPIC_BASE_URL` — must be just `http://localhost:3002` |
| **Model 'xxx' not found** | Model name not in MODEL_MAP | For local: run `ollama list` and update `LOCAL_MODEL_NAME`. For Groq: check available models at console.groq.com |
| **401 Unauthorized** | API key missing or invalid | Check API key in `.env`. Run `Status.bat` to verify keys are set |
| **Local model not responding** | Ollama not running | Run `ollama serve` in a separate terminal |
| **SyntaxError on line XXX** | Code corruption in proxy.cjs | Re-download from GitHub `dev` branch |
| **Models not responding in dashboard** | Missing `event:` lines in SSE | Fixed in current version — ensure you're on latest `dev` branch |
| **Authentication error** | Groq API key invalid | Regenerate key at https://console.groq.com |
| **Timeout errors** | Provider too slow | Increase `TIMEOUT` in `.env` (default: 120000ms = 2 minutes) |
| **Port 3002 already in use** | Another process using the port | Change `PORT=3003` in `.env`, or run `Stop.bat` first |

---

## 17. Git Workflow

### Branch Structure

- **`main`** — Stable releases only, updated via merge from dev
- **`dev`** — Active development, all new features go here first

### Typical Workflow

```bash
# Work on dev branch
git checkout dev
git pull origin dev

# Make changes, test, then commit
git add -A
git commit -m "feat: description of changes"
git push origin dev

# When ready to release, merge to main
git checkout main
git pull origin main
git merge dev
git push origin main
```

### Or use the batch file:

```
Double-click Merge-to-Main.bat
```

This will: switch to main → pull → merge dev → push (asks for confirmation first).

### Current Branch Status

As of 2026-04-24:
- `dev` is ahead of `main` by 1 commit (`.opencode/opencode.json` + `SETUP-INTEGRATIONS.md`)
- `main` is behind `dev` — needs merge

---

## 18. proxy.cjs Source Code Reference

The main proxy server is in `package/proxy.cjs` — a single 2169-line CommonJS file with **zero npm dependencies**.

### Code Organization (by section)

| Lines | Section | Description |
|-------|---------|-------------|
| 1-10 | Header comment | Version, features list, flow description |
| 12-56 | .env loader | Reads and parses `.env` file, sets `process.env` variables |
| 58-82 | Configuration constants | PORT, DEBUG, TIMEOUT, DEFAULT_MODEL, all provider configs |
| 84-157 | Model mappings | `MODEL_MAP`, `GITHUB_MODEL_MAP`, `LOCAL_MODEL_MAP` |
| 159-420 | Dashboard HTML | Full web dashboard (HTML + CSS + JS) embedded as template string |
| 422-435 | Error type mapping | `GROQ_TO_ANTHROPIC_ERROR_TYPE` object |
| 437-495 | `compressPayload()` | Removes tools, images, truncates system prompt |
| 497-630 | Translation functions | `anthropicToOpenAI()`, `flattenAnthropicContent()`, `mapModel()`, `isLocalModel()`, `openAIToAnthropic()`, `mapStopReason()`, `translateOpenAIError()`, `generateMessageId()`, `estimateTokens()` |
| 632-730 | HTTP request handling | `handleRequest()` — routes all incoming requests |
| 732-780 | `forwardRequest()` | Routes to correct provider backend |
| 782-850 | `forwardToLocalModel()` | HTTP request to local Ollama/LM Studio/vLLM |
| 852-940 | `forwardToGroq()` | HTTP request to Groq API |
| 942-1000 | `handleNonStreamResponse()` | Collects full response, converts to Anthropic format |
| 1002-1070 | `forwardToGitHub()` | HTTP request to GitHub Models API |
| 1072-1170 | `forwardToCustom()` | HTTP request to any OpenAI-compatible API |
| 1172-1300 | `forwardToChinese()` | HTTP request to Zhipu/Minimax/Moonshot |
| 1302-1520 | `handleStreamResponse()` | SSE streaming with per-request state, ping interval |
| 1522-1600 | `convertOpenAIStreamEvent()` | Converts individual OpenAI SSE chunks → Anthropic SSE events |
| 1602-1670 | Server startup | Creates HTTP server, startup banner, graceful shutdown |

### Key Design Decisions

1. **Zero dependencies** — Only uses Node.js built-in modules (`http`, `https`, `fs`, `path`, `url`)
2. **Per-request stream state** — Each SSE stream has its own `streamState` object, avoiding global state bugs
3. **Env vars override .env** — System environment variables always take priority over `.env` file
4. **Provider routing** — Single `PROVIDER` variable determines which backend receives requests
5. **Local model priority** — Local model mappings are checked first, regardless of PROVIDER setting
6. **Pass-through for Chinese/Custom** — These providers receive Claude model names as-is, letting the provider handle mapping
7. **Embedded dashboard** — The entire HTML dashboard is a template string in the JS file, served at `/`

### npm Scripts (from package.json)

```json
{
  "scripts": {
    "proxy": "node proxy.cjs",
    "proxy:debug": "DEBUG=1 node proxy.cjs",
    "proxy:test": "node -e \"const http = require('http'); http.get('http://localhost:3002/health', (r) => { console.log('OK'); process.exit(0); }).on('error', () => { console.error('FAIL'); process.exit(1); })\""
  }
}
```

---

## 19. Changelog

### v2.1.88-dev (2026-04-23) — Latest

**Added:**
- OpenCode integration (`.opencode/opencode.json`)
- Third-party integrations guide (`SETUP-INTEGRATIONS.md`)
- Ollama Cloud provider support
- Chinese AI providers: Zhipu AI (GLM-5, GLM-5.1), MiniMax (MiniMax-2.7), Moonshot (Kimi-2.5)
- Custom provider for any OpenAI-compatible API
- Utility batch files: Switch-Provider, Set-ApiKey, Quick-Test, Status, Merge-to-Main
- .env configuration file with all provider settings

**Fixed:**
- SSE streaming — added `event:` prefix to all SSE event types
- System prompt array handling — flattened from array of content blocks to string
- Open-Terminal.bat — fixed from opening VS Code to opening CMD
- `/v1/v1/` double path — settings.json must NOT include `/v1`
- 413 Payload Too Large — automatic compression removes tools, images, truncates system prompt

### v2.1.88-dev (2026-04-10)

**Added:**
- Groq API support with SSE streaming
- Local model support via Ollama
- Web dashboard (chat, logs, settings, models, dark mode)
- VS Code integration (tasks.json, launch.json)
- Payload compression
- Batch launchers (Start, Stop, Open-Dashboard)
- Arabic + English documentation

### v2.1.88 (2026-04-01)

- Initial release — Claude Code v2.1.88 base
- Auth bypass modifications
- Basic proxy framework

---

## 20. License & Credits

### License

MIT License — see `LICENSE` file.

- Original work: Anthropic PBC
- Modified work: 2026 m07o

### Credits

| Project | Used For |
|---------|----------|
| **Anthropic — Claude Code** | Base CLI, protocol specifications |
| **Groq** | Primary LLM backend, fast inference |
| **Meta — Llama Models** | Model backbone (Llama 4 Scout, 3.3 70B, 3.1 8B) |
| **Alibaba — Qwen Models** | Alternative model option on Groq |
| **Ollama** | Local model serving |
| **OpenAI** | Chat Completions API reference format |
| **Node.js** | Server runtime |

### Repository

- **GitHub**: https://github.com/m07o/claude-code
- **Branch**: `dev` (active development)
- **Issues**: https://github.com/m07o/claude-code/issues
- **Discussions**: https://github.com/m07o/claude-code/discussions

---

## Quick Reference Card

```
┌──────────────────────────────────────────────────────────────┐
│                  CLAUDE CODE PROXY — QUICK REFERENCE          │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  Start:      Start.bat  or  npm run proxy                    │
│  Stop:       Stop.bat                                        │
│  Dashboard:  http://localhost:3002/                          │
│  Health:     curl http://localhost:3002/health               │
│  Port:       3002 (configurable in .env)                     │
│  Config:     package/.env                                    │
│  Settings:   ~/.claude/settings.json → localhost:3002        │
│                                                              │
│  Providers:  groq | github | zhipu | minimax | moonshot |    │
│              ollama-cloud | custom | local                   │
│                                                              │
│  Switch:     Switch-Provider.bat                             │
│  Set Key:    Set-ApiKey.bat                                  │
│  Test:       Quick-Test.bat                                  │
│  Status:     Status.bat                                      │
│  Merge:      Merge-to-Main.bat                               │
│                                                              │
│  Claude Code: claude  (after proxy is running)              │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```
