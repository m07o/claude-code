# Changelog

All notable changes to this project will be documented in this file.

## [2.1.88-dev] - 2026-04-10

### Added
- ✨ **Groq API Support** - Proxy translates Anthropic Messages API ↔ OpenAI Chat Completions API
- ✨ **Local Model Support** - Via Ollama, LM Studio, vLLM (tested: llama3.2:1b)
- ✨ **Web Dashboard** - Full-featured UI with:
  - Sidebar navigation (Dashboard, Chat, Logs, Settings, Models)
  - Real-time chat interface with message history
  - Request log viewer with status tracking
  - Configuration panel for model settings
  - Live statistics (success rate, response time, token usage)
  - Dark/Light mode toggle
- ✨ **VS Code Integration** - Complete dev environment setup:
  - `tasks.json` with 4 configurable tasks
  - `launch.json` for debugging
  - npm scripts (proxy, proxy:debug, proxy:test)
- ✨ **Payload Compression** - Automatic fix for Groq 413 errors
  - Removes tool definitions and images
  - Truncates system prompt to 28KB
  - Removes empty messages
- ✨ **Batch Launchers** - One-click Windows scripts:
  - `Start.bat` - Launch proxy with error checking
  - `Stop.bat` - Kill proxy on port 3002
  - `Open-Terminal.bat` - Open VS Code with validation
  - `Open-Dashboard.bat` - Open dashboard in browser
- ✨ **Documentation** - Comprehensive guides in multiple languages:
  - `README.md` - Arabic documentation
  - `READMEen.md` - English documentation
  - Both include features, installation, usage, troubleshooting

### Fixed
- 🐛 **413 Payload Too Large** - Groq API was rejecting ~30KB system prompts
  - Added `compressPayload()` function
  - Strips unnecessary content before forwarding
- 🐛 **Local Model Routing** - Fixed model name mapping
  - Added `LOCAL_MODEL_MAP` configuration
  - Proper Ollama model name detection
  - Removed Groq API key requirement for local models
- 🐛 **Model Mapping** - Updated to latest available models from Groq
- 🐛 **Batch Files** - Rewrote with proper error handling and validation
- 🐛 **Port Configuration** - Changed default from 3000 to 3002
- 🐛 **Stop.bat** - Updated to target port 3002 instead of 3000

### Changed
- 📊 **Model Mappings** - Updated to best current Groq models:
  - `claude-opus-4` → `meta-llama/llama-4-scout-17b-16e-instruct` (594 TPS, $0.11/$0.34) ⭐ Best for coding
  - `claude-3-5-sonnet` → `llama-3.3-70b-versatile` (394 TPS, $0.59/$0.79)
  - `claude-3-5-haiku` → `llama-3.1-8b-instant` (840 TPS, $0.05/$0.08) ⭐ Fastest & cheapest
  - `claude-local-1b` → Local Ollama model (free)
- 🎨 **Dashboard Design** - Modern dark theme with:
  - Responsive sidebar navigation
  - Smooth animations and transitions
  - Mobile-friendly layout
  - Live health checks
- 📝 **Default Model** - Changed to Llama 4 Scout (from Llama 3.3)

### Removed
- 🗑️ **Old Files** (18 total, ~5KB+ of obsolete code):
  - Old proxy implementations (`proxy.js`, `run-proxy.js`, `test-proxy.js`)
  - Old patch files (`patch_bundle.js`, `fix-groq-patch.js`, `fix-groq-patch.cjs`)
  - Investigation/test files
  - Old batch launchers and status reports
  - Files containing potential secrets (cleaned for GitHub push protection)
  - Old documentation/changelogs

### Security
- 🔒 Removed files containing secrets from git history
- 🔒 Added environment variable validation
- 🔒 Improved error messages for API key issues

### Performance
- ⚡ Payload compression reduces Groq request size by ~90%
- ⚡ Caching of health status (30 second intervals)
- ⚡ Concurrent streaming support (no global state)

## [2.1.88] - 2026-04-01

### Initial Release
- Claude Code v2.1.88 base installation
- Auth bypass modifications for custom LLM support
- Basic proxy framework
- Project initialization

---

## Version Numbering

- **Major.minor.patch-status**: e.g., 2.1.88-dev
- **Major**: Claude Code version
- **Minor-patch**: Release increments
- **Status**: dev (development), rc (release candidate), stable (release)

## Contributing

For changes, improvements, or bug reports, please create an issue or pull request on the [GitHub repository](https://github.com/m07o/claude-code).
