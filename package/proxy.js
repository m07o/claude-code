#!/usr/bin/env node
/**
 * proxy.js - Anthropic ↔ OpenAI/Groq protocol proxy server (v2.0)
 *
 * Production-ready proxy with:
 * - Full Anthropic SSE streaming support
 * - Proper error translation
 * - Concurrent streaming fix (no global state)
 * - Latest model mappings
 * - Stub endpoints for SDK compatibility
 *
 * Flow:
 *   CLI (Anthropic format) → localhost:3000 → Groq API (OpenAI format) → Response translation
 */

const http = require('http');
const https = require('https');
const { URL } = require('url');

const PORT = process.env.PORT || 3000;
const DEBUG = process.env.DEBUG === '1';
const TIMEOUT = parseInt(process.env.TIMEOUT || '120000', 10);
const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';

// ═══════════════════════════════════════════════════════════════════════════════
// MODEL MAPPING
// ═══════════════════════════════════════════════════════════════════════════════

const MODEL_MAP = {
  // Claude → Groq (latest models as of 2025)
  'claude-opus-4': 'deepseek-r1-distill-llama-70b',
  'claude-opus-4-0': 'deepseek-r1-distill-llama-70b',
  'claude-opus-4-20250514': 'deepseek-r1-distill-llama-70b',
  'claude-sonnet-4-20250514': 'llama-3.3-70b-versatile',
  'claude-3-7-sonnet-latest': 'llama-3.3-70b-versatile',
  'claude-3-7-sonnet-20250219': 'llama-3.3-70b-versatile',
  'claude-3-5-sonnet-latest': 'llama-3.3-70b-versatile',
  'claude-3-5-sonnet-20241022': 'llama-3.3-70b-versatile',
  'claude-3-5-sonnet': 'llama-3.3-70b-versatile',
  'claude-3-sonnet': 'llama-3.3-70b-versatile',
  'claude-3-5-haiku-latest': 'llama-3.1-8b-instant',
  'claude-3-5-haiku-20241022': 'llama-3.1-8b-instant',
  'claude-3-5-haiku': 'llama-3.1-8b-instant',
  'claude-3-haiku': 'llama-3.1-8b-instant',
  'claude-3-opus': 'deepseek-r1-distill-llama-70b'
};

const DEFAULT_MODEL = 'llama-3.3-70b-versatile';

// ═══════════════════════════════════════════════════════════════════════════════
// ERROR TYPE MAPPING
// ═══════════════════════════════════════════════════════════════════════════════

const GROQ_TO_ANTHROPIC_ERROR_TYPE = {
  'invalid_api_key': 'authentication_error',
  'invalid_request_error': 'invalid_request_error',
  'authentication_error': 'authentication_error',
  'rate_limit_error': 'rate_limit_error',
  'server_error': 'api_error',
  'timeout': 'api_error',
  'model_not_found': 'not_found_error',
  'permission_error': 'permission_error'
};

// ═══════════════════════════════════════════════════════════════════════════════
// TRANSLATION FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Convert Anthropic request format to OpenAI format
 */
function anthropicToOpenAI(body) {
  const req = typeof body === 'string' ? JSON.parse(body) : body;
  const messages = [];

  // Add system prompt as first message if present
  if (req.system) {
    messages.push({
      role: 'system',
      content: req.system
    });
  }

  // Process user messages - flatten Anthropic content arrays
  if (req.messages && Array.isArray(req.messages)) {
    for (const msg of req.messages) {
      const content = flattenAnthropicContent(msg.content);
      if (content) {
        messages.push({
          role: msg.role,
          content
        });
      }
    }
  }

  // Build OpenAI request
  const openaiReq = {
    messages,
    model: mapModel(req.model),
    max_tokens: req.max_tokens || 1024,
    stream: req.stream === true,
    temperature: req.temperature,
    top_p: req.top_p,
    top_k: req.top_k
  };

  // Remove undefined fields
  Object.keys(openaiReq).forEach(k =>
    openaiReq[k] === undefined && delete openaiReq[k]
  );

  return openaiReq;
}

/**
 * Flatten Anthropic content array to OpenAI string format
 * Handles: text blocks, tool results, images (skipped), etc.
 */
function flattenAnthropicContent(content) {
  if (typeof content === 'string') {
    return content;
  }

  if (!Array.isArray(content)) {
    return '';
  }

  const parts = [];

  for (const block of content) {
    if (!block) continue;

    if (block.type === 'text' && block.text) {
      parts.push(block.text);
    } else if (block.type === 'tool_result' && block.content) {
      parts.push(`[Tool Result: ${block.content}]`);
    } else if (block.type === 'image') {
      // Skip images, log warning
      if (DEBUG) console.log('  [Warning] Image block skipped (Groq vision unavailable)');
    } else if (block.type === 'tool_use') {
      // Skip tool calls, log warning
      if (DEBUG) console.log('  [Warning] Tool use block skipped');
    }
  }

  return parts.join('\n');
}

/**
 * Map Anthropic model names to Groq models
 * Falls back to original model name if not in map and looks like a direct model
 */
function mapModel(anthropicModel) {
  if (!anthropicModel) return DEFAULT_MODEL;

  // Check if in known map
  if (MODEL_MAP[anthropicModel]) {
    return MODEL_MAP[anthropicModel];
  }

  // If not in map, check if it looks like a Groq/OpenAI model (doesn't start with 'claude')
  if (!anthropicModel.startsWith('claude')) {
    return anthropicModel;
  }

  // Default fallback
  return DEFAULT_MODEL;
}

/**
 * Convert OpenAI response to Anthropic format
 */
function openAIToAnthropic(openaiResp) {
  const resp = typeof openaiResp === 'string' ? JSON.parse(openaiResp) : openaiResp;

  if (!resp.choices || !resp.choices[0]) {
    throw new Error('Invalid OpenAI response: missing choices');
  }

  const choice = resp.choices[0];
  const content = choice.message?.content || '';

  const anthropicResp = {
    id: generateMessageId(),
    type: 'message',
    role: 'assistant',
    content: [
      {
        type: 'text',
        text: content
      }
    ],
    model: resp.model || 'claude-3-sonnet',
    stop_reason: mapStopReason(choice.finish_reason),
    usage: {
      input_tokens: resp.usage?.prompt_tokens || 0,
      output_tokens: resp.usage?.completion_tokens || 0
    }
  };

  return anthropicResp;
}

/**
 * Map OpenAI stop_reason to Anthropic stop_reason
 */
function mapStopReason(openaiReason) {
  const reasonMap = {
    'stop': 'end_turn',
    'length': 'max_tokens',
    'content_filter': 'end_turn',
    'function_call': 'tool_use',
    'tool_calls': 'tool_use'
  };
  return reasonMap[openaiReason] || 'end_turn';
}

/**
 * Translate Groq/OpenAI error to Anthropic error format
 */
function translateOpenAIError(openaiError) {
  const errorObj = typeof openaiError === 'string' ? JSON.parse(openaiError) : openaiError;
  const err = errorObj.error || {};

  const anthropicType = GROQ_TO_ANTHROPIC_ERROR_TYPE[err.type] || 'api_error';

  return {
    type: 'error',
    error: {
      type: anthropicType,
      message: err.message || 'Unknown error'
    }
  };
}

/**
 * Generate Anthropic-style message ID
 */
function generateMessageId() {
  return 'msg_' + Math.random().toString(36).substring(2, 18);
}

/**
 * Estimate tokens from text (rough approximation)
 */
function estimateTokens(text) {
  if (!text) return 0;
  // Rough heuristic: ~4 characters per token on average
  return Math.ceil(text.length / 4);
}

// ═══════════════════════════════════════════════════════════════════════════════
// HTTP REQUEST HANDLING
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Main request handler
 */
function handleRequest(req, res) {
  const startTime = Date.now();
  const logPrefix = `[${new Date().toISOString()}] ${req.method} ${req.url}`;

  if (DEBUG) console.log(logPrefix);

  // Handle /v1/messages/count_tokens (stub)
  if (req.method === 'POST' && req.url === '/v1/messages/count_tokens') {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
      if (body.length > 10 * 1024 * 1024) {
        res.writeHead(413, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: { type: 'invalid_request', message: 'Payload too large' } }));
        req.connection.destroy();
      }
    });

    req.on('end', () => {
      // Return stub response - tokens are estimated client-side
      const response = {
        input_tokens: 0,
        completion_tokens: 0
      };
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(response));
      if (DEBUG) console.log(`  [count_tokens] Stub response - ${Date.now() - startTime}ms`);
    });
    return;
  }

  // Handle /v1/models (stub)
  if (req.method === 'GET' && req.url === '/v1/models') {
    const modelList = Object.keys(MODEL_MAP).map(modelId => ({
      id: modelId,
      type: 'model',
      owned_by: 'anthropic'
    }));

    const response = {
      data: modelList,
      object: 'list',
      has_more: false
    };
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(response));
    if (DEBUG) console.log(`  [/v1/models] Stub response - ${Date.now() - startTime}ms`);
    return;
  }

  // Handle /v1/messages
  if (req.method === 'POST' && req.url === '/v1/messages') {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
      if (body.length > 10 * 1024 * 1024) {
        res.writeHead(413, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: { type: 'invalid_request', message: 'Payload too large' } }));
        req.connection.destroy();
      }
    });

    req.on('end', () => {
      try {
        const reqBody = JSON.parse(body);
        if (DEBUG) console.log(`  Body: ${body.substring(0, 150)}...`);

        // Extract Groq API key from Authorization header
        const authHeader = req.headers.authorization || '';
        const groqApiKey = authHeader.replace(/^Bearer\s+/, '').trim();

        if (!groqApiKey) {
          res.writeHead(401, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            type: 'error',
            error: {
              type: 'authentication_error',
              message: 'Missing API key'
            }
          }));
          return;
        }

        // Translate to OpenAI format
        const openaiReq = anthropicToOpenAI(reqBody);
        if (DEBUG) console.log(`  [Translated] Model: ${openaiReq.model}, Stream: ${openaiReq.stream}`);

        // Forward to Groq API
        forwardToGroq(openaiReq, groqApiKey, res, reqBody.stream === true, startTime);
      } catch (err) {
        console.error('  [ERROR]', err.message);
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          type: 'error',
          error: {
            type: 'invalid_request_error',
            message: `Failed to parse request: ${err.message}`
          }
        }));
      }
    });
    return;
  }

  // 404 for unknown endpoints
  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({
    type: 'error',
    error: {
      type: 'not_found_error',
      message: 'Endpoint not found'
    }
  }));
}

/**
 * Forward request to Groq API with response translation
 */
function forwardToGroq(openaiReq, groqApiKey, res, isStreaming, startTime) {
  const reqBody = JSON.stringify(openaiReq);

  const options = {
    hostname: 'api.groq.com',
    port: 443,
    path: '/openai/v1/chat/completions',
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${groqApiKey}`,
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(reqBody),
      'User-Agent': 'Anthropic-to-OpenAI-Proxy/2.0'
    }
  };

  const groqReq = https.request(options, (groqRes) => {
    if (DEBUG) console.log(`  [Groq] Status: ${groqRes.statusCode}`);

    // Handle non-200 responses
    if (groqRes.statusCode !== 200) {
      let errorBody = '';
      groqRes.on('data', chunk => errorBody += chunk);
      groqRes.on('end', () => {
        try {
          const translated = translateOpenAIError(errorBody);
          res.writeHead(groqRes.statusCode, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(translated));
          if (DEBUG) console.log(`  [Response Error] Translated - ${Date.now() - startTime}ms`);
        } catch (e) {
          res.writeHead(groqRes.statusCode, { 'Content-Type': 'application/json' });
          res.end(errorBody);
        }
      });
      return;
    }

    if (isStreaming) {
      handleStreamResponse(groqRes, res, startTime);
    } else {
      handleNonStreamResponse(groqRes, res, startTime);
    }
  });

  groqReq.on('error', (err) => {
    console.error('  [Groq Error]', err.message);
    res.writeHead(502, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      type: 'error',
      error: {
        type: 'api_error',
        message: `Groq API error: ${err.message}`
      }
    }));
  });

  groqReq.setTimeout(TIMEOUT);
  groqReq.write(reqBody);
  groqReq.end();
}

/**
 * Handle non-streaming response from Groq
 */
function handleNonStreamResponse(groqRes, res, startTime) {
  let body = '';

  groqRes.on('data', (chunk) => {
    body += chunk;
  });

  groqRes.on('end', () => {
    try {
      const openaiResp = JSON.parse(body);
      const anthropicResp = openAIToAnthropic(openaiResp);

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(anthropicResp));
      if (DEBUG) console.log(`  [Response] Converted to Anthropic format - ${Date.now() - startTime}ms`);
    } catch (err) {
      console.error('  [Response Error]', err.message);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        type: 'error',
        error: {
          type: 'api_error',
          message: `Failed to translate response: ${err.message}`
        }
      }));
    }
  });
}

/**
 * Handle streaming response from Groq - convert SSE to Anthropic format
 * FIXED: streamState is now LOCAL per-request (not global)
 */
function handleStreamResponse(groqRes, res, startTime) {
  // LOCAL stream state - each streaming connection has its own
  const streamState = {
    blockStarted: false,
    blockStopped: false,
    outputTokens: 0,
    stopReason: 'end_turn',
    finish_reason: null
  };

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive'
  });

  const messageId = generateMessageId();

  // Send initial message_start event with usage
  const messageStart = {
    type: 'message_start',
    message: {
      id: messageId,
      type: 'message',
      role: 'assistant',
      content: [],
      model: 'claude-3-sonnet',
      stop_reason: null,
      usage: {
        input_tokens: 0,
        output_tokens: 0
      }
    }
  };
  res.write(`data: ${JSON.stringify(messageStart)}\n\n`);

  let buffer = '';

  groqRes.on('data', (chunk) => {
    buffer += chunk.toString();

    // Process complete lines
    const lines = buffer.split('\n');
    buffer = lines.pop(); // Keep incomplete line in buffer

    for (const line of lines) {
      if (!line.trim()) continue;

      try {
        const events = convertOpenAIStreamEvent(line, streamState);
        if (Array.isArray(events)) {
          for (const event of events) {
            res.write(`data: ${JSON.stringify(event)}\n\n`);
          }
        } else if (events) {
          res.write(`data: ${JSON.stringify(events)}\n\n`);
        }
      } catch (err) {
        console.error('  [Stream Error]', err.message);
      }
    }
  });

  groqRes.on('end', () => {
    // Process any remaining buffer
    if (buffer.trim()) {
      try {
        const events = convertOpenAIStreamEvent(buffer, streamState);
        if (Array.isArray(events)) {
          for (const event of events) {
            res.write(`data: ${JSON.stringify(event)}\n\n`);
          }
        } else if (events) {
          res.write(`data: ${JSON.stringify(events)}\n\n`);
        }
      } catch (err) {
        console.error('  [Stream Error]', err.message);
      }
    }

    // Send content_block_stop if we started a block
    if (streamState.blockStarted && !streamState.blockStopped) {
      res.write(`data: ${JSON.stringify({
        type: 'content_block_stop',
        index: 0
      })}\n\n`);
      streamState.blockStopped = true;
    }

    // Send message_delta with stop_reason and final usage
    const messageDelta = {
      type: 'message_delta',
      delta: {
        stop_reason: streamState.stopReason,
        stop_sequence: null
      },
      usage: {
        output_tokens: streamState.outputTokens
      }
    };
    res.write(`data: ${JSON.stringify(messageDelta)}\n\n`);

    // Send final message_stop
    res.write(`data: ${JSON.stringify({ type: 'message_stop' })}\n\n`);
    res.end();

    if (DEBUG) console.log(`  [Stream] Completed - ${Date.now() - startTime}ms (${streamState.outputTokens} tokens)`);
  });

  groqRes.on('error', (err) => {
    console.error('  [Stream Error]', err.message);
    // Send error event if client still listening
    try {
      res.write(`data: ${JSON.stringify({
        type: 'error',
        error: {
          type: 'api_error',
          message: `Stream interrupted: ${err.message}`
        }
      })}\n\n`);
    } catch (e) {
      // Client may have disconnected
    }
    res.end();
  });

  res.on('close', () => {
    if (DEBUG) console.log('  [Stream] Client disconnected');
  });
}

/**
 * Convert OpenAI SSE event to Anthropic format
 * RETURNS: Array of events or single event (to handle message_start + content_block_start)
 * FIXED: streamState passed as parameter (not global)
 */
function convertOpenAIStreamEvent(eventLine, streamState) {
  if (eventLine === 'data: [DONE]') {
    // End of stream marker - no event (handled in handleStreamResponse)
    return null;
  }

  if (!eventLine.startsWith('data: ')) {
    return null;
  }

  try {
    const data = JSON.parse(eventLine.substring(6));

    if (!data.choices || !data.choices[0]) {
      return null;
    }

    const choice = data.choices[0];
    const delta = choice.delta || {};
    const content = delta.content || '';

    // Track finish reason
    if (choice.finish_reason) {
      streamState.finish_reason = choice.finish_reason;
      streamState.stopReason = mapStopReason(choice.finish_reason);
    }

    const events = [];

    // First delta chunk - send content_block_start
    if (content && !streamState.blockStarted) {
      streamState.blockStarted = true;
      events.push({
        type: 'content_block_start',
        index: 0,
        content_block: {
          type: 'text',
          text: ''
        }
      });
    }

    // Content chunk
    if (content) {
      streamState.outputTokens += estimateTokens(content);
      events.push({
        type: 'content_block_delta',
        index: 0,
        delta: {
          type: 'text_delta',
          text: content
        }
      });
    }

    return events.length > 0 ? events : null;
  } catch (e) {
    return null;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// SERVER STARTUP
// ═══════════════════════════════════════════════════════════════════════════════

const server = http.createServer(handleRequest);

server.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════════════════════════╗
║  Anthropic ↔ OpenAI/Groq Protocol Proxy (v2.0)           ║
╚════════════════════════════════════════════════════════════╝

  Listening on http://localhost:${PORT}

  Endpoints:
    POST /v1/messages              → Groq API (/openai/v1/chat/completions)
    POST /v1/messages/count_tokens → Stub response
    GET /v1/models                 → Model list

  Features:
    ✓ Full Anthropic SSE streaming (with message_delta, content_block_stop)
    ✓ Proper error format translation
    ✓ Concurrent streaming (no global state)
    ✓ Latest model mappings (llama-3.3, deepseek-r1)
    ✓ Content block type handling (text, tool_result, image, tool_use)
    ✓ Request logging (DEBUG=1)

  Configuration:
    PORT=${PORT}
    TIMEOUT=${TIMEOUT}ms
    DEBUG=${DEBUG}

  Ready for connections...
  `);
});

server.on('error', (err) => {
  console.error('Server error:', err);
  process.exit(1);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\nShutting down gracefully...');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

process.on('SIGTERM', () => {
  console.log('\nReceived SIGTERM, closing...');
  server.close(() => {
    process.exit(0);
  });
});
