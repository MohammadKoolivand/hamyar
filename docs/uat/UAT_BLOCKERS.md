# Blockers و Release Gateها — Closure

مقادیر secret خوانده/چاپ نشده‌اند؛ فقط وجود متغیرهای مشخص به boolean تبدیل شد. هیچ پیامک/ایمیل واقعی یا inference پولی ارسال نشد. موفقیت پذیرش SMS API با تحویل واقعی گوشی و موفقیت SMTP با Inbox یکی نیست.

| ID | شدت / نوع | علت / وضعیت تازه | رفع لازم / اقدام مالک | مدرک |
|---|---|---|---|---|
| AUTH-027 | P1، سرویس خارجی | SMTP و گیرنده مجاز موجود نیست؛ تحویل Inbox قابل اجرا نیست | تنظیم امن SMTP و گیرنده آزمایشی مجاز؛ ارسال کنترل‌شده سپس بررسی Inbox | credential-presence.json؛ تست‌های mail/outbox در backend-final.log |
| SEC-013 | P0 انتشار، پیکربندی | Secure/SameSite/HttpOnly در integration پوشش دارد؛ دامنه DNS resolve نشد، TLS واقعی تأیید نیست | DNS/HTTPS معتبر و COOKIE_SECURE=true، APP_ORIGIN دقیق، reverse proxy | dns.log، https.log؛ backend-final.log |
| UI-001 | تصمیم مالک | برند قبلاً هدهده تأیید شده، سند جدید هدهد می‌نامد | مالک نام نهایی را تثبیت کند؛ بازنام‌گذاری وسیع در Freeze انجام نشد | src/app/layout.tsx و UI موجود |
| UI-027 | محیط اجرای مرورگر | Firefox1555 دانلود شد؛ در دو تلاش پیش از بازکردن صفحه، خطای profile folder داد؛ برنامه اصلاً آزمایش نشد | اجرای همان suite روی میزبان Firefox سازگار؛ fail محیطی معادل fail محصول یا pass نیست | firefox-profile-failure.log؛ firefox-retry.log |
| OPS-017 | P0 انتشار، پیکربندی | HTTPS/Origin/Cookie مقصد به‌دلیل DNS تأیید نشد | تنظیم دامنه و reverse proxy با مجوز جدا و سپس بررسی TLS/کوکی/mixed content | dns.log، https.log |
| OPS-018 | P1، عملیات مقصد | استقرار/rollback واقعی Linux/systemd مقصد در این مأموریت مجاز/اجرا نشده | استقرار SHA دارای CI با مجوز؛ بازبینی health، worker و rollback روی staging | github-actions.json؛ rollback.log فقط تابع واقعی با فرمان‌های سیستمی کنترل‌شده |
| OPS-020 | P1، سرویس خارجی | Mail Worker و queue/retry کد و تست دارند، پیکربندی SMTP/key عملیاتی کامل نیست | credential معتبر و preflight، اجرای worker در مقصد و تأیید گیرنده | backend-final.log؛ credential-presence.json |
| OPS-016 (قبلاً NOT_RUN) | P1، عملیات مقصد | COMMIT و اعتبارسنجی SHA در CI/deploy موجود؛ SHA نسخه فعال سرور در این اجرا تأیید نشده | تطبیق COMMIT release فعال با workflow موفق و health مقصد | github-actions.json؛ ops/deploy-staging.sh |
| OPS-023 (قبلاً NOT_RUN) | P1، عملیات مقصد | نمونه دوصفحه‌ای حدود412MiB RSS داشت؛ حدود100صفحه/حجم/timeout وجود دارد؛ MemoryMax=1500M در template است، اجرای واقعی cgroup Linux تأیید نیست | منابع سرور و MemoryMax واقعی و مصرف worker در مقصد بررسی شوند؛ آزمایش مخرب روی production ممنوع | pdf-after.json؛ ops/hodhod-exam-worker.service؛ document-limits tests |
| OPS-024 (قبلاً NOT_RUN) | P1، تصمیم عملیاتی | runbook و drill واقعی محلی موجود است؛ مسئول پاسخ‌گو/زمان‌بندی مقصد مشخص نیست | تعیین مسئول backup، پایش، رخداد و بازیابی و امضای runbook | operations.json؛ backup.log پس از گیت؛ UAT_RELEASE_READINESS.md |

## Gate مستقل داده کودک — باز و مانع پایلوت کودک واقعی

این بخش نظر حقوقی یا ادعای انطباق با قانون نیست. نقش parent و لینک معتبر، رضایت حقوقی را ثابت نمی‌کنند.

| کنترل | وضعیت فعلی | اقدام لازم |
|---|---|---|
| احراز و رضایت سرپرست | رابطه فنی parent/RBAC موجود؛ احراز و consent معتبر اجرایی تأیید نشده | تعریف روش و مسئول احراز/رضایت پیش از ورود داده کودک واقعی |
| نسخه و زمان رضایت | ثبت مستقل نسخه سیاست/consent تأیید نشده | تعیین نسخه، evidence، زمان و دسترسی audit |
| لغو رضایت | revoke لینک parent و مجوزها تست می‌شود؛ همان revoke consent نیست | سیاست توقف پردازش/دسترسی پس از لغو و workflow مشخص |
| نگهداری | مدت نهایی مورد تأیید مالک موجود نیست | تعیین مدت برای attempts، hints، assets، logs، backup و مسئول اجرا |
| درخواست حذف/ناشناس‌سازی | مسیر عملی self-service/اپراتوری کامل تأیید نشده | تعریف دریافت، احراز درخواست، حدود نگهداری لازم و حذف/ناشناس‌سازی |
| اثر حذف بر backup | archive می‌تواند داده تاریخی داشته باشد؛ workflow اثبات حذف پس از restore تأیید نشده | مدت backup و reconciliation حذف هنگام restore مشخص شود |
| کنترل نقش‌ها | regression همه پنج نقش اجرا می‌شود | موفقیت فنی جایگزین تصمیم‌های بالا نیست |
| پاسخ‌گویی | مسئول مالک داده/درخواست‌ها تعیین نشده | مالک مسئول و کانال پاسخ‌گویی را معرفی کند |

برای برطرف‌کردن این Gate بدون تصمیم مالک، قانون یا مدت ساختگی تعیین نشد و فیچر موازی ساخته نشد.
