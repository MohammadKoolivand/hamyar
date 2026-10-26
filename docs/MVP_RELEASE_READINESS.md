# ممیزی نهایی پایدارسازی و آمادگی انتشار هدهده

تاریخ: ۲۰۲۶/۱۰/۲۶. این سند معادل موجودِ گزارش نهایی انتشار است؛ برای رعایت منع مستند تکراری، گزارش در همین فایل به‌روزرسانی شد و MVP_FINAL_RELEASE_AUDIT دیگری ساخته نشد.

**نتیجه: CONDITIONALLY READY برای استقرار آزمایشی کنترل‌شده با داده مصنوعی. انتشار عمومی با داده واقعی کودک READY نیست.** Feature Freeze رعایت شد؛ هیچ API، صفحه، نقش، ماژول محصولی یا سرویس تازه افزوده نشد. دو اصلاح محدود امنیت/پاکسازی و تقویت تست‌های موجود انجام شد.

مبنای دریافت‌شده و CI سبز: `4963aa7784c072d23a18efedd0bfdab71f42b7fb`. commit کد آزموده‌شده: `90eabe916383df4e65f8ffa8e4d244128d49d8f7`. اسناد پس از آن در commit جدا ثبت می‌شوند؛ SHA رأس نهایی در گزارش تحویل از Git خوانده می‌شود. مرجع CI آخرین main: [GitHub Actions](https://github.com/MohammadKoolivand/hamyar/actions/workflows/verify.yml?query=branch%3Amain).

## نقص‌های اثبات‌شده و اصلاح

| اولویت       | بازتولید و علت                                                                                                                                                                        | اصلاح و شاهد                                                                                                                                                                                                          |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P1 امنیت     | login بعد از بررسی رمز متوقف شد؛ مدیر نقش را تغییر داد و برگرداند و نشست‌ها را لغو کرد؛ درخواست قدیمی با 200 نشست تازه ساخت. مقایسهٔ نقش/رمز به‌تنهایی چرخهٔ بازگشت مقدار را نمی‌دید. | `src/server/modules/access-management.ts`: افزایش securityRevision در همان تراکنش تغییر دسترسی. guard موجود login اکنون آن را رد می‌کند. رگرسیون auth-session پیش از اصلاح 200≠401 و پس از آن 401/بدون کوکی/صفر نشست. |
| P1 داده موقت | `listIndexes` مجموعه‌های otpChallenges و otpThrottle فاقد expiresAt TTL بود؛ انقضای منطقی مانع ورود می‌شد، ولی پاکسازی فیزیکی برخلاف مستندات انجام نمی‌شد.                            | `src/server/db.ts`: TTL index افزایشی روی همان مجموعه‌ها؛ رگرسیون phone-otp قبل از اصلاح شکست خورد و بعد وجود expireAfterSeconds=0 را اثبات کرد.                                                                      |
| P2 مستندات   | ARCHITECTURE هنوز نبود ایمیل/OCR/worker را توصیف می‌کرد.                                                                                                                              | توضیح با کد موجود و EXAM_IMPORT_ENGINE/PASSWORD_RESET هماهنگ شد؛ معماری یا دامنه تغییر نکرد.                                                                                                                          |

هر دو اصلاح کد در `90eabe9` هستند؛ assertion ضعیف/حذف، skip جدید، reset داده، force push یا تغییر ظاهری محصول انجام نشد.

## A — Technical Readiness

| بررسی                  | نتیجه تازه و شاهد                                                                                                                                  |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| نصب پاک                | `npm ci`: Passed، ۲۵۷ بسته؛ lockfile تغییر نکرد                                                                                                    |
| TypeScript / ESLint    | هر دو Passed؛ پس از اصلاح کد و تقویت تست‌های UI دوباره اجرا شدند                                                                                   |
| Production build       | `npm run build`: Passed؛ ۱۷ صفحه static و API موجود؛ SW فقط از build بازتولید شد                                                                   |
| واحد                   | ۴۴ passed، صفر failed/skipped؛ اجرای جداگانه همان فایل‌های tests/unit                                                                              |
| یکپارچه                | ۸۱ passed، صفر failed/skipped؛ بخش integration از `npm test` با مجموع ۱۲۵ تست، پس از تأیید ۴۴ تست واحد                                             |
| کل backend             | ۱۲۵ passed، صفر failed/cancelled/skipped؛ حدود ۱۰۶ ثانیه؛ concurrency=4 و timeout=120000 بدون افزایش                                               |
| مرورگر                 | ۳۱ passed، صفر failed، ۱ skipped قدیمی؛ ۳۲ سناریو، حدود ۱٫۷ دقیقه. inference اختیاری در سرور mock شرط skip دارد؛ skip تازه اضافه نشد.              |
| امنیت مرتبط            | ۱۵ تست auth/OTP/email/outbox/RBAC در اجرای اختصاصی Passed؛ رگرسیون‌های تازه در کل ۱۲۵ نیز Passed                                                   |
| سازگاری داده           | `audit:integrity` روی DB مصنوعی: assignmentsNeedingReview=0                                                                                        |
| backup/restore فعلی    | Passed روی DB مصنوعی با نویسندگان متوقف: ۴۴ collection، ۵۳۸ سند، آرشیو ۷۲۵۷۸ بایت؛ برابری hash/index، مقصد تصادفی و منبع دست‌نخورده                |
| Ollama واقعی           | `smoke:ollama` Passed، qwen2.5:3b، دو ورودی مصنوعی؛ usage واقعی ۱۴۵/۱۲ و ۲۰۲/۱۵ توکن                                                               |
| OCR واقعی              | تست‌های document-pipeline و benchmark محلی اجرا شدند؛ چهار fixture سؤال FP/FN شماره صفر؛ متن/اسکن/علوم گزینه ۱۰۰٪، mixed فقط ۶۲٫۵٪، scan CER=۳٫۳۳٪ |
| Environment/راه‌اندازی | `.env.example`، README، PHONE_OTP، PASSWORD_RESET، EXAM_IMPORT_ENGINE و الگوهای worker بررسی شدند؛ secret در Git نیست                              |

### پوشش جریان‌های موجود

| جریان     | شواهد اجرا                                                                                                                                                                                                      |
| --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| معلم      | flow/full-individual-journey، question-bank/edit/source/visuals، courses/class-groups، mission lifecycle: ثبت‌نام/ورود، درس، سؤال، دعوت، انتشار، پاسخ و گزارش                                                   |
| دانش‌آموز | student-self-service، dashboard، practice-selection، learning/remediation: اتصال، تمرین، کمک، ذخیره/refresh، پایان و مرور؛ مستقل/با راهنما و نزده‌ها جدا                                                        |
| والد      | parents، question-assets، access-roles: رابطهٔ مجاز، گزارش محدود، IDOR منفی، خواندنی و revoke؛ احراز حقوقی سرپرست ادعا نمی‌شود                                                                                  |
| منشی/مدیر | access-control/access-roles: scope واگذارشده، مدیریت مجاز، رد ارتقای عمومی، لغو و audit؛ رقابت login/admin نیز رگرسیون دارد                                                                                     |
| حساب      | phone-otp، auth-session، password-reset، email-verification و UI متناظر: کد یک‌بارمصرف، محدودیت حدس/ارسال، تغییر/انقضا/ابطال نشست؛ سرویس بیرونی فقط dependency کنترل‌شده                                        |
| PDF       | upload→worker→PDF.js/Poppler/Tesseract→بازبینی→تأیید/رد→بانک؛ quota/lease/retry/مالکیت/کلید نامطمئن و نسخه immutable در تست‌های موجود                                                                           |
| UI/PWA    | RTL، deep link، refresh، Back/Forward، فرم/خطا/خالی، modal/dropdown، نمودار/فرمول و منع cache API خصوصی؛ عرض‌های ۳۶۰/۳۹۰/۷۶۸/۱۲۸۰ برای صفحات معلم، والد، OTP/email و با تقویت مدیر/منشی/تمرین/گزارش بررسی شدند. |

تست Chromium محلی و Linux CI مرز اعتبار مرورگر است؛ Safari/Firefox، screen reader و ممیزی مستقل کامل WCAG تأیید نشده‌اند. هیچ تضمین عمومی دقت علمی AI/OCR یا ظرفیت بار production داده نمی‌شود.

### خطاهای اجرای ممیزی که پنهان نشدند

اولین اجرای کامل backend هنگام کار هم‌زمان مرورگر سه PoolClearedOnNetworkError ناشی از monitor timeout MongoDB و سه لغو/timeout داشت (۱۱۹ passed، ۳ failed، ۳ cancelled). علت قطعی وقفه شبکه/سرور اثبات نشد. یک فرایند تست ۱۹ساعته با cwd همین checkout نیز شناسایی و متوقف شد؛ آن را بدون شواهد علت timeout نمی‌دانیم. MongoDB واقعی restart نشد. پس از توقف نویسندگان آزمایشی و اجرای جداگانه، همان `npm test` بدون تغییر timeout/assertion با ۱۲۵/۱۲۵ موفق شد. CI روی Linux مستقل نیز مرجع بررسی نهایی است.

## B — External / Operational Readiness

| مورد                                                                                | وضعیت                                              | اقدام مالک/اپراتور                                                                                                                                                                      |
| ----------------------------------------------------------------------------------- | -------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ملی‌پیامک واقعی                                                                     | NOT VERIFIED / RELEASE BLOCKER برای ورود OTP واقعی | MELIPAYAMAK_USERNAME/PASSWORD/OTP_BODY_ID و AUTH_OTP_SECRET؛ الگوی خدماتی تک‌متغیره تأییدشده، تست پذیرش و دریافت روی شماره مجاز. هیچ پیامک واقعی یا پولی در ممیزی ارسال نشد.            |
| SMTP/Inbox                                                                          | NOT VERIFIED                                       | TLS معتبر implicit 465، SMTP_HOST/USER/PASSWORD/FROM، APP_ORIGIN و MAIL_OUTBOX_KEY یکسان وب/worker؛ اجرای worker:mail و آزمون Inbox. تست outbox/retry/restart جایگزین تحویل واقعی نیست. |
| AvvalAI پولی                                                                        | NOT VERIFIED                                       | انتخاب مدل/اعتبار و مجوز هزینه با سقف بودجه؛ هیچ inference پولی اجرا نشد. adapter و failure/validation کنترل‌شده آزموده‌اند.                                                            |
| دامنه/HTTPS                                                                         | NOT VERIFIED در مقصد                               | دامنه/DNS، گواهی، APP_ORIGIN دقیق، COOKIE_SECURE=true، validate قالب Caddy و بررسی header/cookie روی مقصد                                                                               |
| وابستگی‌ها                                                                          | NOT VERIFIED                                       | تلاش تازه audit رسمی با fetch-timeout=15000/retries=0 نیز read ETIMEDOUT داد؛ اجرا در شبکه قابل دسترس لازم است. نبود پاسخ به معنی نبود آسیب‌پذیری نیست.                                 |
| عملیات و backup مقصد                                                                | محیط مقصد تأیید نشده                               | replica set خصوصی، supervisor وب و هر دو worker، منابع OCR، پایش/هشدار، زمان‌بندی backup/rotation و مقصد خارج میزبان؛ RPO/RTO، rollback و drill مقصد با مسئول مشخص                      |
| داده کودک ایران/پایه اول تا دوازدهم                                                 | RELEASE BLOCKER برای داده واقعی                    | تصمیم نگهداری/حذف/میزبانی، مسئول و روش احراز/رضایت سرپرست و فرایند پاسخ‌گویی لازم است. اتصال parentLinks فقط رابطه فنی است.                                                             |
| رضایت نسخه‌دار/حذف حساب و retention آموزشی جدید                                     | OUT OF SCOPE در Feature Freeze                     | این زیرساخت‌ها موجود نیستند؛ بدون طراحی خودسرانه سیستم تازه، مانع عرضه داده کودک ثبت می‌شوند.                                                                                           |
| بانک عمومی، OTP recovery برای شماره ازدست‌رفته، OMR، کالیبراسیون دشواری، مقیاس بزرگ | OUT OF SCOPE                                       | در برش فعلی teacher-led قرار ندارند؛ فقط محدودیت‌های واقعی مستند می‌شوند.                                                                                                               |

### چک‌لیست استقرار نسخه موجود

- [ ] محیط Node 22، build همین main، MongoDB replica set خصوصی و backup پیش از راه‌اندازی روی داده واقعی.
- [ ] تولید و نگهداری secretهای OTP/outbox خارج Git؛ تنظیم SMS/SMTP و آزمون واقعی کانال‌ها.
- [ ] نصب Poppler/Tesseract و مدل OCR دارای checksum؛ راه‌اندازی worker:exams و worker:mail تحت supervisor محدود.
- [ ] HTTPS، cookie، Origin، rate limiting لبه و عدم ثبت token/query/body خصوصی در proxy/logهای مقصد.
- [ ] برنامه backup/restore و پایش با مالک عملیاتی؛ تست مقصد جایگزین drill محلی نیست.
- [ ] تصمیم‌های حقوقی/حریم خصوصی پیش از هر داده کودک؛ تا آن زمان فقط داده مصنوعی و ارائهٔ کنترل‌شده.
- [ ] بررسی TTL جدید در انتشار تولیدی: فقط expiresAt اطلاعات موقت OTP؛ قبل از startup روی production، اسناد منقضی/backup و تأیید عملیات بررسی شوند. rollback کد، اسناد TTL حذف‌شده را برنمی‌گرداند. در محیط محلی حاضر هر دو مجموعه پیش از restart صفر سند داشتند؛ داده واقعی حذف نشد.

## تحویل Git و حدود ادعا

کار مستقیم روی main و push معمولی، بدون feature branch تازه و بدون PR انجام می‌شود. branch/PR و SHA رأس با Git/GitHub در پایان تأیید می‌شوند؛ [آخرین workflow main](https://github.com/MohammadKoolivand/hamyar/actions/workflows/verify.yml?query=branch%3Amain) نتیجهٔ commit نهایی را نشان می‌دهد. هیچ secret، backup یا فونت خصوصی commit نشده است. P0 بازِ بازتولیدشده در دامنه آزموده‌شده باقی نماند؛ دو P1 فوق رفع شدند. blockerهای واقعی انتشار در جدول B پابرجا هستند و با تکمیل کد DONE محسوب نمی‌شوند.

پس از این ممیزی توسعهٔ قابلیت جدید متوقف است؛ اقدام بعدی، تنظیم محیط و رفع پیش‌نیازهای واقعی استقرار است.
