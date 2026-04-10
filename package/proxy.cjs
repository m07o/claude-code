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

const PORT = process.env.PORT || 3002;
const DEBUG = process.env.DEBUG === '1';
const TIMEOUT = parseInt(process.env.TIMEOUT || '120000', 10);
const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';

// Local model configuration
const LOCAL_MODEL_URL = process.env.LOCAL_MODEL_URL || 'http://localhost:11434/v1/chat/completions';
const LOCAL_MODEL_NAME = process.env.LOCAL_MODEL_NAME || 'llama3.2:1b';

// ═══════════════════════════════════════════════════════════════════════════════
// MODEL MAPPING
// ═══════════════════════════════════════════════════════════════════════════════

const MODEL_MAP = {
  // Claude Opus → Llama 4 Scout (best for code)
  'claude-opus-4': 'meta-llama/llama-4-scout-17b-16e-instruct',
  'claude-opus-4-0': 'meta-llama/llama-4-scout-17b-16e-instruct',
  'claude-opus-4-20250514': 'meta-llama/llama-4-scout-17b-16e-instruct',
  'claude-3-opus': 'meta-llama/llama-4-scout-17b-16e-instruct',
  'claude-3-opus-latest': 'meta-llama/llama-4-scout-17b-16e-instruct',

  // Claude Sonnet → Llama 3.3 70B (balanced)
  'claude-sonnet-4': 'llama-3.3-70b-versatile',
  'claude-sonnet-4-0': 'llama-3.3-70b-versatile',
  'claude-sonnet-4-20250514': 'llama-3.3-70b-versatile',
  'claude-3-7-sonnet-latest': 'llama-3.3-70b-versatile',
  'claude-3-7-sonnet-20250219': 'llama-3.3-70b-versatile',
  'claude-3-5-sonnet-latest': 'llama-3.3-70b-versatile',
  'claude-3-5-sonnet-20241022': 'llama-3.3-70b-versatile',
  'claude-3-5-sonnet': 'llama-3.3-70b-versatile',
  'claude-3-sonnet': 'llama-3.3-70b-versatile',

  // Claude Haiku → Llama 3.1 8B (fastest, cheapest)
  'claude-haiku-4': 'llama-3.1-8b-instant',
  'claude-haiku-4-20250514': 'llama-3.1-8b-instant',
  'claude-3-5-haiku-latest': 'llama-3.1-8b-instant',
  'claude-3-5-haiku-20241022': 'llama-3.1-8b-instant',
  'claude-3-5-haiku': 'llama-3.1-8b-instant',
  'claude-3-haiku': 'llama-3.1-8b-instant'
};

const LOCAL_MODEL_MAP = {
  'claude-local-1b': LOCAL_MODEL_NAME,
  'local-model': LOCAL_MODEL_NAME,
  'claude-3-haiku-local': LOCAL_MODEL_NAME
};

const DEFAULT_MODEL = 'meta-llama/llama-4-scout-17b-16e-instruct';

// ═══════════════════════════════════════════════════════════════════════════════
// WEB DASHBOARD HTML - ENHANCED v2
// ═══════════════════════════════════════════════════════════════════════════════

const DASHBOARD_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Proxy Dashboard</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { height: 100%; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, monospace; background: #0a0a0a; color: #e0e0e0; line-height: 1.6; }

    .container { display: flex; height: 100vh; }

    /* Sidebar Navigation */
    .sidebar { width: 200px; background: #1a1a2e; border-right: 1px solid #2d3561; overflow-y: auto; padding: 20px 0; }
    .sidebar-item { padding: 12px 20px; cursor: pointer; border-left: 3px solid transparent; transition: all 0.2s; }
    .sidebar-item:hover { background: #16213e; border-left-color: #7c3aed; }
    .sidebar-item.active { background: #16213e; border-left-color: #7c3aed; color: #7c3aed; }
    .sidebar-title { padding: 15px 20px; color: #888; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; }

    /* Main Content */
    .main { flex: 1; display: flex; flex-direction: column; overflow: hidden; }

    /* Header */
    .header { background: #1a1a2e; border-bottom: 1px solid #2d3561; padding: 15px 30px; display: flex; justify-content: space-between; align-items: center; }
    .header h1 { color: #7c3aed; font-size: 20px; }
    .status-indicator { display: flex; align-items: center; gap: 8px; }
    .status-dot { width: 10px; height: 10px; border-radius: 50%; background: #10b981; animation: pulse 2s infinite; }
    @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
    .mode-toggle { background: #16213e; border: 1px solid #2d3561; color: #e0e0e0; padding: 6px 12px; border-radius: 4px; cursor: pointer; font-size: 12px; }

    /* Content Area */
    .content { flex: 1; overflow-y: auto; padding: 30px; }
    .section { margin-bottom: 30px; }
    .section h2 { color: #7c3aed; font-size: 18px; margin-bottom: 20px; }

    /* Cards Grid */
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin-bottom: 20px; }
    .card { background: #16213e; border: 1px solid #2d3561; border-radius: 6px; padding: 15px; }
    .card-title { color: #7c3aed; font-size: 12px; text-transform: uppercase; margin-bottom: 8px; }
    .card-value { font-size: 24px; font-weight: bold; color: #e0e0e0; }
    .card-sub { color: #888; font-size: 11px; margin-top: 5px; }

    /* Chat Interface */
    .chat-container { background: #16213e; border: 1px solid #2d3561; border-radius: 6px; display: flex; flex-direction: column; height: 500px; }
    .chat-messages { flex: 1; overflow-y: auto; padding: 20px; display: flex; flex-direction: column; gap: 10px; }
    .message { display: flex; gap: 10px; animation: fadeIn 0.3s ease-in; }
    @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
    .message.user { justify-content: flex-end; }
    .message-content { max-width: 70%; padding: 12px; border-radius: 6px; }
    .message.user .message-content { background: #7c3aed; color: white; }
    .message.assistant .message-content { background: #2d3561; color: #e0e0e0; }
    .message-time { font-size: 10px; color: #888; margin-top: 3px; }

    .chat-input-area { padding: 15px; border-top: 1px solid #2d3561; display: flex; gap: 10px; }
    .chat-input-area select, .chat-input-area textarea { flex: 1; padding: 10px; background: #0f1929; border: 1px solid #2d3561; color: #e0e0e0; border-radius: 4px; font-family: monospace; }
    .chat-input-area textarea { resize: vertical; max-height: 60px; }
    .chat-input-area button { background: #7c3aed; color: white; border: none; padding: 8px 20px; border-radius: 4px; cursor: pointer; font-weight: bold; }
    .chat-input-area button:hover { background: #6d28d9; }

    /* Request Log Table */
    .log-table { width: 100%; border-collapse: collapse; font-size: 12px; }
    .log-table th { background: #2d3561; color: #7c3aed; padding: 10px; text-align: left; border-bottom: 1px solid #2d3561; }
    .log-table td { padding: 10px; border-bottom: 1px solid #2d3561; }
    .log-table tr:hover { background: #1f2f54; }
    .status-ok { color: #10b981; }
    .status-error { color: #ef4444; }
    .status-warn { color: #f59e0b; }
    .model-tag { display: inline-block; background: #2d3561; color: #7c3aed; padding: 2px 6px; border-radius: 3px; font-size: 10px; }

    /* Form Elements */
    label { display: block; color: #888; font-size: 11px; text-transform: uppercase; margin-bottom: 5px; margin-top: 15px; }
    input, select, textarea { width: 100%; padding: 10px; background: #0f1929; border: 1px solid #2d3561; color: #e0e0e0; border-radius: 4px; font-family: monospace; margin-bottom: 10px; }
    input:focus, select:focus, textarea:focus { outline: none; border-color: #7c3aed; }
    button { background: #7c3aed; color: white; border: none; padding: 10px 20px; border-radius: 4px; cursor: pointer; font-weight: bold; }
    button:hover { background: #6d28d9; }

    /* Hidden sections */
    .section { display: none; }
    .section.active { display: block; }

    /* Stats Grid */
    .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 15px; }
    .stat-card { background: #16213e; border: 1px solid #2d3561; border-radius: 6px; padding: 15px; text-align: center; }
    .stat-number { font-size: 28px; font-weight: bold; color: #7c3aed; }
    .stat-label { color: #888; font-size: 11px; margin-top: 5px; }

    /* Scrollbar */
    ::-webkit-scrollbar { width: 8px; }
    ::-webkit-scrollbar-track { background: #0a0a0a; }
    ::-webkit-scrollbar-thumb { background: #2d3561; border-radius: 4px; }
    ::-webkit-scrollbar-thumb:hover { background: #3d4571; }
  </style>
</head>
<body>
  <div class="container">
    <!-- Sidebar -->
    <div class="sidebar">
      <div class="sidebar-title">Navigation</div>
      <div class="sidebar-item active" onclick="showSection('dashboard')">🎯 Dashboard</div>
      <div class="sidebar-item" onclick="showSection('chat')">💬 Chat</div>
      <div class="sidebar-item" onclick="showSection('logs')">📊 Logs</div>
      <div class="sidebar-item" onclick="showSection('settings')">⚙️ Settings</div>
      <div class="sidebar-item" onclick="showSection('models')">🤖 Models</div>
    </div>

    <!-- Main Content -->
    <div class="main">
      <!-- Header -->
      <div class="header">
        <h1>🔌 Proxy Control Hub</h1>
        <div class="status-indicator">
          <span class="status-dot"></span>
          <span>Running</span>
          <button class="mode-toggle" onclick="toggleDarkMode()">🌙 Dark</button>
        </div>
      </div>

      <!-- Content -->
      <div class="content">
        <!-- Dashboard Section -->
        <div id="dashboard" class="section active">
          <h2>Status Overview</h2>
          <div class="grid">
            <div class="card">
              <div class="card-title">Proxy</div>
              <div class="card-value">✓</div>
              <div class="card-sub">Running</div>
            </div>
            <div class="card">
              <div class="card-title">Groq API</div>
              <div class="card-value" id="groq-status">🔄</div>
              <div class="card-sub" id="groq-msg">Checking...</div>
            </div>
            <div class="card">
              <div class="card-title">Local Model</div>
              <div class="card-value" id="local-status">🔄</div>
              <div class="card-sub" id="local-msg">Checking...</div>
            </div>
            <div class="card">
              <div class="card-title">Total Requests</div>
              <div class="card-value" id="total-reqs">0</div>
              <div class="card-sub">Today</div>
            </div>
          </div>

          <h2>Real-Time Statistics</h2>
          <div class="stats-grid">
            <div class="stat-card">
              <div class="stat-number" id="stat-success">0</div>
              <div class="stat-label">Successful</div>
            </div>
            <div class="stat-card">
              <div class="stat-number" id="stat-errors">0</div>
              <div class="stat-label">Errors</div>
            </div>
            <div class="stat-card">
              <div class="stat-number" id="stat-avg-time">0ms</div>
              <div class="stat-label">Avg Response</div>
            </div>
            <div class="stat-card">
              <div class="stat-number" id="stat-tokens">0</div>
              <div class="stat-label">Total Tokens</div>
            </div>
          </div>
        </div>

        <!-- Chat Section -->
        <div id="chat" class="section">
          <h2>Model Chat Tester</h2>
          <div class="chat-container">
            <div class="chat-messages" id="chat-messages"></div>
            <div class="chat-input-area">
              <select id="chat-model">
                <option value="claude-opus-4">Claude Opus (Llama 4 Scout)</option>
                <option value="claude-3-5-sonnet" selected>Claude Sonnet (Llama 3.3 70B)</option>
                <option value="claude-3-5-haiku">Claude Haiku (Llama 3.1 8B)</option>
                <option value="claude-local-1b">Local Model</option>
              </select>
              <textarea id="chat-input" placeholder="Type your message..." onkeypress="if(event.key==='Enter' && !event.shiftKey) sendChat()"></textarea>
              <button onclick="sendChat()">Send</button>
            </div>
          </div>
        </div>

        <!-- Logs Section -->
        <div id="logs" class="section">
          <h2>Recent API Requests</h2>
          <table class="log-table">
            <thead>
              <tr>
                <th>Time</th>
                <th>Model</th>
                <th>Status</th>
                <th>Response Time</th>
                <th>Tokens</th>
              </tr>
            </thead>
            <tbody id="log-tbody">
              <tr><td colspan="5" style="text-align:center;color:#888;">No requests yet</td></tr>
            </tbody>
          </table>
        </div>

        <!-- Settings Section -->
        <div id="settings" class="section">
          <h2>Configuration</h2>
          <div>
            <label>Default Groq Model</label>
            <select id="default-model">
              <option value="meta-llama/llama-4-scout-17b-16e-instruct">Llama 4 Scout (Coding)</option>
              <option value="llama-3.3-70b-versatile">Llama 3.3 70B (Balanced)</option>
              <option value="llama-3.1-8b-instant">Llama 3.1 8B (Speed)</option>
            </select>

            <label>Local Model URL</label>
            <input type="text" id="local-url" placeholder="http://localhost:11434/v1/chat/completions" value="http://localhost:11434/v1/chat/completions">

            <label>Local Model Name</label>
            <input type="text" id="local-name" placeholder="llama3.2:1b" value="llama3.2:1b">

            <button onclick="saveSettings()">Save Settings</button>
            <div id="settings-msg" style="margin-top:10px;color:#10b981;"></div>
          </div>

          <h2>Environment</h2>
          <div>
            <label>GROQ_API_KEY</label>
            <input type="password" id="groq-key" placeholder="••••••••" value="***hidden***" disabled>

            <label>Current Port</label>
            <input type="text" id="current-port" value="3002" disabled>
          </div>
        </div>

        <!-- Models Section -->
        <div id="models" class="section">
          <h2>Available Groq Models</h2>
          <table class="log-table">
            <thead>
              <tr>
                <th>Model</th>
                <th>Context</th>
                <th>Speed</th>
                <th>Price/1M</th>
                <th>Best For</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><strong>meta-llama/llama-4-scout-17b-16e-instruct</strong></td>
                <td>128K</td>
                <td>594 TPS</td>
                <td>$0.11 / $0.34</td>
                <td>🎯 Coding</td>
              </tr>
              <tr>
                <td><strong>llama-3.3-70b-versatile</strong></td>
                <td>128K</td>
                <td>394 TPS</td>
                <td>$0.59 / $0.79</td>
                <td>⚖️ Balanced</td>
              </tr>
              <tr>
                <td><strong>llama-3.1-8b-instant</strong></td>
                <td>128K</td>
                <td>840 TPS</td>
                <td>$0.05 / $0.08</td>
                <td>⚡ Speed+Cost</td>
              </tr>
              <tr>
                <td><strong>qwen/qwen3-32b</strong></td>
                <td>131K</td>
                <td>662 TPS</td>
                <td>$0.29 / $0.59</td>
                <td>🌐 Alt</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </div>

  <script>
    let requestLog = [];
    let chatHistory = [];
    let stats = { success: 0, errors: 0, totalTime: 0, totalTokens: 0 };

    // Navigation
    function showSection(name) {
      document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
      document.querySelectorAll('.sidebar-item').forEach(s => s.classList.remove('active'));
      document.getElementById(name)?.classList.add('active');
      event.target.classList.add('active');
      if (name === 'dashboard') {
        checkHealth();
        updateStats();
      }
    }

    // Health Check
    async function checkHealth() {
      try {
        const resp = await fetch('/health');
        const data = await resp.json();
        updateStatus('groq', data.groq_api);
        updateStatus('local', data.local_model);
      } catch (e) {
        console.error('Health check failed:', e);
      }
    }

    function updateStatus(type, status) {
      const el = document.getElementById(type + '-status');
      const msg = document.getElementById(type + '-msg');
      if (status === 'connected') {
        el.textContent = '✓';
        el.style.color = '#10b981';
        msg.textContent = 'Connected';
      } else {
        el.textContent = '✗';
        el.style.color = '#ef4444';
        msg.textContent = status || 'Disconnected';
      }
    }

    // Chat
    async function sendChat() {
      const model = document.getElementById('chat-model').value;
      const input = document.getElementById('chat-input');
      const text = input.value.trim();

      if (!text) return;

      // Add user message
      addChatMessage('user', text);
      input.value = '';

      // Get response
      try {
        const start = Date.now();
        const resp = await fetch('/v1/messages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: model,
            max_tokens: 200,
            messages: [{ role: 'user', content: text }],
            stream: false
          })
        });
        const time = Date.now() - start;

        if (resp.ok) {
          const data = await resp.json();
          const msg = data.content?.[0]?.text || 'No response';
          const outputTokens = data.usage?.output_tokens || 0;
          addChatMessage('assistant', msg, time, outputTokens);
          logRequest(model, '200', time, data.usage);
          stats.success++;
          stats.totalTime += time;
          stats.totalTokens += (data.usage?.input_tokens || 0) + outputTokens;
        } else {
          let errorMsg = 'Error ' + resp.status;
          try {
            const errData = await resp.json();
            if (errData.error?.message) {
              errorMsg += ': ' + errData.error.message;
            }
          } catch (e) {
            // Could not parse error response
          }
          addChatMessage('assistant', '❌ ' + errorMsg);
          stats.errors++;
        }
      } catch (e) {
        addChatMessage('assistant', '❌ ' + e.message);
        stats.errors++;
      }
      updateStats();
    }

    function addChatMessage(role, text, time = 0, tokens = 0) {
      const container = document.getElementById('chat-messages');
      const msg = document.createElement('div');
      msg.className = 'message ' + role;
      const timeStr = time > 0 ? \` (\${time}ms)\` : '';
      const tokensStr = tokens > 0 ? \` • \${tokens} tokens\` : '';
      msg.innerHTML = \`<div class="message-content">\${escapeHtml(text)}<div class="message-time">\${timeStr}\${tokensStr}</div></div>\`;
      container.appendChild(msg);
      container.scrollTop = container.scrollHeight;
    }

    // Request Log
    function logRequest(model, status, time, usage) {
      requestLog.unshift({
        time: new Date().toLocaleTimeString(),
        model: model,
        status: status,
        responseTime: time,
        tokens: (usage?.input_tokens || 0) + (usage?.output_tokens || 0)
      });
      if (requestLog.length > 20) requestLog.pop();
      updateLogs();
    }

    function updateLogs() {
      const tbody = document.getElementById('log-tbody');
      if (requestLog.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:#888;">No requests yet</td></tr>';
        return;
      }
      tbody.innerHTML = requestLog.map(r => \`
        <tr>
          <td>\${r.time}</td>
          <td><span class="model-tag">\${r.model.split('/').pop().substring(0, 20)}</span></td>
          <td class="status-\${r.status === '200' ? 'ok' : 'error'}">\${r.status}</td>
          <td>\${r.responseTime}ms</td>
          <td>\${r.tokens}</td>
        </tr>
      \`).join('');
    }

    // Stats
    function updateStats() {
      document.getElementById('total-reqs').textContent = requestLog.length;
      document.getElementById('stat-success').textContent = stats.success;
      document.getElementById('stat-errors').textContent = stats.errors;
      const avgTime = stats.success > 0 ? Math.round(stats.totalTime / stats.success) : 0;
      document.getElementById('stat-avg-time').textContent = avgTime + 'ms';
      document.getElementById('stat-tokens').textContent = stats.totalTokens;
    }

    // Settings
    function saveSettings() {
      const msg = document.getElementById('settings-msg');
      msg.textContent = '✓ Settings saved (client-side only)';
      setTimeout(() => msg.textContent = '', 3000);
    }

    // Utils
    function escapeHtml(text) {
      const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
      return text.replace(/[&<>"']/g, m => map[m]);
    }

    function toggleDarkMode() {
      document.body.style.filter = document.body.style.filter === 'invert(1)' ? '' : 'invert(1)';
    }

    // Init
    window.addEventListener('load', () => {
      checkHealth();
      updateStats();
      setInterval(checkHealth, 30000);
    });
  </script>
</body>
</html>`;

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
// PAYLOAD COMPRESSION (fixes 413 error)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Compress payload to fix 413 Payload Too Large error
 * - Removes tool definitions, tool_use blocks, tool_result blocks
 * - Removes images
 * - Truncates system prompt if > 28000 chars
 */
function compressPayload(openaiReq) {
  // 1. Remove tool_use and tool_result blocks from messages
  openaiReq.messages = openaiReq.messages.map(msg => {
    if (typeof msg.content === 'string') return msg;
    if (Array.isArray(msg.content)) {
      msg.content = msg.content.filter(block => {
        if (block.type === 'image') return false;        // Remove images
        if (block.type === 'tool_use') return false;     // Remove tool use
        if (block.type === 'tool_result') return false;  // Remove tool results
        return true;
      });
    }
    return msg;
  });

  // 2. Remove tool definitions entirely
  delete openaiReq.tools;
  delete openaiReq.tool_choice;

  // 3. Truncate system prompt if over 28000 chars
  for (let msg of openaiReq.messages) {
    if (msg.role === 'system' && typeof msg.content === 'string' && msg.content.length > 28000) {
      console.log(`  [Compressor] Truncating system prompt: ${msg.content.length} -> 28000 chars`);
      msg.content = msg.content.substring(0, 28000) + '\n\n[System prompt truncated by proxy]';
    }
  }

  // 4. Clean up empty messages
  openaiReq.messages = openaiReq.messages.filter(msg => {
    if (Array.isArray(msg.content) && msg.content.length === 0) return false;
    if (typeof msg.content === 'string' && msg.content.trim() === '') return false;
    return true;
  });

  return openaiReq;
}

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
  // Handle system as string or array (Claude Code with prompt caching)
  if (req.system) {
    let systemContent = req.system;
    if (typeof req.system === 'string') {
      systemContent = req.system;
    } else if (Array.isArray(req.system)) {
      // Flatten array of content blocks to string
      systemContent = req.system.map(b => b.text || '').join('\n');
    } else {
      systemContent = String(req.system);
    }
    messages.push({
      role: 'system',
      content: systemContent
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
    top_k: req.top_k,
    stop: req.stop_sequences || undefined
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
      // Handle tool_result content as string, array, or object
      let contentStr = block.content;
      if (typeof block.content === 'string') {
        contentStr = block.content;
      } else if (Array.isArray(block.content)) {
        contentStr = block.content.map(b => b.text || JSON.stringify(b)).join('\n');
      } else {
        contentStr = JSON.stringify(block.content);
      }
      parts.push(`[Tool Result: ${contentStr}]`);
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
 * Map Anthropic model names to Groq or local models
 * Falls back to original model name if not in map and looks like a direct model
 */
function mapModel(anthropicModel) {
  if (!anthropicModel) return DEFAULT_MODEL;

  // Check local model map first
  if (LOCAL_MODEL_MAP[anthropicModel]) {
    return LOCAL_MODEL_MAP[anthropicModel];
  }

  // Check if in known Groq map
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
 * Check if a mapped model is a local model
 */
function isLocalModel(mappedModel) {
  return Object.values(LOCAL_MODEL_MAP).includes(mappedModel);
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

  // Parse URL to get path without query string
  const urlObj = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = urlObj.pathname;

  // Handle /v1/messages/count_tokens (stub)
  if (req.method === 'POST' && pathname === '/v1/messages/count_tokens') {
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
  if (req.method === 'GET' && pathname === '/v1/models') {
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
  if (req.method === 'POST' && pathname === '/v1/messages') {
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

        // Translate to OpenAI format
        const openaiReq = anthropicToOpenAI(reqBody);
        if (DEBUG) console.log(`  [Translated] Model: ${openaiReq.model}, Stream: ${openaiReq.stream}`);

        // Check if it's a local model (doesn't need API key)
        if (!isLocalModel(openaiReq.model)) {
          // Check API key only for Groq requests
          const groqApiKey = process.env.GROQ_API_KEY;
          if (DEBUG) console.log(`  [Auth] Using GROQ_API_KEY: ${groqApiKey ? groqApiKey.substring(0, 10) + '...' : 'NOT SET'}`);

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
        }

        // Forward to appropriate backend (Groq or Local)
        forwardRequest(openaiReq.model, openaiReq, res, reqBody.stream === true, startTime);
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

  // Handle GET /health
  if (req.method === 'GET' && pathname === '/health') {
    const health = { proxy: 'running', port: PORT, groq_api: 'unknown', local_model: 'unknown' };

    // Check Groq connectivity
    https.get('https://api.groq.com/openai/v1/models', {
      headers: { 'Authorization': 'Bearer ' + (process.env.GROQ_API_KEY || '') },
      timeout: 3000
    }, (r) => {
      health.groq_api = r.statusCode === 200 ? 'connected' : 'error_' + r.statusCode;
      checkDone();
    }).on('error', () => { health.groq_api = 'unreachable'; checkDone(); });

    // Check local model connectivity
    try {
      const lu = new URL(LOCAL_MODEL_URL);
      http.get({ hostname: lu.hostname, port: lu.port || 80, path: lu.pathname.split('/').slice(0, -1).join('/') + '/api/tags', timeout: 3000 }, (r) => {
        health.local_model = r.statusCode === 200 ? 'connected' : 'error_' + r.statusCode;
        checkDone();
      }).on('error', () => { health.local_model = 'unreachable'; checkDone(); });
    } catch(e) { health.local_model = 'unreachable'; checkDone(); }

    let checks = 0;
    function checkDone() { if (++checks === 2) { res.writeHead(200, {'Content-Type':'application/json'}); res.end(JSON.stringify(health,null,2)); } }
    return;
  }

  // Handle GET / (dashboard)
  if (req.method === 'GET' && (pathname === '/' || pathname === '/ui')) {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(DASHBOARD_HTML);
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
 * Forward request to Groq or Local model API with response translation
 */
function forwardRequest(mappedModel, openaiReq, res, isStreaming, startTime) {
  if (isLocalModel(mappedModel)) {
    // Forward to local model
    forwardToLocalModel(openaiReq, res, isStreaming, startTime);
  } else {
    // Forward to Groq
    forwardToGroq(openaiReq, res, isStreaming, startTime);
  }
}

function forwardToLocalModel(openaiReq, res, isStreaming, startTime) {
  const reqBody = JSON.stringify(openaiReq);
  const bodySize = Buffer.byteLength(reqBody);

  if (DEBUG) console.log(`  [Local] Size: ${bodySize} bytes, Stream: ${isStreaming}`);

  try {
    const lu = new URL(LOCAL_MODEL_URL);
    const options = {
      hostname: lu.hostname,
      port: lu.port || 80,
      path: lu.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(reqBody)
      }
    };

    const localReq = http.request(options, (localRes) => {
      if (DEBUG) console.log(`  [Local] Status: ${localRes.statusCode}`);

      if (localRes.statusCode !== 200) {
        let errorBody = '';
        localRes.on('data', chunk => errorBody += chunk);
        localRes.on('end', () => {
          res.writeHead(localRes.statusCode, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ type: 'error', error: { type: 'api_error', message: errorBody || 'Local model error' } }));
        });
        return;
      }

      if (isStreaming) {
        handleStreamResponse(localRes, res, startTime, openaiReq);
      } else {
        handleNonStreamResponse(localRes, res, startTime);
      }
    });

    localReq.on('error', (err) => {
      console.error('  [Local Error]', err.message);
      if (!res.headersSent) {
        res.writeHead(502, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          type: 'error',
          error: {
            type: 'api_error',
            message: `Local model error: ${err.message}`
          }
        }));
      }
    });

    localReq.setTimeout(TIMEOUT);
    localReq.write(reqBody);
    localReq.end();
  } catch (err) {
    console.error('  [Local Config Error]', err.message);
    if (!res.headersSent) {
      res.writeHead(502, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        type: 'error',
        error: {
          type: 'api_error',
          message: `Local model config error: ${err.message}`
        }
      }));
    }
  }
}

/**
 * Forward request to Groq API with response translation
 */
function forwardToGroq(openaiReq, res, isStreaming, startTime) {
  // Get API key from environment
  const groqApiKey = process.env.GROQ_API_KEY;
  if (!groqApiKey) {
    res.writeHead(401, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ type: 'error', error: { type: 'authentication_error', message: 'GROQ_API_KEY not set' } }));
    return;
  }

  // Compress payload to fix 413 error
  openaiReq = compressPayload(openaiReq);

  const reqBody = JSON.stringify(openaiReq);
  const bodySize = Buffer.byteLength(reqBody);

  if (DEBUG) {
    console.log(`  [Request] Body size: ${(bodySize / 1024).toFixed(1)} KB`);
    console.log(`  [Request] Messages: ${openaiReq.messages.length}`);
  }
  console.log(`  [Request] Size: ${bodySize} bytes, Stream: ${isStreaming}`);

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
      handleStreamResponse(groqRes, res, startTime, openaiReq);
    } else {
      handleNonStreamResponse(groqRes, res, startTime);
    }
  });

  groqReq.on('error', (err) => {
    console.error('  [Groq Error]', err.message);
    if (!res.headersSent) {
      res.writeHead(502, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        type: 'error',
        error: {
          type: 'api_error',
          message: `Groq API error: ${err.message}`
        }
      }));
    }
  });

  groqReq.setTimeout(TIMEOUT);
  groqReq.write(reqBody);
  groqReq.end();
}

/**
 * Handle non-streaming response from Groq
 * FIXED: Added error handler and res.headersSent guards
 */
function handleNonStreamResponse(groqRes, res, startTime) {
  let body = '';

  groqRes.on('data', (chunk) => {
    body += chunk;
  });

  groqRes.on('error', (err) => {
    console.error('  [NonStream Error]', err.message);
    if (!res.headersSent) {
      res.writeHead(502, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        type: 'error',
        error: {
          type: 'api_error',
          message: `Stream error: ${err.message}`
        }
      }));
    }
  });

  groqRes.on('end', () => {
    try {
      const openaiResp = JSON.parse(body);
      const anthropicResp = openAIToAnthropic(openaiResp);

      if (!res.headersSent) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
      }
      res.end(JSON.stringify(anthropicResp));
      if (DEBUG) console.log(`  [Response] Converted to Anthropic format - ${Date.now() - startTime}ms`);
    } catch (err) {
      console.error('  [Response Error]', err.message);
      if (!res.headersSent) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          type: 'error',
          error: {
            type: 'api_error',
            message: `Failed to translate response: ${err.message}`
          }
        }));
      }
    }
  });
}

/**
 * Handle streaming response from Groq - convert SSE to Anthropic format
 * FIXED: streamState is now LOCAL per-request (not global)
 * FIXED: All events now include event: field and ping interval for keep-alive
 */
function handleStreamResponse(groqRes, res, startTime, requestBody) {
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
  const responseModel = requestBody?.model || 'claude-3-sonnet';

  // Send initial message_start event with usage
  const messageStart = {
    type: 'message_start',
    message: {
      id: messageId,
      type: 'message',
      role: 'assistant',
      content: [],
      model: responseModel,
      stop_reason: null,
      usage: {
        input_tokens: 0,
        output_tokens: 0
      }
    }
  };
  res.write(`event: message_start\ndata: ${JSON.stringify(messageStart)}\n\n`);

  // Set up ping interval to keep connection alive
  const pingInterval = setInterval(() => {
    try {
      res.write(`event: ping\ndata: {"type":"ping"}\n\n`);
    } catch (e) {
      // Client may have disconnected
    }
  }, 15000);

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
            const eventType = event.type || 'content_block_delta';
            res.write(`event: ${eventType}\ndata: ${JSON.stringify(event)}\n\n`);
          }
        } else if (events) {
          const eventType = events.type || 'content_block_delta';
          res.write(`event: ${eventType}\ndata: ${JSON.stringify(events)}\n\n`);
        }
      } catch (err) {
        console.error('  [Stream Error]', err.message);
      }
    }
  });

  groqRes.on('end', () => {
    clearInterval(pingInterval);

    // Process any remaining buffer
    if (buffer.trim()) {
      try {
        const events = convertOpenAIStreamEvent(buffer, streamState);
        if (Array.isArray(events)) {
          for (const event of events) {
            const eventType = event.type || 'content_block_delta';
            res.write(`event: ${eventType}\ndata: ${JSON.stringify(event)}\n\n`);
          }
        } else if (events) {
          const eventType = events.type || 'content_block_delta';
          res.write(`event: ${eventType}\ndata: ${JSON.stringify(events)}\n\n`);
        }
      } catch (err) {
        console.error('  [Stream Error]', err.message);
      }
    }

    // Send content_block_stop if we started a block
    if (streamState.blockStarted && !streamState.blockStopped) {
      res.write(`event: content_block_stop\ndata: ${JSON.stringify({
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
    res.write(`event: message_delta\ndata: ${JSON.stringify(messageDelta)}\n\n`);

    // Send final message_stop
    res.write(`event: message_stop\ndata: ${JSON.stringify({ type: 'message_stop' })}\n\n`);
    res.end();

    if (DEBUG) console.log(`  [Stream] Completed - ${Date.now() - startTime}ms (${streamState.outputTokens} tokens)`);
  });

  groqRes.on('error', (err) => {
    clearInterval(pingInterval);
    console.error('  [Stream Error]', err.message);
    // Send error event if client still listening
    try {
      res.write(`event: error\ndata: ${JSON.stringify({
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
    clearInterval(pingInterval);
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
║  Anthropic ↔ OpenAI/Groq/Local Model Proxy (v3.0)        ║
╚════════════════════════════════════════════════════════════╝

  Listening on http://localhost:${PORT}

  Endpoints:
    GET  /                         → Web Dashboard
    GET  /health                   → Health check (JSON)
    POST /v1/messages              → Groq/Local API
    POST /v1/messages/count_tokens → Stub response
    GET  /v1/models                → Model list

  Features:
    ✓ Payload compression (fixes 413 error)
    ✓ Local model support (Ollama, LM Studio, vLLM)
    ✓ Web dashboard with model tester
    ✓ Health check endpoint
    ✓ Full Anthropic SSE streaming
    ✓ Latest Groq model mappings (Llama 4 Scout, Llama 3.3, Llama 3.1)
    ✓ Request size logging
    ✓ Concurrent streaming (no global state)

  Configuration:
    PORT=${PORT}
    TIMEOUT=${TIMEOUT}ms
    DEBUG=${DEBUG}
    LOCAL_MODEL_URL=${LOCAL_MODEL_URL}
    LOCAL_MODEL_NAME=${LOCAL_MODEL_NAME}

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
