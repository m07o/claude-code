# Claude Code — حل مشكلة التحديث التلقائي (Auto-Update)

## المشكلة

Claude Code بيحدّث نفسه تلقائياً من النسخة **2.1.88** (اللي المشروع متكتب عليها) إلى أحدث نسخة زي **2.1.119** أو أحدث. ده بيخلي الـ proxy مش بيشتغل صح لأن:

- النسخة الجديدة ممكن تغيّر شكل الـ requests
- الـ patches اللي في `cli.js` كانت مكتوبة لنسخة 2.1.88
- حجم الـ payload ممكن يختلف → أخطاء 413

---

## الحل السريع — 3 خطوات

### الخطوة 1: احذف النسخة الحالية

افتح **CMD كـ Administrator** واكتب:

```batch
npm uninstall -g @anthropic-ai/claude-code
```

### الخطوة 2: ثبّت نسخة 2.1.88 بالتحديد

```batch
npm install -g @anthropic-ai/claude-code@2.1.88
```

### الخطوة 3: عطّل التحديث التلقائي

```batch
setx DISABLE_AUTOUPDATE 1
```

> **مهم**: أغلق كل الـ terminals وافتح واحد جديد عشان التغييرات تتنفّذ.

---

## التأكد إن كل حاجة تمام

```batch
claude --version
```

لازم يظهر: **2.1.88**

---

## الطريقة البديلة — استخدم نسخة المشروع مباشرة

مشروعك فيه نسخة **2.1.88 معدّلة** جاهزة في `package/cli.js` فيها كل الـ patches:

```batch
cd C:\Users\Mohamed\Open-ClaudeCode\package
node cli.js
```

**مميزات الطريقة دي:**
- نسخة معدّلة وجاهزة (فيها bypass للـ auth)
- مابتتأثرش بالنسخة العالمية
- لو النسخة العالمية اتحدثت، نسخة المشروع تفضل 2.1.88

---

## ملف Fix-Version.bat

الملف `Fix-Version.bat` بيعمل كل الحاجات دي تلقائياً:

1. يشوف نسخة Claude Code الحالية
2. بيحذفها
3. بيثبّت 2.1.88
4. بيعطّل الأبديت بـ 3 طرق مختلفة (setx + registry + startup script)
5. بيأكد إن التثبيت نجح

**طريقة الاستخدام:**
- كليك يمين على `Fix-Version.bat` → **Run as Administrator**

---

## لو حصلت المشكلة تاني

لو لقيت Claude Code اتحدث من غير ما تسمح:

1. افتح `Fix-Version.bat` كـ Administrator واعمله Run
2. أو اتأكد إن المتغير البيئي `DISABLE_AUTOUPDATE` موجود:

```batch
echo %DISABLE_AUTOUPDATE%
```

لازم تطبع `1`. لو مطبوعة حاجة تانية أو فاضية:

```batch
setx DISABLE_AUTOUPDATE 1
```

ثم أغلق الـ terminal وافتح واحد جديد.

---

## ملاحظة مهمة عن نسخة المشروع

ملف `package/cli.js` هو نسخة **2.1.88 معدّلة** وفيها:

| التعديل | الوظيفة |
|---------|---------|
| Patch B | تحويل `api.anthropic.com` → `localhost:3000` |
| Patch E1-E8 | تعطيل التحقق من الحساب (Auth Bypass) |
| Patch A | تعطيل التحقق من صحة اسم الموديل |
| Patch F | تعطيل التحديث التلقائي داخل الكود |

يعني حتى لو Claude Code حاول يتحدث، التعديلات في `cli.js` بتمنعه من جوه.

---

## ملخص سريع

```
المشكلة:     Claude Code اتحدث لـ 2.1.119 من غير ما تسمح
السبب:       Auto-Update مفعّل افتراضياً
الحل:        ثبّت 2.1.88 + عطّل الأبديت
الأداة:      Fix-Version.bat (شغّله كـ Administrator)
البدل:       cd package → node cli.js
```
