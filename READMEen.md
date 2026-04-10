# Claude Code Proxy

## Description
A proxy server that translates between **Anthropic Messages API** and **OpenAI Chat Completions API**, enabling Claude Code to work with Groq API and local models instead of the official Anthropic API.

Allows users to leverage Claude Code with:
- **Groq API** - Powerful, fast, and cheaper models than Anthropic
- **Local Models** - Via Ollama (runs offline, no internet required)
- **Web Dashboard** - Monitor requests and test models in real-time

---

## Features ✨

- ✅ **Groq API Support** - 4 different high-performance models
- ✅ **Local Model Support** - Ollama + LM Studio + vLLM
- ✅ **Web Dashboard** - Chat, request logs, settings, live statistics
- ✅ **Payload Compression** - Automatically fixes 413 errors
- ✅ **VS Code Integration** - Built-in tasks and debug configurations
- ✅ **Quick Launchers** - One-click batch files
- ✅ **Dark/Light Mode** - In the dashboard UI
- ✅ **Streaming Support** - Full SSE (Server-Sent Events) compatibility
- ✅ **Automatic Conversion** - Seamless Anthropic ↔ OpenAI protocol translation

---

## Model Mapping Table 🤖

| Claude Model | Groq Model | Speed | Price per 1M Tokens |
|-------------|-----------|-------|-----|
| `claude-opus-4` | `meta-llama/llama-4-scout-17b-16e-instruct` | **594 TPS** ⚡ | $0.11 / $0.34 |
| `claude-3-5-sonnet` | `llama-3.3-70b-versatile` | 394 TPS | $0.59 / $0.79 |
| `claude-3-5-haiku` | `llama-3.1-8b-instant` | **840 TPS** 🚀 | $0.05 / $0.08 |
| `claude-local-1b` | `llama3.2:1b` (local) | ∞ | Free |

**Best for coding**: `meta-llama/llama-4-scout` - 594 TPS + lowest cost 💰

---

## Installation & Setup 🚀

### Requirements
- Node.js 18+
- Groq API Key (get one from https://console.groq.com)
- Ollama (optional, for local models)

### Steps

**1. Clone the Repository**
```bash
git clone https://github.com/m07o/claude-code.git
cd claude-code
```

**2. Set Environment Variables**
```bash
set GROQ_API_KEY=your_actual_key_here
set LOCAL_MODEL_URL=http://localhost:11434/v1/chat/completions
set LOCAL_MODEL_NAME=llama3.2:1b
```

**3. Launch**
- **Windows**: Click `Start.bat`
- **Terminal**: `npm run proxy` or `node package/proxy.cjs`
- **VS Code**: `Ctrl+Shift+B` → "Start Proxy Server"

---

## Usage 💬

### Quick Launchers
| File | Purpose |
|------|---------|
| `Start.bat` | Launch the entire project |
| `Open-Terminal.bat` | Open VS Code |
| `Open-Dashboard.bat` | Open web dashboard |
| `Stop.bat` | Stop the proxy server |

### Command Line
```bash
npm run proxy          # Standard mode
npm run proxy:debug   # With full DEBUG logging
npm run proxy:test    # Health check
```

### VS Code Tasks
1. Press `Ctrl+Shift+B`
2. Select:
   - "Start Proxy Server" - Launch with production settings
   - "Start Proxy (Debug Mode)" - Launch with DEBUG=1
   - "Open Proxy Dashboard" - Open browser to dashboard
   - "Test Local Model" - Check local model connectivity

### Web Dashboard
- **URL**: http://localhost:3002/
- **Sections**:
  - 🎯 Dashboard - Real-time status & statistics
  - 💬 Chat - Test any model with full conversation history
  - 📊 Logs - Last 20 API requests with status codes
  - ⚙️ Settings - Manage models and configurations
  - 🤖 Models - View all available models and pricing

---

## Project Structure 📁

```
Open-ClaudeCode/
├── package/
│   ├── proxy.cjs              # Main proxy server (Node.js)
│   ├── cli.js                 # Anthropic CLI
│   ├── package.json           # npm scripts
│   └── ...
├── .vscode/
│   ├── tasks.json             # VS Code task definitions
│   └── launch.json            # Debug configurations
├── Start.bat                  # Launch script (Windows)
├── Stop.bat                   # Stop script (Windows)
├── Open-Terminal.bat          # Open VS Code
├── Open-Dashboard.bat         # Open dashboard
├── README.md                  # Arabic documentation
├── READMEen.md                # English documentation (this file)
└── package.json               # root package.json
```

---

## Troubleshooting 🔧

### Issue: 413 Payload Too Large
**Solution**: The proxy automatically compresses payloads (removes tools, truncates system prompt to 28KB).

### Issue: Connection refused
**Solution**: Verify the proxy is running:
```bash
curl http://localhost:3002/health
```

### Issue: model 'xxx' not found
**Solution**: Check available models in Ollama:
```bash
ollama list
```
Update `LOCAL_MODEL_NAME` in `proxy.cjs` with the correct name.

### Issue: Authentication error
**Solution**: Verify your `GROQ_API_KEY` is set:
```bash
echo %GROQ_API_KEY%
```
The output should show your API key (not empty).

### Issue: Local model not responding
**Solution**: Ensure Ollama is running:
```bash
ollama serve
```
Run in a separate terminal window.

---

## Available Commands 📝

### npm Scripts
```bash
npm run proxy              # Start the proxy
npm run proxy:debug        # Start with DEBUG logging
npm run proxy:test         # Test proxy health
```

### Manual Testing with curl
```bash
# Test local model
curl -X POST http://localhost:3002/v1/messages \
  -H "Content-Type: application/json" \
  -d '{"model":"claude-local-1b","max_tokens":50,"messages":[{"role":"user","content":"Hello"}]}'

# Test Groq API
curl -X POST http://localhost:3002/v1/messages \
  -H "Content-Type: application/json" \
  -d '{"model":"claude-opus-4","max_tokens":50,"messages":[{"role":"user","content":"Hello"}]}'

# Check health status
curl http://localhost:3002/health
```

---

## Ports & URLs 🌐

| Service | Address | Notes |
|---------|---------|-------|
| Proxy | `http://localhost:3002` | Messages API + Dashboard |
| Groq API | `https://api.groq.com` | External |
| Ollama | `http://localhost:11434` | Local (optional) |

---

## Technical Notes 🔬

- **Payload Compression**: Removes tool definitions, images, and tool_use blocks
- **Model Mapping**: Automatic translation from Claude model names to Groq models
- **Streaming**: Full SSE (Server-Sent Events) support
- **Local Models**: Supports Ollama + LM Studio + vLLM backends
- **Error Handling**: Converts Groq API errors to Anthropic format

---

## Project Info 👤

- **Author**: m07o
- **Repository**: https://github.com/m07o/claude-code
- **Branch**: dev (for new features)
- **License**: SEE ACKNOWLEDGEMENTS.md

---

## Need Help? 🆘

1. Check the [Issues](https://github.com/m07o/claude-code/issues) page
2. Review the [Troubleshooting](#troubleshooting-) section
3. Test with `curl` first before using Claude Code

---

**Last Updated**: 2026-04-10 ✅
