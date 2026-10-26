# گزارش اجرای واقعی تست MVP هدهده

تاریخ: ۲۰۲۶/۱۰/۲۶. محیط محلی Node.js 22.23.2، Chrome نصب‌شده، MongoDB replica set روی 27019. هیچ تست حذف یا skip جدید اضافه نشد. یک تست اختیاری قدیمیِ inference واقعی در حالت mock شرط skip دارد و جداگانه با مدل محلی واقعی اجرا شد.

| گیت                          | نتیجه محلی ثبت‌شده                                                                                          | مدرک قابل اجرای مجدد                                                                                                                                 |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| نصب پاک                      | موفق، ۲۵۷ بسته                                                                                              | `npm ci`                                                                                                                                             |
| TypeScript                   | موفق                                                                                                        | `npm run typecheck`                                                                                                                                  |
| ESLint                       | موفق                                                                                                        | `npm run lint`                                                                                                                                       |
| تولید/PWA                    | موفق                                                                                                        | `npm run build`                                                                                                                                      |
| واحد + یکپارچه               | ۱۱۶ passed، صفر failed/skipped                                                                              | `npm test`؛ چهار worker و timeout ۱۲۰ثانیه برای جلوگیری از معلق‌ماندن و رقابت منابع                                                                  |
| auth/reset/assets regression | ۸ passed                                                                                                    | `node --import tsx --test tests/integration/auth-session.test.ts tests/integration/password-reset.test.ts tests/integration/question-assets.test.ts` |
| کوکی امن/نشست/نرخ/CSRF       | ۴ passed؛ شامل Secure، session fixation، reset race، expiry                                                 | `tests/integration/auth-session.test.ts`                                                                                                             |
| مرورگر معمولی                | ۲۹ passed، صفر failed، ۱ skipped اختیاری                                                                    | `npm run test:e2e` روی سرور و worker هم‌نام در دیتابیس موقت                                                                                          |
| inference محلی واقعی         | ۱ passed، صفر failed/skipped؛ qwen2.5:3b                                                                    | تست موجود `flow.spec.ts` با `-g 'real AI question draft'` روی سرور با AI_PROVIDER و AI_AUTHOR_PROVIDER برابر ollama                                  |
| AvvalAI واقعی                | catalog موفق، ۲۰۹ مدل؛ inference: **Not Verified**                                                          | `AvalaiClient.models()` با transport واقعی و تنظیم امن موجود؛ هیچ درخواست تولید پولی ارسال نشد                                                       |
| SMTP                         | dependency تزریق‌شده موفق، کندی/شکست/توکن منقضی/یک‌بارمصرف آزموده؛ TLS server/Inbox واقعی: **Not Verified** | password-reset.test.ts و password-reset.spec.ts                                                                                                      |
| backup/restore               | موفق؛ ۳۹ collection و ۲۲۳۴ document آزمایشی؛ hash و index تطبیق داشت                                        | `WRITES_PAUSED=true npm run verify:backup` با MONGO_DB موقت و سرور/worker متوقف                                                                      |
| سلامت HTTP                   | status ok، نمونه تأخیر ۴۱ms؛ این تست بار نیست                                                               | `npm run ops:status`                                                                                                                                 |
| headerهای واقعی HTTP         | nosniff، DENY، strict-origin-when-cross-origin و Permissions-Policy مشاهده شدند                             | GET عمومی `/`؛ هیچ داده خصوصی خوانده نشد                                                                                                             |
| dependency audit             | **Not Verified**                                                                                            | mirror پاسخ 404/NOT_IMPLEMENTED داد؛ registry رسمی نیز خطای دسترسی برگرداند. این نتیجه به معنی نبود آسیب‌پذیری نیست                                  |

## شواهد Linux CI

مبنای 8df89d7: [اجرای ناموفق اولیه](https://github.com/MohammadKoolivand/hamyar/actions/runs/40288228756)، ۱۰۸/۱۰۹ موفق؛ OCR شمارهٔ گزینه را سؤال تازه می‌گرفت.

روی کد اصلاح‌شده 6c7ffe7: [اجرای ممیزی](https://github.com/MohammadKoolivand/hamyar/actions/runs/40296507218)، تمام ۱۱۳ تست واحد/یکپارچه، reset/session، نصب، TypeScript، Lint و Build موفق شدند. مرورگر ۲۸ موفق و یک skip اختیاری داشت؛ یک شکست واقعی overflow فرم content-new در عرض ۳۶۰ با فونت fallback شناسایی شد. محدودیت min-content فیلدها اصلاح شد. [اجرای اصلاح UI روی 13f3218](https://github.com/MohammadKoolivand/hamyar/actions/runs/40299755458) کاملاً سبز شد: ۱۱۳ تست backend و ۲۹ E2E موفق، یک skip اختیاری AI. سپس سه تست worker به مجموعه افزوده و هر ۱۱۶ تست محلی پاس شدند. وضعیت commit همراه این مستندات در [آخرین اجرای main](https://github.com/MohammadKoolivand/hamyar/actions/workflows/verify.yml?query=branch%3Amain) قابل بررسی است.

## OCR و دامنهٔ اعتبار

مرجع عددی: EXAM_EXTRACTION_METRICS.json و EXAM_IMPORT_ENGINE.md. چهار fixture سؤال، صفر false positive و صفر false negative شماره داشتند؛ متن/اسکن/علوم گزینه‌ها ۱۰۰٪، ترکیبی فقط ۶۲٫۵٪؛ CER صفحه اسکن‌شده ۳٫۳۳٪. کلید تصویری هنوز بررسی انسانی می‌خواهد. این مجموعهٔ کوچکِ مصنوعی شاهد دقت آزمون‌های واقعی ایران نیست؛ generalExamAccuracy برابر Not measured است.

## صداقت و محدودیت اجرا

- ابتدا اجرای هم‌زمان نصب پاک و E2E با خطای loader شکست خورد؛ آن اجرا نامعتبر شمرده شد و بعد از پایان نصب تکرار شد. اجرای گسترده‌ای نیز زیر رقابت منابع محلی/فرایند قدیمی معلق شد؛ فرایندهای تست متوقف و مجموعه با concurrency محدود دوباره کامل اجرا شد. assertionها حذف یا ضعیف نشدند.
- متن‌های قدیمی گزارش در تست UI با UI فعلی هماهنگ شدند و assertions عددی API به همراه بررسی دو تلاش و تاریخچه حفظ شدند. سناریوهای فوری صریحاً سیاست immediate معلم را انتخاب می‌کنند؛ رفتار end جداگانه آزموده است.
- تست‌های fixture-backed مرورگر از Fastify و MongoDB واقعی استفاده می‌کنند؛ فقط انتقال HTTP به fixture هدایت می‌شود و SMTP/catalog در تست مناسب کنترل می‌شوند. این‌ها ادعای تماس خارجی واقعی نیستند.
- دادهٔ واقعی MongoDB reset یا پاک نشد. دو دیتابیس E2E شناخته‌شدهٔ ممیزی جدا از داده اصلی‌اند؛ cleanup نهایی فقط آن‌ها را هدف می‌گیرد. نام دیتابیس‌های تصادفیِ نامعلوم به‌طور جمعی حذف نمی‌شود.

## بازیابی worker

دو خروج واقعی worker بر اثر monitor timeout اتصال MongoDB در همین محیط مشاهده شد. loop اکنون خطاهای شبکه/انتخاب سرور را با backoff از ۱٫۵ تا ۳۰ ثانیه تحمل می‌کند، بعد از کار موفق delay را reset می‌کند و خطای برنامه‌نویسی را نمی‌پوشاند. سه تست واحد جدید این تصمیم‌ها را بررسی می‌کنند؛ lease/retry و بازیابی job همچنان در integration قبلی آزموده‌اند. این تست واحدِ خطای تزریق‌شده، ادعای خاموش/روشن‌کردن MongoDB واقعی نیست؛ چنین آزمایش مخربی روی سرویس محلیِ داده واقعی انجام نشد.

## گیت بستهٔ تأیید ایمیل و OTP ملی‌پیامک — ۲۰۲۶/۱۰/۲۶

- نصب پاک: `npm ci` موفق، ۲۵۷ بسته؛ lockfile وابستگی تغییر نکرد.
- `npm run typecheck`، `npm run lint` و `npm run build`: موفق پس از تغییرات OTP؛ ۱۷ صفحه static شامل verify-email.
- `npm test`: **۱۲۳ passed / ۰ failed / ۰ skipped**، حدود ۱۳۵ ثانیه؛ شامل OCR واقعی، نقش‌ها، reset/session، صف رمزگذاری‌شده، تأیید/تغییر ایمیل و OTP جدید.
- `npm run test:e2e`: **۳۱ passed / ۰ failed / ۱ skipped**، حدود ۱٫۷ دقیقه. skip همان inference اختیاریِ حالت mock است؛ هیچ skip تازه اضافه نشد. OTP جدید با SMS transport کنترل‌شده تا حساب/نشست/refresh/logout و چهار عرض پاس شد؛ ایمیل نیز یک‌بارمصرف/حذف fragment را پاس کرد.
- `npm run smoke:ollama`: **PASS** با qwen2.5:3b؛ دو inference واقعی مصنوعی، usage واقعی ۱۴۵/۱۲ و ۲۰۲/۱۵ توکن؛ هیچ درخواست AvvalAI پولی ارسال نشد.
- adapter ملی‌پیامک: POST الگویی HTTPS، rejection/timeout با transport کنترل‌شده آزموده؛ ارسال/دریافت واقعی **Not Verified** (تنظیمات پنل و AUTH_OTP_SECRET وجود ندارند).
- SMTP Inbox واقعی **Not Verified**؛ تست‌های صف/SMTP کند/شکست، retry/lease و concurrency جایگزین Inbox نیستند.
- audit رسمی مجدداً با `npm audit --registry=https://registry.npmjs.org --json` اجرا شد و `read ETIMEDOUT` داد؛ نتیجه **Not Verified**.

اجرای اول مرورگر به‌علت خروج سرور background و نبود listener شکست زیرساختی داشت؛ سرور در نشست پایدار اجرا و مجموعه تکرار شد. در اجرای بعد یک خطای selector واقعی تست جدید ایمیل شناسایی شد: Next route announcer هم role=alert دارد. locator به main محدود شد و متنِ دقیق خطای مصرف دوباره حفظ ماند؛ اجرای کامل نهایی سبز شد. نتیجهٔ اجرای خراب به‌عنوان موفقیت ثبت نشده است.

بازاجرای backup/restore فقط روی `hodhodeh_audit_mail_1026` مصنوعی با وب/worker متوقف: **PASS**، ۴۲ collection، ۱۰۷۶ سند و آرشیو ۱۲۲۴۳۴ بایت؛ منبع تغییر نکرد و مقصد تصادفی drill حذف شد. benchmark هفت fixture خودساخته نیز اجرا شد: FP/FN شمارهٔ چهار fixture سؤال صفر، گزینه‌های mixed همچنان ۶۲٫۵٪ و scan CER برابر ۳٫۳۳٪. این اجرا بهبود دقت OCR یا صحت آزمون ملی را اثبات نمی‌کند.
