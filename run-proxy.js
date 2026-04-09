#!/usr/bin/env node
/**
 * run-proxy.sh - Simple proxy startup script with environment validation
 *
 * Usage:
 *   node run-proxy.js
 *   ./run-proxy.sh            (after chmod +x)
 */

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

console.log(`
╔════════════════════════════════════════════════════════════╗
║  Starting Anthropic ↔ OpenAI/Groq Protocol Proxy          ║
╚════════════════════════════════════════════════════════════╝
`);

// 1. Check environment
console.log('Checking environment...\n');

const groqKey = process.env.GROQ_API_KEY;
if (!groqKey) {
  console.warn('⚠ GROQ_API_KEY not set');
  console.log('  The proxy will accept requests but may fail to forward to Groq.');
  console.log('  Set it with:');
  console.log('    export GROQ_API_KEY=gsk_xxx');
  console.log('    Windows: set GROQ_API_KEY=gsk_xxx\n');
} else {
  console.log(`✓ GROQ_API_KEY: ${groqKey.substring(0, 10)}...${groqKey.substring(groqKey.length - 5)}\n`);
}

// 2. Check port
const PORT = process.env.PORT || 3000;
console.log(`✓ Port: ${PORT}`);
console.log(`✓ Proxy URL: http://localhost:${PORT}`);
console.log('');

// 3. Start proxy
console.log('Starting proxy server...\n');

const proxyPath = path.join(__dirname, 'proxy.js');
const proxyProcess = spawn('node', [proxyPath], {
  env: { ...process.env, PORT },
  stdio: 'inherit'
});

// Handle process termination
process.on('SIGINT', () => {
  console.log('\n\nShutting down...');
  proxyProcess.kill('SIGTERM');
  setTimeout(() => process.exit(0), 100);
});

proxyProcess.on('error', (err) => {
  console.error('Failed to start proxy:', err);
  process.exit(1);
});

// Keep process alive
proxyProcess.on('exit', (code) => {
  console.log(`\nProxy exited with code ${code}`);
  process.exit(code);
});
