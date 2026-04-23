# Claude Code Proxy — Integrations

Connect any AI tool to your proxy. Base URL: **http://localhost:3002**

## Code Editors

### VS Code + Cline
1. Install "Cline" extension from Marketplace
2. Open Cline → Settings → Provider: Anthropic → API Key: `any` → Base URL: `http://localhost:3002`

### VS Code + Continue.dev
1. Install "Continue" extension
2. Open Continue → gear icon → add model with apiBase: `http://localhost:3002`

### Cursor IDE
Settings → Models → Base URL: `http://localhost:3002` → API Key: `any`

### Windsurf
Settings → AI → Custom Provider → Base URL: `http://localhost:3002`

### OpenCode
Already configured in `.opencode/opencode.json`. Run `opencode` in the project folder.

### JetBrains (IntelliJ, PyCharm)
AI Assistant → Custom Model → Base URL: `http://localhost:3002`

## Terminal Tools

### Claude Code CLI
Already configured via `~/.claude/settings.json` pointing to localhost:3002

### Aider
`aider --anthropic-api-base http://localhost:3002`

## Desktop Apps

### ChatBox
Settings → Anthropic → API Key: `any` → Host: `http://localhost:3002`

### Jan AI
Settings → Local API → URL: `http://localhost:3002`

## Web Apps (Self-Hosted)

### LibreChat
Admin → Anthropic → Base URL: `http://localhost:3002`

### Open WebUI
Settings → Connections → OpenAI → URL: `http://localhost:3002` → Key: `any`

### Lobe Chat
Settings → Anthropic → API Key: `any` → Proxy URL: `http://localhost:3002`

## Switching Providers

Edit `package/.env` and change `PROVIDER=groq|github|zhipu|minimax|moonshot|ollama-cloud|custom|local`
Then restart the proxy.

## Common Issues

- **Connection refused**: Proxy not running. Start it with `Start.bat`
- **413 Payload Too Large**: Should be auto-fixed by compressPayload
- **Model not found**: Check model name in .env
- **401 Unauthorized**: API key missing or invalid in .env
