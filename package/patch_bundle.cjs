#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// ANSI colors for output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[36m'
};

function log(status, message) {
  if (status === 'OK') {
    console.log(`${colors.green}[OK]${colors.reset} ${message}`);
  } else if (status === 'FAIL') {
    console.log(`${colors.red}[FAIL]${colors.reset} ${message}`);
  } else if (status === 'WARN') {
    console.log(`${colors.yellow}[WARN]${colors.reset} ${message}`);
  } else if (status === 'INFO') {
    console.log(`${colors.blue}[INFO]${colors.reset} ${message}`);
  }
}

function findAllOccurrences(text, search) {
  let count = 0;
  let index = text.indexOf(search);
  const indices = [];
  while (index !== -1) {
    indices.push(index);
    count++;
    index = text.indexOf(search, index + 1);
  }
  return { count, indices };
}

function replaceAll(text, search, replace) {
  return text.split(search).join(replace);
}

// Read the backup file
console.log('\n=== Claude Code CLI Bundle Patcher ===\n');
console.log('Reading bundle...');

let bundleContent;
try {
  bundleContent = fs.readFileSync('./cli.js.backup', 'utf8');
  log('INFO', `Bundle loaded: ${(bundleContent.length / 1024 / 1024).toFixed(2)} MB`);
} catch (err) {
  log('FAIL', `Could not read ./cli.js.backup: ${err.message}`);
  process.exit(1);
}

const originalSize = bundleContent.length;
let patchCount = 0;

// ============================================================
// PATCH Groq-0: Groq API URL Redirect (for native v2.1.88 support)
// ============================================================
console.log('\n--- PATCH Groq-0: Groq Integration (v2.1.88+) ---');

// Handle native Groq support in v2.1.88+
const groqUrlsSearch = [
  {
    name: 'Groq-full-URL',
    search: 'https://api.groq.com/openai/v1/chat/completions',
    replace: 'http://localhost:3000/v1/messages'
  },
  {
    name: 'Groq-base-path',
    search: 'https://api.groq.com/openai/v1',
    replace: 'http://localhost:3000'
  },
  {
    name: 'Groq-domain',
    search: 'api.groq.com',
    replace: 'localhost:3000'
  }
];

groqUrlsSearch.forEach(url => {
  const { count } = findAllOccurrences(bundleContent, url.search);
  if (count > 0) {
    bundleContent = replaceAll(bundleContent, url.search, url.replace);
    log('OK', `${url.name} - Replaced ${count} occurrence(s)`);
    patchCount++;
  }
});

// Handle GROQ_API_KEY environment variable references
const groqEnvCheck = findAllOccurrences(bundleContent, 'GROQ_API_KEY');
if (groqEnvCheck.count > 0) {
  log('INFO', `Found ${groqEnvCheck.count} reference(s) to GROQ_API_KEY - These will check for Groq and redirect to localhost:3000`);
}

// ============================================================
// PATCH F: Disable Auto-Update
// ============================================================
console.log('\n--- PATCH F: Disable Auto-Update (v2.1.88+) ---');

// Auto-update is controlled by environment variables in the CLI
// Make sure DISABLE_AUTOUPDATE flag is respected
const f1Search = 'process.env.DISABLE_AUTOUPDATE';
const { count: f1Count } = findAllOccurrences(bundleContent, f1Search);
log('INFO', `Found ${f1Count} reference(s) to DISABLE_AUTOUPDATE - env var check is built in`);

// Also look for the autoUpdates config setting that might trigger updates
const f2Search = 'autoUpdates===!1';
const { count: f2Count } = findAllOccurrences(bundleContent, f2Search);
if (f2Count > 0) {
  log('INFO', `Found ${f2Count} check(s) for autoUpdates===false`);
}

log('INFO', '✓ Auto-update is already controlled by $env:DISABLE_AUTOUPDATE=1');

// ============================================================
// PATCH G: Disable Groq Provider Detection (Force Anthropic Path)
// ============================================================
console.log('\n--- PATCH G: Disable Groq Provider Detection (v2.1.88+) ---');

// In v2.1.88+, Groq detection is based on GROQ_API_KEY env var presence
// We need to ensure that when running, Groq provider is NOT used
// Strategy: Leave GROQ_API_KEY unset, OR patch any Groq detection code

const g1Search = 'GROQ_API_KEY';
const { count: g1Count } = findAllOccurrences(bundleContent, g1Search);
if (g1Count > 0) {
  log('INFO', `Found ${g1Count} reference(s) to GROQ_API_KEY - Groq detection is env var based`);
  log('INFO', '✓ Set $env:GROQ_API_KEY="" (empty) to force Anthropic path');
} else {
  log('INFO', 'No GROQ_API_KEY references found - likely old version, patches will handle any Groq URLs');
}

// ============================================================
// PATCH H: Replace ALL Groq URLs (Safety Comprehensive Patch)
// ============================================================
console.log('\n--- PATCH H: Comprehensive Groq URL Replacement ---');

const groqUrlReplacements = [
  { name: 'H1-groq-complete', search: 'https://api.groq.com/openai/v1/chat/completions', replace: 'http://localhost:3000/v1/messages' },
  { name: 'H2-groq-basepath', search: 'https://api.groq.com/openai/v1', replace: 'http://localhost:3000' },
  { name: 'H3-groq-domain', search: 'api.groq.com', replace: 'localhost:3000' },
  { name: 'H4-openai-v1', search: '/openai/v1/chat/completions', replace: '/v1/messages' },
  { name: 'H5-openai-path', search: '/openai/v1', replace: '' }  // Remove /openai/v1 prefix if it exists
];

groqUrlReplacements.forEach(replacement => {
  const { count } = findAllOccurrences(bundleContent, replacement.search);
  if (count > 0) {
    bundleContent = replaceAll(bundleContent, replacement.search, replacement.replace);
    log('OK', `${replacement.name} - Replaced ${count} occurrence(s)`);
    patchCount++;
  }
});

log('INFO', 'H - All Groq URLs redirected to localhost:3000');

// ============================================================
// PATCH A: Model Validation Bypass
// ============================================================
console.log('\n--- PATCH A: Model Validation Bypass ---');

const patchesA = [
  {
    name: 'A1',
    search: 'is not available on your ${E7()} deployment',
    replace: 'is available (bypassed deployment check)'
  },
  {
    name: 'A2',
    search: 'Skipped model issue (${K}). It may not exist or you may not have access to it. Run ${z} to pick a different model.',
    replace: 'Model accepted (bypassed). Run ${z} to pick a different model.'
  },
  {
    name: 'A3',
    search: 'q instanceof Qq&&q.status===404){let z=i7()?"--model":"/model"',
    replace: 'q instanceof Qq&&q.status===0){let z=i7()?"--model":"/model"'
  },
  {
    name: 'A4',
    search: 'Streaming endpoint returned 404',
    replace: 'Streaming endpoint returned 200'
  },
  {
    name: 'A5',
    search: 'includes("invalid model name")',
    replace: 'includes("___bypassed_invalid_model_name___")'
  },
  {
    name: 'A6',
    search: "Model '${Y}' not found",
    replace: "Model '${Y}' found (bypassed)"
  },
  {
    name: 'A7',
    search: '"invalid x-api-key"',
    replace: '"invalid_api_key_bypassed"'
  }
];

patchesA.forEach(patch => {
  const { count } = findAllOccurrences(bundleContent, patch.search);
  if (count > 0) {
    bundleContent = replaceAll(bundleContent, patch.search, patch.replace);
    log('OK', `${patch.name} - Replaced ${count} occurrence(s)`);
    patchCount++;
  } else {
    log('WARN', `${patch.name} - Not found: "${patch.search}"`);
  }
});

// ============================================================
// PATCH B: API URL → localhost:3000
// ============================================================
console.log('\n--- PATCH B: API URL Redirect ---');

const b1Search = 'https://api.anthropic.com';
const b1Replace = 'http://localhost:3000';
const { count: b1Count } = findAllOccurrences(bundleContent, b1Search);

if (b1Count > 0) {
  bundleContent = replaceAll(bundleContent, b1Search, b1Replace);
  log('OK', `B1 - Replaced all ${b1Count} occurrences of "https://api.anthropic.com"`);
  patchCount++;
} else {
  log('FAIL', 'B1 - "https://api.anthropic.com" not found');
}

// B1-fix: Fix WP() function
const b1fixSearch = 'return["localhost:3000"].includes(K)}catch{return!1}}';
const b1fixReplace = 'return["api.anthropic.com","localhost:3000"].includes(K)}catch{return!0}}';

if (bundleContent.includes(b1fixSearch)) {
  bundleContent = replaceAll(bundleContent, b1fixSearch, b1fixReplace);
  log('OK', 'B1-fix - WP() function updated to accept both hosts');
  patchCount++;
} else {
  log('WARN', 'B1-fix - Expected string not found, checking if fix already applied...');
  if (bundleContent.includes(b1fixReplace)) {
    log('OK', 'B1-fix - Already applied');
  }
}

// ============================================================
// PATCH C: Fix SDK Header Suppression
// ============================================================
console.log('\n--- PATCH C: SDK isNotFirstParty Fix ---');

const c1Search = 'this.baseURL!=="https://api.anthropic.com"';
const c1Replace = 'this.baseURL!=="http://localhost:3000"&&this.baseURL!=="https://api.anthropic.com"';

if (bundleContent.includes(c1Search)) {
  bundleContent = replaceAll(bundleContent, c1Search, c1Replace);
  log('OK', 'C1 - isNotFirstParty check updated for localhost:3000');
  patchCount++;
} else {
  log('WARN', 'C1 - String not found, may already be patched');
}

// ============================================================
// PATCH D: Environment Variable (no code changes needed)
// ============================================================
console.log('\n--- PATCH D: API Key Environment ---');
log('INFO', 'D - No code changes needed. User must set: $env:ANTHROPIC_API_KEY');

// ============================================================
// PATCH E: Auth Bypass
// ============================================================
console.log('\n--- PATCH E: Authentication Bypass ---');

// E1: Force d7() to return false
const e1Search = 'function d7(){if(!WJ())return!1;return KS(Kq()?.scopes)}';
const e1Replace = 'function d7(){return!1}';

if (bundleContent.includes(e1Search)) {
  bundleContent = replaceAll(bundleContent, e1Search, e1Replace);
  log('OK', 'E1 - d7() forced to return false');
  patchCount++;
} else {
  log('WARN', 'E1 - d7() function not found with exact signature');
}

// E2: Neutralize SDK Auth Error String
const e2Search = 'Could not resolve authentication method. Expected either apiKey or authToken to be set. Or for one of the "X-Api-Key" or "Authorization" headers to be explicitly omitted';
const e2Replace = 'Authentication resolved (patched)';

if (bundleContent.includes(e2Search)) {
  bundleContent = replaceAll(bundleContent, e2Search, e2Replace);
  log('OK', 'E2 - Auth error message neutralized');
  patchCount++;
} else {
  log('WARN', 'E2 - Auth error message not found');
}

// E4: Fake Kq() Credentials (no code changes needed)
log('INFO', 'E4 - No code changes needed. User must set: $env:CLAUDE_CODE_OAUTH_TOKEN = "fake-token"');

// E5: Jm() returns false (automatic with env vars)
log('INFO', 'E5 - Automatic with CLAUDE_CODE_OAUTH_TOKEN env var');

// E6: Neutralize token revocation
const e6Search = 'Kq()?.accessToken;if(M)await OS(M)';
const e6Replace = 'Kq()?.accessToken;if(!1)await OS(M)';

if (bundleContent.includes(e6Search)) {
  bundleContent = replaceAll(bundleContent, e6Search, e6Replace);
  log('OK', 'E6 - Token revocation disabled');
  patchCount++;
} else {
  log('WARN', 'E6 - Token revocation string not found');
}

// E7: Force Pm() to return false - use a more flexible pattern
// Search for the complete function including the code that comes after the checks
const e7Search = 'function Pm(){if(cU!==void 0)return cU;if(E7()!=="firstParty")return cU=Ce(!1);if(!WP())return cU=Ce(!1);if(process.env.CLAUDE_CODE_ENTRYPOINT==="local-agent")return cU=Ce(!1);let q=Kq();if(q?.accessToken&&q.subscriptionType===null)return cU=Ce(!0);if(q?.accessToken&&q.scopes?.includes(Mh)&&(q.subscriptionType==="enterprise"||q.subscriptionType==="team"))return cU=Ce(!0);try{let{key:K}=Ow({skipRetrievingKeyFromApiKeyHelper:!0});if(K)return cU=Ce(!0)}catch{}return cU=Ce(!1)}';
const e7Replace = 'function Pm(){return Ce(!1)}';

if (bundleContent.includes(e7Search)) {
  bundleContent = replaceAll(bundleContent, e7Search, e7Replace);
  log('OK', 'E7 - Pm() forced to return false (complete function replaced)');
  patchCount++;
} else {
  log('WARN', 'E7 - Pm() function not found with exact signature, skipping');
}

// E8: Neutralize auth error strings
console.log('\n--- PATCH E8: Auth Error Strings ---');

const patchesE8 = [
  {
    name: 'E8-1',
    search: 'No access token available',
    replace: 'Token check bypassed (patched)'
  },
  {
    name: 'E8-2',
    search: 'Not authenticated with a claude.ai account. Run /login and try again.',
    replace: 'Auth bypassed (patched). Continue.'
  },
  {
    name: 'E8-3',
    search: 'Claude Code web sessions require authentication with a Claude.ai account. API key authentication is not sufficient. Please run /login',
    replace: 'Session auth bypassed (patched). Continue.'
  },
  {
    name: 'E8-4',
    search: 'Not signed in to Claude. Run /login first.',
    replace: 'Auth bypassed (patched).'
  },
  {
    name: 'E8-5',
    search: 'Run /login',
    replace: 'Auth bypassed'
  }
];

patchesE8.forEach(patch => {
  const { count } = findAllOccurrences(bundleContent, patch.search);
  if (count > 0) {
    bundleContent = replaceAll(bundleContent, patch.search, patch.replace);
    log('OK', `${patch.name} - Replaced ${count} occurrence(s)`);
    patchCount++;
  } else {
    log('WARN', `${patch.name} - Not found: "${patch.search}"`);
  }
});

// ============================================================
// Write the patched bundle
// ============================================================
console.log('\n--- Writing Patched Bundle ---');

try {
  fs.writeFileSync('./cli.js', bundleContent, 'utf8');
  const newSize = bundleContent.length;
  const sizeDiff = ((newSize - originalSize) / originalSize * 100).toFixed(2);
  log('OK', `cli.js written (${(newSize / 1024 / 1024).toFixed(2)} MB, ${sizeDiff}% change)`);
} catch (err) {
  log('FAIL', `Could not write cli.js: ${err.message}`);
  process.exit(1);
}

// ============================================================
// Verification Checks
// ============================================================
console.log('\n--- Verification Checks ---');

const verifications = [
  {
    name: 'api.anthropic.com REMOVED',
    check: !bundleContent.includes('https://api.anthropic.com'),
    description: '"https://api.anthropic.com" should not appear'
  },
  {
    name: 'localhost:3000 PRESENT',
    check: bundleContent.includes('http://localhost:3000'),
    description: '"http://localhost:3000" should be present'
  },
  {
    name: 'd7() = false',
    check: bundleContent.includes('function d7(){return!1}'),
    description: 'd7() should return false'
  },
  {
    name: 'Pm() = false',
    check: bundleContent.includes('function Pm(){return Ce(!1)}'),
    description: 'Pm() should return false'
  },
  {
    name: 'Auth error REMOVED',
    check: !bundleContent.includes('Could not resolve authentication method. Expected either apiKey or authToken'),
    description: 'Original auth error should be removed'
  },
  {
    name: 'Token revocation disabled',
    check: bundleContent.includes('if(!1)await OS(M)'),
    description: 'Token revocation should be disabled'
  },
  {
    name: '/v1/messages PRESENT',
    check: bundleContent.includes('/v1/messages'),
    description: 'Proxy endpoint path preserved'
  },
  {
    name: 'anthropic-version PRESENT',
    check: bundleContent.includes('anthropic-version'),
    description: 'Header preserved for proxy'
  },
  {
    name: 'x-api-key PRESENT',
    check: bundleContent.includes('x-api-key'),
    description: 'Header preserved for proxy'
  },
  {
    name: 'ANTHROPIC_API_KEY PRESENT',
    check: bundleContent.includes('ANTHROPIC_API_KEY'),
    description: 'Env var reference preserved'
  }
];

let allPassedVerifications = true;
verifications.forEach(v => {
  if (v.check) {
    log('OK', `${v.name}`);
  } else {
    log('WARN', `${v.name} - ${v.description}`);
    allPassedVerifications = false;
  }
});

// File size check
const sizeDiffPercent = Math.abs((bundleContent.length - originalSize) / originalSize * 100);
if (sizeDiffPercent <= 5) {
  log('OK', `File size check (${sizeDiffPercent.toFixed(2)}% difference)`);
} else {
  log('WARN', `File size changed by ${sizeDiffPercent.toFixed(2)}% (expected ±5%)`);
}

// Syntax check
console.log('\n--- Syntax Validation ---');
try {
  execSync('node -c ./cli.js', { stdio: 'pipe' });
  log('OK', 'Syntax check passed: node -c cli.js');
} catch (err) {
  log('FAIL', `Syntax check failed: ${err.message}`);
  process.exit(1);
}

// ============================================================
// Summary
// ============================================================
console.log('\n=== Summary ===');
log('INFO', `Total patches applied: ${patchCount}`);
log('INFO', `Bundle size: ${(originalSize / 1024 / 1024).toFixed(2)} MB → ${(bundleContent.length / 1024 / 1024).toFixed(2)} MB`);

console.log('\n=== Next Steps ===\n');
console.log('1. Set environment variables (PowerShell):');
console.log('   Terminal 1 (Proxy):');
console.log('   $env:GROQ_API_KEY = "gsk_YOUR_KEY_HERE"');
console.log('   node proxy.js\n');
console.log('   Terminal 2 (Claude Code):');
console.log('   $env:ANTHROPIC_API_KEY = "gsk_YOUR_KEY_HERE"');
console.log('   $env:CLAUDE_CODE_OAUTH_TOKEN = "fake-token"');
console.log('   node cli.js\n');
console.log('2. Important notes:');
console.log('   - ANTHROPIC_API_KEY and GROQ_API_KEY must have the SAME value (your Groq API key)');
console.log('   - CLAUDE_CODE_OAUTH_TOKEN can be any string — it bypasses OAuth checks');
console.log('   - Terminal 1 (proxy) must start BEFORE Terminal 2');
console.log('   - For debugging: $env:DEBUG = "1" before running proxy.js\n');

if (allPassedVerifications) {
  log('OK', 'Patch completed successfully!');
} else {
  log('WARN', 'Patch completed with warnings. Please review above.');
}
