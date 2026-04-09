# Quick Start Guide - Anthropic ↔ OpenAI Proxy

Get your proxy running in 5 minutes.

## Step 1: Verify Your Setup

```bash
node verify-setup.js
```

Expected output:
```
✓ Node.js version
✓ proxy.js exists
✓ proxy.js has valid structure
✓ proxy.js is readable
✓ test-proxy.js exists
✓ Port 3000 available
⚠ GROQ_API_KEY set
  Set with: export GROQ_API_KEY=gsk_xxx
```

## Step 2: Set Your Groq API Key

```bash
# Linux/Mac
export GROQ_API_KEY=gsk_your_key_here

# Windows PowerShell
$env:GROQ_API_KEY = "gsk_your_key_here"

# Windows CMD
set GROQ_API_KEY=gsk_your_key_here
```

Get your key from: https://console.groq.com/

## Step 3: Start the Proxy

```bash
node proxy.js
```

Output:
```
╔════════════════════════════════════════════════════════════╗
║  Anthropic ↔ OpenAI/Groq Protocol Proxy                  ║
╚════════════════════════════════════════════════════════════╝

  Listening on http://localhost:3000

  Endpoints:
    POST /v1/messages     → Groq API (/openai/v1/chat/completions)

  Ready for connections...
```

## Step 4: Test in Another Terminal

```bash
node test-proxy.js
```

This runs 3 tests:
1. Simple text query ✓
2. Query with system prompt ✓
3. Streaming response ✓

## Using with Your Pre-Patched CLI

Your CLI is already configured to use the proxy. Simply run it as normal:

```bash
# Example command (depends on your CLI)
node ./package/cli.js --model claude-3-sonnet --message "Hello"
```

The CLI will:
1. Send requests to `http://localhost:3000` (not Anthropic API)
2. Use the Authorization header with your Groq key
3. Receive responses translated back to Anthropic format

## Common Configurations

### Run Proxy on Different Port

```bash
# Kill the current one first, then:
PORT=8000 node proxy.js

# Update CLI's redirect to http://localhost:8000
```

### Use with HTTP client (curl)

```bash
curl -X POST http://localhost:3000/v1/messages \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $GROQ_API_KEY" \
  -d '{
    "model": "claude-3-sonnet",
    "max_tokens": 256,
    "messages": [{
      "role": "user",
      "content": [{
        "type": "text",
        "text": "Hello from curl!"
      }]
    }],
    "stream": false
  }' | jq .
```

### Stream Results with jq

```bash
curl -X POST http://localhost:3000/v1/messages \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $GROQ_API_KEY" \
  -d '{
    "model": "claude-3-sonnet",
    "max_tokens": 256,
    "messages": [{
      "role": "user",
      "content": [{
        "type": "text",
        "text": "Count to 5"
      }]
    }],
    "stream": true
  }' | \
  sed 's/^data: //' | \
  jq -s . | jq '.[] | select(.type == "content_block_delta") | .delta.text' -r
```

## Troubleshooting

### "Cannot find module 'anthropic'"

This is expected and fine. The proxy uses only Node's built-in `http` and `https` modules—no dependencies.

### "ECONNREFUSED" in test

The proxy isn't running. Start it in another terminal:
```bash
node proxy.js
```

### "invalid api_key" error

Your Groq API key is invalid or expired. Check:
```bash
echo $GROQ_API_KEY
```

Should output: `gsk_xxxxxxx...`

### Port 3000 already in use

Find what's using port 3000:
```bash
# Linux/Mac
lsof -i :3000

# Windows
netstat -ano | findstr :3000
```

Either kill that process or use a different port:
```bash
PORT=3001 node proxy.js
```

## Flow Diagram

```
┌─────────────────────────┐
│ Your Pre-Patched CLI    │
└────────────┬────────────┘
             │
    POST http://localhost:3000/v1/messages
    Authorization: Bearer gsk_xxx
    Content: Anthropic format
             │
             ↓
    ┌───────────────────────┐
    │   This Proxy Server   │
    │                       │
    │ • Translates format   │
    │ • Routes to Groq API  │
    │ • Translates response │
    └────────────┬──────────┘
             │
             ↓
    ┌───────────────────────────────┐
    │ Groq API                      │
    │ (api.groq.com/openai/v1)      │
    └───────────────────────────────┘
             │
             ↓
    ┌───────────────────────────────────┐
    │ LLM Response (translated back)    │
    │ Anthropic format                  │
    └───────────────────────────────────┘
             │
             ↓
    ┌───────────────────────────────────┐
    │ Your Pre-Patched CLI (receives)   │
    │ Works normally with proxied model │
    └───────────────────────────────────┘
```

## Next Steps

- **Read full docs:** See `PROXY_README.md`
- **Customize models:** Edit `mapModel()` in `proxy.js`
- **Add logging:** `DEBUG=1 node proxy.js`
- **Production setup:** Using PM2, Docker, or systemd (see PROXY_README.md)

## Support

- **Port not responding?** → Start the proxy: `node proxy.js`
- **Authentication fails?** → Check GROQ_API_KEY: `echo $GROQ_API_KEY`
- **Strange responses?** → Run test: `node test-proxy.js`
- **More info?** → See `PROXY_README.md` for full documentation

---

**Enjoy your proxied LLM setup! 🚀**
