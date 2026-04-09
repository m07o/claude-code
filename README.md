# مشروع Claude Code Proxy

## الوصف
عبارة عن proxy بيترجم بين **Anthropic Messages API** و **OpenAI Chat Completions API**، عشان تشتغل بـ Claude Code على Groq API وموديلات محلية بدل Anthropic API.

يسمح للمستخدمين باستخدام Claude Code مع:
- **Groq API** - موديلات قوية وسريعة وارخص من Anthropic
- **موديلات محلية** - عبر Ollama (بدون internet)
- **داشبورد ويب** - لمراقبة الطلبات والاختبار

---

## المميزات ✨

- ✅ **دعم Groq API** - 4 موديلات مختلفة
- ✅ **موديلات محلية** - Ollama + LM Studio + vLLM
- ✅ **داشبورد ويب** - مع chat، logs، settings، إحصائيات
- ✅ **ضغط الـ payload** - حل مشكلة 413 تلقائياً
- ✅ **تكامل VS Code** - tasks و debug configs
- ✅ **launchers سريعة** - Start.bat, Open-Dashboard.bat
- ✅ **وضع ليل/نهار** - في الداشبورد
- ✅ **streaming support** - رسائل SSE
- ✅ **تحويل تلقائي** - Anthropic ↔ OpenAI

---

## خريطة الموديلات 🤖

| موديل Claude | موديل Groq | السرعة | السعر لـ 1M token |
|-------------|-----------|--------|--------|
| `claude-opus-4` | `meta-llama/llama-4-scout-17b-16e-instruct` | **594 TPS** ⚡ | $0.11 / $0.34 |
| `claude-3-5-sonnet` | `llama-3.3-70b-versatile` | 394 TPS | $0.59 / $0.79 |
| `claude-3-5-haiku` | `llama-3.1-8b-instant` | **840 TPS** 🚀 | $0.05 / $0.08 |
| `claude-local-1b` | `llama3.2:1b` (محلي) | ∞ | مجاني |

**الأفضل للبرمجة**: `meta-llama/llama-4-scout` - 594 TPS + سعر منخفض 💰

---

## التثبيت والتشغيل 🚀

### المتطلبات
- Node.js 18+
- Groq API Key (من https://console.groq.com)
- Ollama (اختياري، للموديلات المحلية)

### الخطوات

**1. استنساخ المستودع**
```bash
git clone https://github.com/m07o/claude-code.git
cd claude-code
```

**2. تعيين متغيرات البيئة**
```bash
set GROQ_API_KEY=your_actual_key_here
set LOCAL_MODEL_URL=http://localhost:11434/v1/chat/completions
set LOCAL_MODEL_NAME=llama3.2:1b
```

**3. التشغيل**
- **Windows**: انقر على `Start.bat`
- **Terminal**: `npm run proxy` أو `node package/proxy.cjs`
- **VS Code**: `Ctrl+Shift+B` → "Start Proxy Server"

---

## الاستخدام 💬

### الطرق السريعة
| الملف | الفائدة |
|------|--------|
| `Start.bat` | تشغيل المشروع |
| `Open-Terminal.bat` | فتح VS Code |
| `Open-Dashboard.bat` | فتح الداشبورد |
| `Stop.bat` | إيقاف المشروع |

### في Terminal
```bash
npm run proxy          # تشغيل عادي
npm run proxy:debug   # مع DEBUG=1
npm run proxy:test    # اختبار الاتصال
```

### في VS Code
1. اضغط `Ctrl+Shift+B`
2. اختر مهمة:
   - "Start Proxy Server"
   - "Start Proxy (Debug Mode)"
   - "Open Proxy Dashboard"
   - "Test Local Model"

### الداشبورد
- العنوان: http://localhost:3002/
- **الأقسام**:
  - 🎯 Dashboard - الحالة والإحصائيات
  - 💬 Chat - محادثة مع أي موديل
  - 📊 Logs - سجل الطلبات
  - ⚙️ Settings - الإعدادات
  - 🤖 Models - معلومات الموديلات

---

## هيكل المشروع 📁

```
Open-ClaudeCode/
├── package/
│   ├── proxy.cjs              # الـ proxy الرئيسي (Node.js)
│   ├── cli.js                 # CLI من Anthropic
│   ├── package.json           # npm scripts
│   └── ...
├── .vscode/
│   ├── tasks.json             # VS Code tasks
│   └── launch.json            # Debug configurations
├── Start.bat                  # تشغيل (Windows)
├── Stop.bat                   # إيقاف (Windows)
├── Open-Terminal.bat          # فتح VS Code
├── Open-Dashboard.bat         # فتح الداشبورد
├── README.md                  # هذا الملف
├── READMEen.md                # English docs
└── package.json               # (root)
```

---

## حل المشاكل 🔧

### مشكلة: 413 Payload Too Large
**الحل**: الـ proxy بيضغط الـ payload تلقائياً (يحذف tools، يقطع system prompt > 28KB).

### مشكلة: Connection refused
**الحل**: تأكد أن الـ proxy شغال:
```bash
curl http://localhost:3002/health
```

### مشكلة: model 'xxx' not found
**الحل**: تحقق من اسم الموديل في Ollama:
```bash
ollama list
```
جدِّث `LOCAL_MODEL_NAME` في `proxy.cjs` بالاسم الصحيح.

### مشكلة: Authentication error
**الحل**: تحقق من `GROQ_API_KEY`:
```bash
echo %GROQ_API_KEY%
```
يجب أن يظهر المفتاح (بدون ترك خالي).

### مشكلة: Local model لا يستجيب
**الحل**: تأكد أن Ollama شغال:
```bash
ollama serve
```
في terminal منفصل.

---

## الأوامر المتاحة 📝

### npm scripts
```bash
npm run proxy              # تشغيل الـ proxy
npm run proxy:debug        # مع DEBUG logging
npm run proxy:test         # اختبار الصحة
```

### curl (اختبار يدوي)
```bash
# Local model
curl -X POST http://localhost:3002/v1/messages \
  -H "Content-Type: application/json" \
  -d '{"model":"claude-local-1b","max_tokens":50,"messages":[{"role":"user","content":"Hello"}]}'

# Groq API
curl -X POST http://localhost:3002/v1/messages \
  -H "Content-Type: application/json" \
  -d '{"model":"claude-opus-4","max_tokens":50,"messages":[{"role":"user","content":"Hello"}]}'

# Health status
curl http://localhost:3002/health
```

---

## البورتات والـ URLs 🌐

| الخدمة | العنوان | ملاحظات |
|--------|---------|--------|
| Proxy | `http://localhost:3002` | Messages API + Dashboard |
| Groq API | `https://api.groq.com` | خارجي |
| Ollama | `http://localhost:11434` | محلي (اختياري) |

---

## ملاحظات تقنية 🔬

- **Payload Compression**: يحذف tool definitions، images، tool_use blocks
- **Model Mapping**: تحويل تلقائي من أسماء Claude إلى Groq models
- **Streaming**: دعم SSE (Server-Sent Events) الكامل
- **Local Models**: يدعم Ollama + LM Studio + vLLM
- **Error Handling**: تحويل أخطاء Groq إلى صيغة Anthropic

---

## الملف الشخصي 👤

- **Author**: m07o
- **Repository**: https://github.com/m07o/claude-code
- **Branch**: dev (للميزات الجديدة)
- **License**: SEE ACKNOWLEDGEMENTS.md

---

## هل تحتاج مساعدة؟ 🆘

1. تحقق من الـ [Issues](https://github.com/m07o/claude-code/issues)
2. اقرأ الـ [troubleshooting](#حل-المشاكل-)
3. اختبر مع `curl` أولاً قبل استخدام Claude Code

---

**التحديث الأخير**: 2026-04-10 ✅
