# Anthropic ↔ OpenAI/Groq Protocol Proxy

A robust Node.js proxy server that bridges the **Anthropic API protocol** with the **OpenAI/Groq API protocol**. This enables clients using Anthropic's API format to transparently communicate with Groq (or OpenAI-compatible) models.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                   Client/CLI (Anthropic)                    │
│                                                              │
│ Sends: POST /v1/messages                                   │
│   • Anthropic message format                               │
│   • Authorization: Bearer <groq-key>                       │
│   • System prompt as top-level field                       │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│              Proxy Server (localhost:3000)                  │
│                                                              │
│  • Translates Anthropic → OpenAI format                    │
│  • Flattens content block arrays                           │
│  • Maps system prompts to role: "system" messages          │
│  • Handles streaming: SSE event conversion                 │
│  • Maps response back to Anthropic format                  │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│         Groq API (https://api.groq.com/openai/v1)          │
│                                                              │
│ Receives: POST /chat/completions                           │
│   • OpenAI message format                                  │
│   • Authorization: Bearer <groq-key>                       │
└─────────────────────────────────────────────────────────────┘
```

## Getting Started

### Prerequisites

- Node.js 14+ (pure HTTP/HTTPS modules, no dependencies)
- Groq API key (get from https://console.groq.com)
- Pre-patched CLI tool redirecting to `http://localhost:3000`

### Installation

```bash
# Copy proxy.js to your project
cp proxy.js ./

# Make executable (Unix/Linux/Mac)
chmod +x proxy.js
```

### Running the Proxy

```bash
# Simple start
node proxy.js

# With environment logging
DEBUG=1 node proxy.js
```

Expected output:
```
╔════════════════════════════════════════════════════════════╗
║  Anthropic ↔ OpenAI/Groq Protocol Proxy                  ║
╚════════════════════════════════════════════════════════════╝

  Listening on http://localhost:3000

  Endpoints:
    POST /v1/messages     → Groq API (/openai/v1/chat/completions)

  Ready for connections...
```

## Testing

### Using the test suite

```bash
GROQ_API_KEY=gsk_xxx node test-proxy.js
```

This runs three test cases:
1. **Simple text query** - Non-streaming basic request
2. **With system prompt** - System prompt + user message
3. **Streaming request** - SSE streaming response

### Manual curl test

```bash
curl -X POST http://localhost:3000/v1/messages \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer gsk_xxx" \
  -d '{
    "model": "claude-3-sonnet",
    "max_tokens": 256,
    "messages": [{
      "role": "user",
      "content": [{
        "type": "text",
        "text": "Hello!"
      }]
    }]
  }'
```

## Request/Response Format Translation

### Inbound: Anthropic → OpenAI

#### Anthropic Format (Input)
```json
{
  "model": "claude-3-sonnet",
  "max_tokens": 1024,
  "system": "You are a helpful assistant.",
  "messages": [
    {
      "role": "user",
      "content": [
        {
          "type": "text",
          "text": "Hello!"
        }
      ]
    },
    {
      "role": "assistant",
      "content": [
        {
          "type": "text",
          "text": "Hi there! How can I help?"
        }
      ]
    }
  ],
  "stream": true
}
```

#### Translated to OpenAI Format (Internal)
```json
{
  "model": "llama-3.1-70b",
  "max_tokens": 1024,
  "messages": [
    {
      "role": "system",
      "content": "You are a helpful assistant."
    },
    {
      "role": "user",
      "content": "Hello!"
    },
    {
      "role": "assistant",
      "content": "Hi there! How can I help?"
    }
  ],
  "stream": true
}
```

### Outbound: OpenAI → Anthropic

#### OpenAI Response (from Groq)
```json
{
  "id": "chatcmpl-abc123",
  "object": "text_completion",
  "created": 1234567890,
  "model": "llama-3.1-70b",
  "choices": [{
    "index": 0,
    "message": {
      "role": "assistant",
      "content": "This is the response!"
    },
    "finish_reason": "stop"
  }],
  "usage": {
    "prompt_tokens": 10,
    "completion_tokens": 5,
    "total_tokens": 15
  }
}
```

#### Translated to Anthropic Format (Output)
```json
{
  "id": "msg_abc123def456",
  "type": "message",
  "role": "assistant",
  "content": [
    {
      "type": "text",
      "text": "This is the response!"
    }
  ],
  "model": "claude-3-sonnet",
  "stop_reason": "end_turn",
  "usage": {
    "input_tokens": 10,
    "output_tokens": 5
  }
}
```

## Streaming (SSE) Event Mapping

### OpenAI Streaming Events → Anthropic Events

| OpenAI Event | Anthropic Event | Mapping |
|---|---|---|
| (initial) | `message_start` | Sent with message ID + metadata |
| `delta.content` | `content_block_delta` | Each chunk of streaming text |
| `data: [DONE]` | `message_stop` | End of stream |

#### Example Stream Flow

```
OpenAI Stream (from Groq):
data: {"choices":[{"delta":{"content":"Hello"},"finish_reason":null}]}
data: {"choices":[{"delta":{"content":" world"},"finish_reason":null}]}
data: [DONE]

            ↓ (proxy conversion)

Anthropic Stream (to client):
data: {"type":"message_start","message":{"id":"msg_...","role":"assistant"}}
data: {"type":"content_block_delta","delta":{"type":"text_delta","text":"Hello"}}
data: {"type":"content_block_delta","delta":{"type":"text_delta","text":" world"}}
data: {"type":"message_stop"}
```

## Model Mapping

The proxy automatically maps Anthropic model names to Groq-available models:

| Anthropic | Groq/OpenAI |
|---|---|
| `claude-3-opus` | `llama-3.1-405b` |
| `claude-3-sonnet` | `llama-3.1-70b` |
| `claude-3-haiku` | `llama-3.1-8b` |
| `claude-3.5-sonnet` | `llama-3.1-70b` |
| `claude-3.5-haiku` | `llama-3.1-8b` |
| *(default)* | `llama-3.1-70b` |

To add custom mappings, edit the `mapModel()` function in `proxy.js`.

## Header Translation

### Inbound Headers (accepted)
```
Authorization: Bearer <groq-api-key>
Content-Type: application/json
```

### Outbound Headers (sent to Groq)
```
Authorization: Bearer <groq-api-key>
Content-Type: application/json
User-Agent: Anthropic-to-OpenAI-Proxy/1.0
```

### Dropped Headers
- Any `anthropic-*` headers (e.g., `anthropic-version`, `anthropic-beta`)
- Proxy adds no authentication stripping—all headers forwarded safely

## Supported Parameters

The proxy supports full Anthropic request parameter translation:

| Parameter | Type | Notes |
|---|---|---|
| `model` | string | Mapped to Groq models |
| `messages` | array | Flattened from Anthropic content blocks |
| `system` | string | Converted to `role: "system"` message |
| `max_tokens` | number | Passed through to OpenAI |
| `temperature` | number | Passed through to OpenAI |
| `top_p` | number | Passed through to OpenAI |
| `top_k` | number | Passed through to OpenAI |
| `stream` | boolean | Enables SSE streaming |

*Note:* Tool calls, vision, and other advanced Anthropic features are not yet supported. See [Advanced Features](#advanced-features) below.

## Error Handling

The proxy translates Groq/OpenAI errors to Anthropic format:

```json
{
  "error": {
    "type": "authentication_error",
    "message": "Missing or invalid API key"
  }
}
```

Error types:
- `authentication_error` - Missing/invalid API key
- `not_found` - Invalid endpoint (e.g., /v1/foobar)
- `invalid_request` - Malformed JSON or missing required fields
- `api_error` - Groq API error or network failure

## Advanced Features

### Vision (Images)
Not yet supported. Anthropic vision content blocks (`{ type: "image", ... }`) are skipped.

**Workaround:** Call Groq API directly for vision requests.

### Tool Use / Function Calling
Not yet supported. Anthropic tool definitions and tool calls are not translated.

**Workaround:** Use text-based instructions or call Groq API directly.

### Vision + Text Responses
Not supported. Responses are always flat text in a single content block.

### Batching
Not supported. Each request is processed independently.

## Performance & Limits

- **Max request size:** 10 MB
- **Memory usage:** ~10 MB per active streaming connection
- **Concurrent connections:** Limited by Node.js (typically 1024)
- **Latency:** ~100-500ms (Groq API latency)

## Troubleshooting

### "Connection refused" on localhost:3000
```
Error: connect ECONNREFUSED 127.0.0.1:3000
```
**Solution:** Start the proxy: `node proxy.js`

### "Missing or invalid API key"
**Solution:** Ensure your Groq API key is set in the Authorization header:
```bash
Authorization: Bearer gsk_xxxxx
```

### "Endpoint not found" (404)
**Solution:** Only `/v1/messages` is supported. Other endpoints will return 404.

### Streaming not working / events not formatting correctly
1. Verify request has `"stream": true`
2. Check response `Content-Type: text/event-stream`
3. Ensure client is consuming SSE events correctly

### Garbled response or invalid JSON
**Solution:** The proxy may not be handling your specific request format. Enable logging:
```bash
DEBUG=1 node proxy.js
```

## Integration with Pre-Patched CLI

Your CLI has been patched to:
1. Replace `https://api.anthropic.com` → `http://localhost:3000`
2. Replace headers (`x-api-key` → `Authorization`)
3. Add `Bearer ` prefix to auth

The proxy expects this exact format and will translate it to Groq.

**Flow:**
```
CLI (patched) → Authorization: Bearer <groq-key>
                → POST /v1/messages, Anthropic format
                ↓
Proxy (here) → Translates to OpenAI format
               → Forwards to Groq API
               ← Gets OpenAI response
               → Translates back to Anthropic format
                ↓
CLI (patched) ← Anthropic-formatted response
```

## Production Deployment

### Using PM2
```bash
pm2 start proxy.js --name "anthropic-proxy"
pm2 save
pm2 startup
```

### Using Docker
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY proxy.js .
EXPOSE 3000
CMD ["node", "proxy.js"]
```

### Using systemd
```ini
[Unit]
Description=Anthropic-to-OpenAI Proxy
After=network.target

[Service]
ExecStart=/usr/bin/node /path/to/proxy.js
Restart=on-failure
User=proxy

[Install]
WantedBy=multi-user.target
```

## Development Notes

### Code Structure
- **Translation functions:** `anthropicToOpenAI()`, `openAIToAnthropic()`
- **Stream handling:** `convertOpenAIStreamEvent()`, `handleStreamResponse()`
- **Request routing:** `handleRequest()`, `forwardToGroq()`

### Extending the Proxy
To add support for new features:

1. **Tool use:** Extend `flattenAnthropicContent()` to handle tool_use blocks
2. **Vision:** Parse image content blocks and include in OpenAI format
3. **Custom models:** Update `mapModel()` function
4. **Custom endpoints:** Add routes to `handleRequest()`

### Testing Tips
- Use `test-proxy.js` for quick validation
- Monitor logs for translation issues
- Test with both streaming and non-streaming
- Verify response format matches Anthropic spec

## License & Attribution

This proxy bridges two LLM APIs for testing and development purposes.

**Anthropic SDK:** https://github.com/anthropics/anthropic-sdk-python
**Groq API:** https://console.groq.com
**OpenAI API:** https://platform.openai.com

## Support & Issues

For issues:
1. Check the [Troubleshooting](#troubleshooting) section
2. Enable logging: `DEBUG=1 node proxy.js`
3. Test with `test-proxy.js` to isolate the issue
4. Review translation logic in proxy.js
