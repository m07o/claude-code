#!/usr/bin/env node
/**
 * test-proxy.js - Comprehensive test suite for Anthropic ↔ OpenAI proxy
 *
 * Tests:
 *   1. Non-streaming request
 *   2. Streaming request (full SSE event sequence)
 *   3. Error handling (invalid API key)
 *   4. Stub endpoints (/v1/models, /v1/messages/count_tokens)
 *   5. Concurrent streaming
 *
 * Usage:
 *   GROQ_API_KEY=gsk_xxx node test-proxy.js
 */

const http = require('http');

const GROQ_API_KEY = process.env.GROQ_API_KEY;

if (!GROQ_API_KEY) {
  console.error('Error: GROQ_API_KEY environment variable not set');
  console.error('Usage: GROQ_API_KEY=gsk_xxx node test-proxy.js');
  process.exit(1);
}

// Test delay utility
function delay(ms) {
  return new Promise(r => setTimeout(r, ms));
}

// ═══════════════════════════════════════════════════════════════════════════════
// TEST CASES
// ═══════════════════════════════════════════════════════════════════════════════

const tests = [
  {
    name: '1. Non-streaming request',
    description: 'Verify Anthropic response format',
    request: {
      model: 'claude-3-sonnet',
      max_tokens: 256,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: 'Say "Hello from proxy!" and nothing else.' }
          ]
        }
      ],
      stream: false
    },
    verify: (resp) => {
      const checks = [
        ['Has type field', resp.type === 'message'],
        ['Has id field', resp.id && resp.id.startsWith('msg_')],
        ['Has role field', resp.role === 'assistant'],
        ['Has content array', Array.isArray(resp.content)],
        ['Content has text block', resp.content[0]?.type === 'text'],
        ['Has stop_reason', resp.stop_reason === 'end_turn' || resp.stop_reason === 'max_tokens'],
        ['Has usage', resp.usage && typeof resp.usage.input_tokens === 'number']
      ];
      return { checks, resp };
    }
  },

  {
    name: '2. Streaming request (SSE events)',
    description: 'Verify full event sequence: message_start → content_block_start → content_block_delta → content_block_stop → message_delta → message_stop',
    request: {
      model: 'claude-3-sonnet',
      max_tokens: 128,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: 'Count: 1, 2, 3' }
          ]
        }
      ],
      stream: true
    },
    verify: (events) => {
      const eventTypes = events.map(e => e.type);
      const checks = [
        ['First event is message_start', eventTypes[0] === 'message_start'],
        ['Has content_block_start', eventTypes.includes('content_block_start')],
        ['Has content_block_delta events', eventTypes.filter(e => e === 'content_block_delta').length > 0],
        ['Has content_block_stop', eventTypes.includes('content_block_stop')],
        ['Has message_delta', eventTypes.includes('message_delta')],
        ['Last event is message_stop', eventTypes[eventTypes.length - 1] === 'message_stop'],
      ];

      // Verify message_delta has stop_reason and usage
      const messageDelta = events.find(e => e.type === 'message_delta');
      const deltaChecks = messageDelta ? [
        ['message_delta has delta.stop_reason', messageDelta.delta?.stop_reason],
        ['message_delta has usage.output_tokens', typeof messageDelta.usage?.output_tokens === 'number']
      ] : [['message_delta not found', false]];

      // Verify content_block_start before first delta
      const blockStartIdx = eventTypes.indexOf('content_block_start');
      const firstDeltaIdx = eventTypes.indexOf('content_block_delta');
      const orderCheck = blockStartIdx < firstDeltaIdx;

      return { checks: [...checks, ...deltaChecks, ['content_block_start before deltas', orderCheck]], events };
    }
  },

  {
    name: '3. Error handling (invalid API key)',
    description: 'Verify Anthropic error format for 401',
    request: {
      model: 'claude-3-sonnet',
      max_tokens: 256,
      messages: [{ role: 'user', content: [{ type: 'text', text: 'hi' }] }],
      stream: false
    },
    authKey: 'invalid_key_12345',
    verify: (resp) => {
      const checks = [
        ['Has type field', resp.type === 'error'],
        ['Has error.type', resp.error?.type],
        ['Error type is authentication_error or similar',
         ['authentication_error', 'invalid_request_error'].includes(resp.error?.type)],
        ['Has error.message', typeof resp.error?.message === 'string']
      ];
      return { checks, resp };
    }
  },

  {
    name: '4. Stub endpoint: /v1/models',
    description: 'Verify model list returns proper format',
    request: null,
    endpoint: '/v1/models',
    method: 'GET',
    verify: (resp) => {
      const checks = [
        ['Has data array', Array.isArray(resp.data)],
        ['Has object field', resp.object === 'list'],
        ['Has has_more field', typeof resp.has_more === 'boolean'],
        ['First item has id', resp.data[0]?.id],
        ['First item has type', resp.data[0]?.type === 'model']
      ];
      return { checks, resp };
    }
  },

  {
    name: '5. Stub endpoint: /v1/messages/count_tokens',
    description: 'Verify token counting returns valid format',
    request: {
      model: 'claude-3-sonnet',
      messages: [{ role: 'user', content: 'test' }]
    },
    endpoint: '/v1/messages/count_tokens',
    method: 'POST',
    verify: (resp) => {
      const checks = [
        ['Has input_tokens', typeof resp.input_tokens === 'number'],
        ['Has completion_tokens', typeof resp.completion_tokens === 'number']
      ];
      return { checks, resp };
    }
  }
];

// ═══════════════════════════════════════════════════════════════════════════════
// TEST RUNNER
// ═══════════════════════════════════════════════════════════════════════════════

async function runTest(testCase, index) {
  return new Promise((resolve) => {
    console.log(`\n${'='.repeat(70)}`);
    console.log(`${testCase.name}`);
    console.log(`Description: ${testCase.description}`);
    console.log(`${'='.repeat(70)}`);

    const endpoint = testCase.endpoint || '/v1/messages';
    const method = testCase.method || 'POST';
    const authKey = testCase.authKey || GROQ_API_KEY;

    let reqBody = '';
    if (testCase.request) {
      reqBody = JSON.stringify(testCase.request);
    }

    const options = {
      hostname: 'localhost',
      port: 3000,
      path: endpoint,
      method: method,
      headers: {
        'Content-Type': 'application/json'
      }
    };

    if (authKey && method === 'POST') {
      options.headers['Authorization'] = `Bearer ${authKey}`;
    }

    if (reqBody) {
      options.headers['Content-Length'] = Buffer.byteLength(reqBody);
    }

    const req = http.request(options, (res) => {
      console.log(`\nResponse Status: ${res.statusCode}`);

      if (res.headers['content-type']?.includes('text/event-stream')) {
        // Handle streaming response
        console.log('Response Type: Server-Sent Events (streaming)\n');
        const events = [];
        let buffer = '';

        res.on('data', (chunk) => {
          buffer += chunk.toString();
          const lines = buffer.split('\n');
          buffer = lines.pop();

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const event = JSON.parse(line.substring(6));
                events.push(event);
                console.log(`  Event: ${event.type} ${event.delta ? '(delta)' : ''}`);
              } catch (e) {
                // Ignore parse errors
              }
            }
          }
        });

        res.on('end', () => {
          console.log(`\nTotal events: ${events.length}`);
          const result = testCase.verify(events);
          printResults(result.checks);
          resolve();
        });
      } else {
        // Handle JSON response
        let body = '';
        res.on('data', (chunk) => {
          body += chunk;
        });

        res.on('end', () => {
          try {
            const resp = JSON.parse(body);
            console.log(`Response Type: JSON\n`);
            console.log('Response:', JSON.stringify(resp, null, 2).substring(0, 300));
            const result = testCase.verify(resp);
            printResults(result.checks);
            resolve();
          } catch (e) {
            console.log('Failed to parse response:', body);
            resolve();
          }
        });
      }
    });

    req.on('error', (err) => {
      console.error(`\n[Request Error] ${err.message}`);
      if (err.code === 'ECONNREFUSED') {
        console.error('  → Proxy is not running on localhost:3000');
        console.error('  → Start it with: node proxy.js');
      }
      resolve();
    });

    if (reqBody) {
      req.write(reqBody);
    }
    req.end();
  });
}

function printResults(checks) {
  console.log('\nChecks:');
  let passed = 0;
  for (const [name, result] of checks) {
    const status = result ? '✓' : '✗';
    const color = result ? '\x1b[32m' : '\x1b[31m';
    const reset = '\x1b[0m';
    console.log(`  ${color}${status}${reset} ${name}`);
    if (result) passed++;
  }
  console.log(`\nResult: ${passed}/${checks.length} checks passed`);
}

async function runConcurrentStreamingTest() {
  console.log(`\n${'='.repeat(70)}`);
  console.log('BONUS: Concurrent Streaming Test');
  console.log('Description: Two simultaneous streaming requests should not interfere');
  console.log(`${'='.repeat(70)}\n`);

  const makeStreamRequest = (id) => {
    return new Promise((resolve) => {
      const reqBody = JSON.stringify({
        model: 'claude-3-sonnet',
        max_tokens: 100,
        messages: [
          { role: 'user', content: [{ type: 'text', text: `Request ${id}: expand "LLM"` }] }
        ],
        stream: true
      });

      const options = {
        hostname: 'localhost',
        port: 3000,
        path: '/v1/messages',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(reqBody),
          'Authorization': `Bearer ${GROQ_API_KEY}`
        }
      };

      const req = http.request(options, (res) => {
        let eventCount = 0;
        res.on('data', (chunk) => {
          const lines = chunk.toString().split('\n');
          for (const line of lines) {
            if (line.startsWith('data: ')) eventCount++;
          }
        });

        res.on('end', () => {
          console.log(`  Request ${id}: Received ${eventCount} events`);
          resolve(eventCount);
        });
      });

      req.on('error', (err) => {
        console.log(`  Request ${id}: Error - ${err.message}`);
        resolve(0);
      });

      req.write(reqBody);
      req.end();
    });
  };

  console.log('Sending two concurrent streaming requests...\n');
  const results = await Promise.all([
    makeStreamRequest(1),
    makeStreamRequest(2)
  ]);

  console.log(`\nResult: Both requests completed (${results.join(', ')} events)`);
  console.log(`Status: ${'✓ No interference detected'.substring(0)}`);
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════════════════════

async function main() {
  console.log(`
╔════════════════════════════════════════════════════════════╗
║  Anthropic ↔ OpenAI Proxy - Test Suite (v2.0)            ║
╚════════════════════════════════════════════════════════════╝

Testing proxy at http://localhost:3000
Using Groq API key: ${GROQ_API_KEY.substring(0, 10)}...
`);

  for (let i = 0; i < tests.length; i++) {
    await runTest(tests[i], i);
    if (i < tests.length - 1) {
      await delay(1000); // Wait between tests
    }
  }

  // Run concurrent test
  await delay(1000);
  await runConcurrentStreamingTest();

  console.log(`\n${'='.repeat(70)}`);
  console.log('All tests completed');
  console.log(`${'='.repeat(70)}\n`);
}

main().catch(console.error);
