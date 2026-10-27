# گزارش اجرای UAT — ۲۰۲۶/۱۰/۲۷

## دامنه و نسخه

ریپازیتوری `MohammadKoolivand/hamyar`، شاخه `main`، HEAD پایه `4356a58b3f6a50119e38b1e6710f4668bf8c61f0` به‌علاوه تغییرات ثبت‌نشده مالک و اصلاح UAT. این اجرای محلی، اثبات موفقیت GitHub Actions یا استقرار سرور نیست. هیچ commit یا push انجام نشد. فهرست هش‌های snapshot اولیه در `SOURCE_MANIFEST.json` و اثرانگشت نهایی کد در `FINAL_SOURCE_MANIFEST.json` است.

فایل مأموریت ۴۳۰ معیار کسب‌وکار و ۱۴ پیش‌نیاز T دارد: مجموع ۴۴۴ شناسه. همه در `UAT_MASTER_CHECKLIST.md` وضعیت صریح دارند؛ شمارش موارد پذیرش با تعداد توابع تست یکی نیست. برخی معیارها با چند assertion در تست موجود پوشش دارند؛ PASSها به تست و مدرک اجرا ارجاع داده‌اند. نبود اجرای کافی صریحاً NOT_RUN می‌ماند. وضعیت عددی نهایی در `COUNTS.json` مرجع است.

## محیط مستقل

- Snapshot: `/private/tmp/hodhodeh-uat-y2ny62dl`، وب production روی `http://127.0.0.1:5176`.
- MongoDB replica set `hamyar-rs` در پورت 27019؛ DB مستقل `hodhodeh_audit_uat_1027_f962b582`. fixtureها DBهای تصادفی مستقل خود را می‌سازند و فقط همان‌ها را پاک می‌کنند.
- Node 22.23.2، Next 16.4.2، Chrome 155.0.8059.85، Tesseract 5.5.3، Poppler 26.06.0؛ نسخه‌های دقیق lock و ایندکس‌ها: `evidence/environment.json`.
- در مسیر Golden، HTTP واقعی Next → Fastify → MongoDB و worker موجود استفاده شد. پاسخ API جعل نشد. در بیشتر تست‌های موجود، `routeBackend` درخواست مرورگر را به backend واقعی و MongoDB fixture هدایت می‌کند؛ این با deployment کامل شبکه یکی نیست.
- Provider پیش‌فرض UAT: mock با راهنماهای تأییدشده. تست مستقل Ollama از مدل واقعی محلی استفاده کرد. SMS/SMTP کنترل‌شده در تست‌ها، ارسال واقعی نیستند. AvvalAI پولی فراخوانی نشد.
- وب/worker اصلی 5174، staging قبلی 5175 و بانک واقعی تغییر نکردند. برای آزمایش فایل واقعی، فقط PDF عمومی کنکورِ معرفی‌شده مالک خوانده شد.

## دستورها و نتایج

| اجرا | نتیجه واقعی | مدرک |
|---|---|---|
| `npm ci --prefer-offline` در snapshot تازه | موفق | evidence/install.log |
| `npm run typecheck` | موفق پس از اصلاح parser | evidence/typecheck.log |
| `npm run lint` | موفق پس از اصلاح parser | evidence/lint.log |
| `npm run build` | production build موفق | evidence/build.log |
| `npm test` روی replica set مستقل | ۱۳۲ pass، صفر fail/skip/cancel؛ ۴۷ unit + ۸۵ integration | evidence/backend.log |
| مجموعه موجود مرورگر، پیش از تغییر parser | ۳۲ pass، ۱ skip اختیاری مدل واقعی | evidence/e2e-existing.log |
| اولین اجرای کامل پس از parser | ۳۵ pass، ۲ fail در انتظار ورود مجددِ harness، ۱ skip | evidence/e2e-full-before-harness-fix.log |
| Golden پس از اصلاح هم‌زمانی تست | ۲ pass در دو cohort تازه | evidence/golden-final.log |
| سه probe مرورگر | ۳ pass؛ فرمول/HTML، 404/motion، بستن و بازاجرای Chrome واقعی | evidence/probes.log |
| گیت کامل نهایی مرورگر | ۳۷ pass، صفر fail، یک skip اختیاریِ ازقبل‌موجود Ollama در محیط mock؛ ۸٫۹ دقیقه | evidence/e2e-final.log |
| `npm run audit:integrity` | assignmentsNeedingReview=0 | evidence/integrity.log |
| `WRITES_PAUSED=true npm run verify:backup` | ۴۴ collection، ۲۳۴۹ سند؛ restore مستقل، hash داده/ایندکس برابر، مبدأ ثابت | evidence/backup.log |
| restart probe با نشست در حافظه | قطعی واقعی وب UAT مشاهده شد؛ پس از restart همان نشست و گزارش کامل برابر | evidence/restart.log |
| `npm run smoke:ollama` | دو inference واقعی راهنمایی محلی با مصرف token واقعی | evidence/ollama.log |
| `local-ai-probe.ts` | سه خروجی واقعی parse شدند؛ صفر انتشار؛ کیفیت راهنما ناموفق | evidence/authoring.json |
| `scripts/benchmark-exams.ts` | نمونه‌های مصنوعی سؤال FP=0/FN=0؛ محدودیت‌های متن/گزینه باقی | evidence/ocr-benchmark.json |
| نمونه PDF کنکور واقعی | مرز سؤال قبل [1,2,5,6]، بعد [1,2,3,4,5,6]؛ کلیدها needs_review | evidence/real-exam-before.json; real-exam-after.json |

دستور مرورگر با `MONGO_URL` replica بالا، `MONGO_DB` مستقل، `APP_ORIGIN` و `E2E_BASE_URL=http://127.0.0.1:5176`، `CHROME_PATH` نصب موجود و `npm run test:e2e -- --output <private-temp-dir>` اجرا شد. credential واقعی در دستور/گزارش نیست. گزارش Golden مستقل در `UAT_GOLDEN_JOURNEY.md` است.

## OCR و هوش مصنوعی: حدود نتیجه

اصلاح parser تنها تشخیص heading متن مستقیم، متوالی و هم‌تراز را بهبود می‌دهد. آزمون قبلی OCR گزینه ۴ کاذب حفظ شد. baseline رگرسیون جدید ۵ pass/۱ fail و پس از اصلاح ۶ pass/صفر fail بود. نمونه واقعی هنوز مرجع مستقل علمی نیست؛ markers موجود فقط مرجع شماره‌اند. صحت فرمول‌ها، گزینه‌های encoding نامطمئن و کلید واقعی خودکار تأیید نشد. همه شش مورد کلید needs_review ماندند. روی benchmark مصنوعی، دقت گزینه mixed برابر ۶۲٫۵٪ و CER اسکن ۳٫۳۳٪ است؛ ادعای دقت عمومی کنکور نداریم.

مدل محلی qwen2.5:3b سه بار عدد مرجع ۷ را در راهنمای پیش‌نویس آورد. نتیجه کیفیت راهنما AI-008 برابر FAIL است، نه PASS یا صرفاً Not Verified؛ هیچ پیش‌نویسی تأیید یا منتشر نشد. بررسی انسانی اجباری و انتخاب راهنمای تأییدشده در tutor، این خروجی خام را خودکار به دانش‌آموز نمی‌رسانند. صحت علمی عمومی و تناسب سنی همچنان نیازمند داوری مستقل است. نتیجه محلی را به AvvalAI تعمیم نمی‌دهیم.

## محدودیت‌ها و اجراهای ناموفق

اولین اجرای sandbox واحد دو EPERM برای bind داشت؛ اجرای مجاز دوباره موفق شد. در ساخت Golden، locatorها و انتظار ذخیره/انتشار/تغییر URL و ورود مجدد اصلاح شدند؛ گزارش کامل قبلی با دو fail حفظ شده است. projection معلم و دانش‌آموز یکسان نیست: شمارنده‌های عمومی دقیقاً برابر و تاریخچه خصوصی هر نقش با baseline خودش مقایسه شد. quota تولیدی افزایش نیافت؛ pace درخواست تست ۶۵۰ms، انتظار ۲۰s و retry محدود GET پس از Retry-After مستند است. این آزمون ظرفیت کلاس هم‌زمان نیست. آثار ZIP مرورگر دارای نشست مصنوعی‌اند؛ فقط در مسیر private-temp نگهداری شده و وارد Git نشدند.

HTTPS آنلاین، DNS معتبر (در query این اجرا NXDOMAIN)، systemd مقصد، ارسال واقعی ملی‌پیامک/SMTP، AvvalAI پولی، iOS/Safari/Android/Firefox واقعی، سیاست عملی رضایت/حذف/نگهداری و بار واقعی کلاس تأیید نشده‌اند. MongoDB مشترک برای تست قطعی خاموش نشد؛ قطعی DB و اتصال مجدد همچنان NOT_RUN هستند. backup فقط DB آزمایشی است و جایگزین backup عملیاتی مقصد نیست.

کد فعلی از CSS سراسری برای token/style نیز استفاده می‌کند؛ ادعای قدیمی «فقط import Tailwind» با runtime یکسان نیست. به‌دلیل Feature Freeze بازنویسی ظاهری انجام نشد. نام برندِ فعلی هدهده با عنوان هدهد در سند UAT تعارض دارد؛ تصمیم مالک لازم است.

## شمارش نهایی معیارها

| وضعیت | محصول (۴۳۰) | پیش‌نیاز (۱۴) |
|---|---:|---:|
| PASS | 392 | 12 |
| FAIL | 1 | 0 |
| BLOCKED | 7 | 2 |
| NOT_RUN | 20 | 0 |
| MANUAL_REQUIRED | 7 | 0 |
| NOT_IMPLEMENTED | 3 | 0 |
| OUT_OF_SCOPE | 0 | 0 |

PASS محصول: 392/430 = 91.16%؛ نتیجه اجرایی PASS/FAIL: 91.40%؛ تعیین تکلیف با احتساب موانع/داوری/نبود قابلیت و بدون NOT_RUN: 95.35%. این سه نسبت یک مفهوم ندارند. تعداد NOT_RUN به معنی موفقیت نیست و مانع ادعای پذیرش صددرصد است.
