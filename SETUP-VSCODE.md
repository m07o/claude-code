# VS Code Setup Guide

Quick setup guide for using Claude Code Proxy in VS Code.

## Prerequisites

- Node.js 18+ ([Download](https://nodejs.org/))
- Git (for cloning the repo)
- VS Code (any recent version)

## Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/Open-ClaudeCode.git
   cd Open-ClaudeCode
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment**
   - Copy `.env.example` to `package/.env` (if needed)
   - Edit `package/.env` and add your API keys

## Quick Start

### Option 1: Use Batch Files (Windows)

- **Start Proxy**: Double-click `Start.bat`
- **Open Dashboard**: Double-click `Open-Dashboard.bat`
- **Stop Proxy**: Double-click `Stop.bat`

### Option 2: Use Terminal

```bash
cd package
npm run proxy
```

Then open: http://localhost:3002

## Configuration

Edit `package/.env` to select your provider:

### Groq (Default, Free tier available)
```env
PROVIDER=groq
GROQ_API_KEY=your_key_here
DEFAULT_MODEL=meta-llama/llama-4-scout-17b-16e-instruct
```

### GitHub Models (Free with GitHub token)
```env
PROVIDER=github
GITHUB_MODELS_ENABLED=true
GITHUB_MODELS_TOKEN=your_token_here
GITHUB_MODELS_ENABLED=false
```

### OpenAI (Direct or via Custom Provider)
```env
PROVIDER=custom
CUSTOM_ENABLED=true
CUSTOM_API_KEY=sk-...
CUSTOM_BASE_URL=https://api.openai.com/v1/chat/completions
CUSTOM_DEFAULT_MODEL=gpt-4o
```

### Zhipu AI (GLM-5, GLM-5.1)
```env
PROVIDER=zhipu
ZHIPU_ENABLED=true
ZHIPU_API_KEY=your_key_here
ZHIPU_BASE_URL=https://open.bigmodel.cn/api/paas/v4/chat/completions
ZHIPU_DEFAULT_MODEL=glm-5
```

### Minimax (MiniMax-2.7)
```env
PROVIDER=minimax
MINIMAX_ENABLED=true
MINIMAX_API_KEY=your_key_here
MINIMAX_BASE_URL=https://api.minimax.chat/v1/text/chatcompletion_v2
MINIMAX_DEFAULT_MODEL=MiniMax-Text-01
```

### Moonshot AI (Kimi-2.5)
```env
PROVIDER=moonshot
MOONSHOT_ENABLED=true
MOONSHOT_API_KEY=your_key_here
MOONSHOT_BASE_URL=https://api.moonshot.cn/v1/chat/completions
MOONSHOT_DEFAULT_MODEL=kimi-k2-0711-chat
```

### Ollama Cloud
```env
PROVIDER=ollama-cloud
OLLAMA_CLOUD_ENABLED=true
OLLAMA_CLOUD_API_KEY=your_key_here
OLLAMA_CLOUD_BASE_URL=https://api.ollama.cloud/v1/chat/completions
OLLAMA_CLOUD_DEFAULT_MODEL=llama2
```

### Local Model (Ollama, LM Studio, vLLM)
```env
PROVIDER=local
LOCAL_MODEL_ENABLED=true
LOCAL_MODEL_URL=http://localhost:11434/v1/chat/completions
LOCAL_MODEL_NAME=llama3.2:1b
```

## Using with Claude Code CLI

Once the proxy is running, point your Claude CLI to it:

```bash
export ANTHROPIC_API_URL=http://localhost:3002
export ANTHROPIC_API_KEY=test-key
claude <your command>
```

Or in Windows (PowerShell):
```powershell
$env:ANTHROPIC_API_URL = "http://localhost:3002"
$env:ANTHROPIC_API_KEY = "test-key"
claude <your command>
```

## Dashboard

Access the web dashboard at: **http://localhost:3002**

Features:
- Status overview of all providers
- Real-time health checks
- Model tester (send requests directly)
- Request logs
- Provider configuration view

## Troubleshooting

### Port Already in Use
If port 3002 is already in use:
```env
PORT=3003
```

### Provider Connection Failed
Check:
1. API key is correct (set in `.env`)
2. Provider is enabled (e.g., `GITHUB_MODELS_ENABLED=true`)
3. Internet connection
4. API endpoint is accessible

### CORS Issues
The proxy handles CORS automatically. If issues persist, check the proxy logs for details.

### Local Model Not Connecting
Make sure Ollama is running:
```bash
ollama serve
```

Then test with:
```bash
curl http://localhost:11434/v1/chat/completions
```

## Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `PORT` | Server port | `3002` |
| `DEBUG` | Enable debug logging | `true` or `false` |
| `PROVIDER` | Active provider | `groq`, `github`, `custom`, `zhipu`, `minimax`, `moonshot`, `ollama-cloud`, `local` |
| `TIMEOUT` | Request timeout (ms) | `120000` |
| `MAX_TOKENS` | Default token limit (0=unlimited) | `0` or `4096` |

## API Endpoints

- `GET /` - Web Dashboard
- `GET /health` - Health check (JSON)
- `POST /v1/messages` - Chat completions (Anthropic format)
- `GET /v1/models` - Available models

## Support & Resources

- **GitHub**: [Open-ClaudeCode](https://github.com/yourusername/Open-ClaudeCode)
- **Issues**: Report bugs on GitHub Issues
- **Documentation**: See README.md for full documentation

## License

MIT
