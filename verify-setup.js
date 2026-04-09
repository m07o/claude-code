#!/usr/bin/env node
/**
 * verify-setup.js - Validate proxy setup and configuration
 *
 * Usage:
 *   node verify-setup.js
 *
 * This checks:
 *   - proxy.js exists and is valid
 *   - Node.js version is compatible
 *   - Required ports are available
 *   - Authorization header format
 */

const fs = require('fs');
const net = require('net');
const path = require('path');

const CHECKS = [];
let passed = 0;
let failed = 0;

function check(name, condition, message = '') {
  const status = condition ? '✓' : '✗';
  const color = condition ? '\x1b[32m' : '\x1b[31m';
  const reset = '\x1b[0m';

  console.log(`${color}${status}${reset} ${name}`);
  if (message) console.log(`  ${message}`);

  if (condition) passed++;
  else failed++;

  return condition;
}

function checkPort(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once('error', () => resolve(false));
    server.once('listening', () => {
      server.close();
      resolve(true);
    });
    server.listen(port, '127.0.0.1');
  });
}

async function main() {
  console.log(`
╔════════════════════════════════════════════════════════════╗
║  Anthropic ↔ OpenAI Proxy - Setup Verification            ║
╚════════════════════════════════════════════════════════════╝
`);

  // 1. Node.js version
  const nodeVersion = process.version;
  const majorVersion = parseInt(nodeVersion.substring(1));
  check(
    'Node.js version',
    majorVersion >= 14,
    `Version: ${nodeVersion} (requires 14+)`
  );

  // 2. Check proxy.js exists
  const proxyPath = path.join(__dirname, 'proxy.js');
  check(
    'proxy.js exists',
    fs.existsSync(proxyPath),
    `Path: ${proxyPath}`
  );

  // 3. Check proxy.js syntax
  if (fs.existsSync(proxyPath)) {
    try {
      const content = fs.readFileSync(proxyPath, 'utf-8');
      // Quick syntax check by looking for required patterns
      const hasFunctions = content.includes('anthropicToOpenAI') &&
                          content.includes('openAIToAnthropic') &&
                          content.includes('http.createServer');
      check(
        'proxy.js has valid structure',
        hasFunctions,
        'Contains required translation functions'
      );

      check(
        'proxy.js is readable',
        content.length > 1000,
        `Size: ${(content.length / 1024).toFixed(1)} KB`
      );
    } catch (e) {
      check('proxy.js is readable', false, e.message);
    }
  }

  // 4. Check test-proxy.js exists
  const testPath = path.join(__dirname, 'test-proxy.js');
  check(
    'test-proxy.js exists',
    fs.existsSync(testPath),
    'For testing the proxy'
  );

  // 5. Check port 3000 availability
  console.log('\nChecking port availability...');
  const port3000Available = await checkPort(3000);
  check(
    'Port 3000 available',
    port3000Available,
    port3000Available
      ? 'Ready to use'
      : 'Port may be in use (specify PORT env var to override)'
  );

  // 6. Check Groq API key format
  const groqKey = process.env.GROQ_API_KEY;
  if (groqKey) {
    check(
      'GROQ_API_KEY set',
      true,
      `Key: ${groqKey.substring(0, 10)}...${groqKey.substring(groqKey.length - 5)}`
    );
    check(
      'GROQ_API_KEY format valid',
      groqKey.startsWith('gsk_'),
      'Should start with "gsk_"'
    );
  } else {
    check(
      'GROQ_API_KEY set',
      false,
      'Set with: export GROQ_API_KEY=gsk_xxx'
    );
  }

  // 7. Check for common issues
  console.log('\nCommon Configuration Issues:');

  const cliPath = path.join(__dirname, 'package', 'cli.js');
  if (fs.existsSync(cliPath)) {
    try {
      const cliContent = fs.readFileSync(cliPath, 'utf-8');
      check(
        'CLI is patched to use localhost:3000',
        cliContent.includes('localhost:3000') || cliContent.includes('127.0.0.1:3000'),
        'CLI should redirect to proxy'
      );
    } catch (e) {
      // Ignore
    }
  }

  // 8. Summary
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Checks Passed: ${passed}`);
  console.log(`Checks Failed: ${failed}`);

  if (failed === 0) {
    console.log(`\n✓ All checks passed! You're ready to go.`);
    console.log(`\nStart the proxy with:`);
    console.log(`  node proxy.js`);
    console.log(`\nTest it with:`);
    console.log(`  GROQ_API_KEY=gsk_xxx node test-proxy.js`);
  } else {
    console.log(`\n✗ ${failed} check(s) failed. Please address the above issues.`);
  }

  console.log(`\n${'='.repeat(60)}\n`);

  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('Verification error:', err);
  process.exit(1);
});
