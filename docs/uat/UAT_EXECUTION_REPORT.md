# UAT — گزارش اجرای نهایی Closure — 2026-10-27

Baseline تاریخی 392/1/7/20/7/3 در این مأموریت دوباره مدرک موفقیت فرض نشد. Base اکنون main/6eb7a6acc79d64a6e756a6ca963e87ef7a07fcee است؛ repo ابتدا clean بود. نسخه آزموده‌شده این SHA به‌علاوه diff Closure است، نه SHA خالص. manifest و گیت‌های تازه در closure-evidence ثبت‌اند؛ پوشه evidence قبلی حذف نشده و متعلق به اجرای قبل است.

## محیط و ایزولاسیون

snapshot تازه `/private/tmp/hodhod-closure-82ntl0ht` با npm ci --prefer-offline، Next production روی127.0.0.1:5177 و DB hodhodeh_audit_closure_1027 روی replica set تازه closure-rs:27189. Node22.23.2/Next16.4.2 و lock موجود؛ Chrome واقعی نصب دستگاه. هیچ env/private داده واقعی به snapshot کپی نشد؛ فقط مدل‌های OCR با checksum قفل‌شده. AI پیش‌فرض mock، کلید AvvalAI خالی. fixtureها DB تصادفی خود را می‌سازند و فقط آن‌ها را پاک می‌کنند.

Mongo قبلی27019 قابل اتصال نبود. تلاش ابتدایی قبل/بعد بدون اتصال مدرک bug نیست؛ محیط جدا ساخته شد، سپس regression baseline واقعاً200 به‌جای400 داد. برای outage، اسکریپت یک mongod دوم در27190 با dbpath موقت خودش ساخت/متوقف/بازیابی/پاک کرد؛ shared Mongo یا وب اصلی5174 متوقف نشد.

Golden از UI ثبت‌نام تا داده میانی و گزارش/تقویت استفاده می‌کند؛ تزریق مستقیم DB برای ساخت مسیر Golden نیست. برخی تست‌های دیگر با fixture مجاز و backend واقعی Mongo کار می‌کنند؛ page.route فقط transport را به app.inject وصل می‌کند، پاسخ ساختگی API نیست. mock فقط وابستگی خارجی SMS/SMTP/AI انتخابی است. دو پروفایل مستقل مرورگر، دو دستگاه فیزیکی نیستند؛ iOS/Android واقعی جدا MANUAL_REQUIRED مانده‌اند.

## گیت‌های تازه

| بخش | اجرا و مدرک |
|---|---|
| نصب تمیز | npm ci --prefer-offline؛ closure-evidence/install.log |
| TypeScript / ESLint | npm run typecheck و npm run lint در snapshot و root؛ لاگ‌های closure-evidence |
| build | npm run build؛ production webpack/PWA در snapshot |
| backend | npm test با TEST_MONGO_URL روی replica تازه؛ closure-evidence/backend-final.log |
| Browser عادی | npm run test:e2e -- --grep-invert 'UAT GOLD cohort'؛ تمام۴۰تست غیرGolden؛ ordinary-final.log |
| Golden | همان runner با uat-golden.spec.ts --fully-parallel --workers=2؛ هر دو cohort با account/course مستقل و artifact جدا؛ golden-final.log |
| Firefox |۷تست در هر دو تلاش پیش از page load خطای profile دادند؛ firefox-profile-failure.log و firefox-retry.log؛ نتیجه UI-027 BLOCKED |
| integrity | npm run audit:integrity روی DB snapshot؛ integrity.log |
| backup / restart | فقط نویسندگان همین محیط pause؛ verify:backup به restore DB تصادفی؛ backup.log و restart.log |
| AI واقعی محلی |۳تولید واقعی Ollama، دو hint selection واقعی و usage؛ local-authoring.json، local-hints.log؛ انتشار0 |
| gate خروجی واقعی |هر۳تولید محلی راهنمای خام review/blocked داشتند؛ local-hint-gate.json؛ parse موفق با کیفیت/مجوز انتشار یکی نیست |
| PDF |columns/password/corrupt واقعی، render Poppler و مشاهدهPNG؛ pdf-before/after.json و document-columns.test.ts |
| ops |process اختصاصی mongod، قطع/وصل واقعی، session/data، log production؛ operations.json |
| rollback |تابع واقعی bash با فرمان‌های سیستمی کنترل‌شده؛ rollback.log؛ اجرا روی systemd مقصد نیست |

مجموعه مرورگر کامل در دو batch غیرهم‌پوشان اجرا شد؛ union آن‌ها همان۴۲تست موجود و افزوده است. هیچ case برای سبزکردن حذف یا assertion ضعیف نشد. یک skip از قبل متعلق به UI مدل Ollama در سرور mock است؛ دو smoke واقعی محلی جدا اجرا شدند. نتیجه عددی نهایی در FINAL_RESULTS.json و انتهای Closure report ثبت است.

## شکست‌های حفظ‌شده و اصلاحات

- تلاش اول bind/DB ناموجود به PASS تبدیل نشد؛ log محیطی حفظ شد.
- تست malformed ابتدا رفتار ناقص generator را آشکار کرد؛ schema قبل از draft اصلاح شد. HTTP502 از handler موجودِ خروجی نامعتبر است؛ assertion قرارداد صریح دارد.
- locator alert جدید ابتدا دو عنصر (پیام فرم و route announcer خود Next) پیدا کرد؛ به متن دقیق پیام فرم scoped شد. assertion حفظ statement/reference دست‌نخورده است. اجرای interrupted با failure اولیه در e2e-interrupted-harness.log محفوظ است.
- گیت بعدی واقعاً false-positive validator برای راهنمای «دو عدد را جمع کن» را کشف کرد؛ تست گروه قدیمی تغییر نکرد. کد اصلاح و unit regression افزوده شد. ordinary-before-false-positive.log محفوظ است؛ گیت کامل پس از آن تکرار شد.
- Firefox حتی با profile در /private/tmp راه‌اندازی نشد؛ شکست launch را به مشکل UI یا موفقیت Chrome تعمیم ندادیم.

traceهای حاوی cookie مصنوعی در private-temp هستند؛ داخل Git/گزارش قابل انتشار کپی نشدند. secrets فقط از نظر وجود boolean بررسی شدند؛ log/URL probe حاوی sentinel جعلی است، نه credential واقعی.

## محدوده نتیجه

۴۳۰معیار:410PASS،0FAIL،10BLOCKED،0NOT_RUN،7MANUAL_REQUIRED،3NOT_IMPLEMENTED،0OUT_OF_SCOPE. تعیین تکلیف100% و PASS95.35% است؛ هیچ‌کدام آمادگی عمومی نیست. ۱۷از۲۰NOT_RUN با اجرای تازه PASS و سه مورد مقصد BLOCKED شدند؛ جدول تمام۲۱تغییر در UAT_STATUS_CHANGES.md.

این اجرا load test ظرفیت کلاس نیست:۳۰خواندن واقعی backend با concurrency5، p95 حدود17.4ms، error0 فقط اندازه‌گیری محلی app.inject است. RSS نمونه PDF حدود412MiB و حدود حجم/صفحات/subprocess بررسی شدند؛ MemoryMax1500M template در Mac enforce نمی‌شود و OPS-023 مقصد BLOCKED است.

آخرین CI برای base6eb7a6a موفق بود، لینک در closure-evidence/github-actions.json؛ تغییرات ثبت‌نشده Closure هنوز CI ریموت ندارند. DNS تازه NXDOMAIN و HTTPS resolve نشد. SSH strict-host-key بدون افزودن کلید متوقف شد. اعتبارنامه/مجوز تحویل واقعی SMS/SMTP، AvvalAI پولی، دستگاه واقعی و سیاست اجرایی داده کودک تأیید نشده‌اند.

فهرست دقیق فایل‌های جدید/تغییریافته و تست‌های افزوده در `UAT_CHANGED_FILES.md` و `FINAL_RESULTS.json` ثبت است.
