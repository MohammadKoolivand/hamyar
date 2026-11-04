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

## مرحلهٔ استقرار staging — ممیزی مقصد و برنامهٔ اجرایی

مقصد معرفی‌شده مالک: `87.107.54.77`، SSH پورت `9011`. fingerprint کلید RSA با پنل توسط مالک تطبیق و تأیید شد؛ ورود از پنجره امن رمز سیستم و نشست SSH موقت انجام شد. رمز در فرمان، فایل، Git یا گزارش نوشته نشد. دسترسی root فقط برای ممیزی خواندنی استفاده شد؛ هنوز نصب، تغییر Firewall/DNS یا سرویس مقصد انجام نشده است.

وضعیت کشف مقصد: Ubuntu 24.04 x86_64، ۲ vCPU، RAM حدود ۳٫۸ GiB، بدون swap، حدود ۲۶ GiB دیسک آزاد. فقط SSH روی 9011 فعال است؛ Node/npm، MongoDB، OCR، Reverse Proxy و Ollama موجود نیستند. DNS نام‌های رسمی resolve می‌شود ولی دسترسی HEAD به Node/Mongo/npm و archive Ubuntu timeout داشت؛ رفع مسیر خروجی باید پیش از نصب بررسی و با تأیید مالک انجام شود. دامنه staging هنوز ارائه نشده است.

### فایل‌های آماده برای بازبینی و تأیید

- `ops/hodhod-web.service`: وب غیر-root روی loopback:5174، restart/SIGTERM و مسیرهای نوشتن محدود.
- `ops/hodhod-exam-worker.service` و `ops/hodhod-mail-worker.service`: همان workerهای موجود با guard تنظیمات قبل از startup؛ هیچ HTTP listener ندارند.
- `scripts/check-deployment.mjs` / `npm run ops:preflight -- web|exams|mail`: فقط config و وجود build را بررسی می‌کند؛ نام DB را با HODHOD_EXPECTED_DB تطبیق می‌دهد، HTTPS/Secure/keyها را بررسی و فقط کد خطا چاپ می‌کند. READY این ابزار صرفاً صحت configuration است، نه صحت DNS/TLS/SMS/SMTP.
- `deploy/mongod-staging.conf`: replica set احرازشده فقط روی 127.0.0.1؛ keyfile باید بیرون Git با مجوز 600 و مالک mongodb ساخته شود. این قالب روی دیتابیس قبلی کپی نشود.
- Caddyfile موجود تا دریافت دامنه و تأیید تغییر سرویس/DNS/پورت عمومی نصب یا فعال نمی‌شود.

### برنامهٔ تغییرات مقصد — هنوز اجرا نشده؛ نیازمند تأیید مالک

۱. دسترسی خروجی منابع رسمی را رفع/تأیید کنید؛ بدون تغییر خودسرانه Firewall یا SSH. Node 22 Linux x64 از [منبع رسمی](https://nodejs.org/en/download/archive/v22) با checksum تأیید شود؛ ابزارهای OCR از apt Ubuntu و MongoDB 8 از [مخزن رسمی امضاشده برای Noble](https://www.mongodb.com/docs/v8.0/tutorial/install-mongodb-on-ubuntu/) نصب شوند. هیچ curl|bash یا منبع ناشناس لازم نیست.

۲. کاربر سرویس `hodhod` بدون login shell، releaseها زیر `/opt/hodhod/releases/<SHA>`، state خصوصی زیر `/var/lib/hodhod` و secretها در `/etc/hodhod/staging.env` با مالک hodhod و mode=600 آماده شوند. `/srv/hodhod` فقط به release تأییدشده اشاره کند. کلید Mongo و credential bootstrap ریشه در `/etc/hodhod` با دسترسی محدود، خارج Git/log تولید شوند؛ هیچ credential در argv نباشد. اولین مدیر Mongo و کاربر readWrite فقط برای `hodhodeh_staging_demo` ساخته شوند. rs.initiate فقط روی نمونه تازه و پس از guard خالی‌بودن اجرا شود؛ هیچ DB واقعی overwrite نمی‌شود.

۳. `.env` هر release به فایل امن مشترک و `.private` به state مشترک اشاره کند. MONGO_DB و HODHOD_EXPECTED_DB برابر `hodhodeh_staging_demo` و URI به replica set محلی احرازشده متصل باشند. APP_ORIGIN دامنه واقعی HTTPS و COOKIE_SECURE=true؛ OTP/SMTP هنوز بدون secret/مجوز ارسال واقعی فعال محسوب نمی‌شوند. روی ۴ GiB فعلی، ظرفیت اجرای هم‌زمان Ollama و OCR تأیید نشده؛ دانلود مدل یا نصب سرویس AI بدون تصمیم منابع/Provider انجام نمی‌شود.

۴. با user=hodhod در release جدید و بدون تماس به DB واقعی:

```sh
npm ci
npm run typecheck
npm run lint
npm run ocr:setup
npm run build
# Configuration only; HTTPS/DNS must separately be verified.
npm run ops:preflight -- web
npm run ops:preflight -- exams
# Only after SMTP and MAIL_OUTBOX_KEY are configured:
npm run ops:preflight -- mail
```

۵. فقط پس از تأیید مالک برای تغییر سرویس، قالب‌ها نصب و با systemd مقصد validate شوند. قبل از install، `.next/cache` و state خصوصی باید با مالک محدود موجود باشند. SSH:9011 ثابت بماند؛ Mongo، Next و Ollama public نشوند. نمونه دستورات مرحله سرویس (در این ممیزی اجرا نشده‌اند):

```sh
systemd-analyze verify /srv/hodhod/ops/hodhod-web.service /srv/hodhod/ops/hodhod-exam-worker.service /srv/hodhod/ops/hodhod-mail-worker.service
install -m 644 /srv/hodhod/ops/hodhod-web.service /etc/systemd/system/
install -m 644 /srv/hodhod/ops/hodhod-exam-worker.service /etc/systemd/system/
install -m 644 /srv/hodhod/ops/hodhod-mail-worker.service /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now hodhod-web hodhod-exam-worker
# Mail must remain stopped until real SMTP and queue key are ready.
systemctl enable --now hodhod-mail-worker
curl --fail --silent http://127.0.0.1:5174/api/health
systemctl is-active hodhod-web hodhod-exam-worker hodhod-mail-worker
```

خط mail را فقط در صورت موفقیت preflight همان نقش اجرا کنید؛ برای SMTP تنظیم‌نشده اجرای آن مجاز نیست. مدل رمزهای خصوصی/اطلاعات outbox نباید در journal یا proxy access log چاپ شوند.

۶. پس از تعیین دامنه/DNS و تأیید مالک، Caddy validate و HTTPS فعال شود. `/api/health` موجود، ping دیتابیس و وضعیت provider تنظیم‌شده را گزارش می‌کند؛ endpoint readiness جدا وجود ندارد و در Feature Freeze ساخته نشده است. health سبز به معنی تحویل SMS/SMTP یا موفقیت واقعی AI نیست.

### Stop → Backup → Deploy → Start → Health و Rollback

قبل از هر انتشار دارای داده، با تأیید مالک وب و هر دو worker و هر نویسنده دیگر متوقف شوند. `WRITES_PAUSED=true npm run verify:backup` صرفاً اعلام اپراتور است و خودش قفل نمی‌گیرد. این فرمان آرشیو و drill restore را روی DB تصادفی انجام می‌دهد؛ URI باید مجوز restore موردنیاز داشته باشد و credential محدود وب معمولاً برای آن کافی نیست. از credential عملیاتی امن استفاده کنید، نه قراردادن رمز در خط فرمان. backup مقصد/برنامه زمان‌بندی/retention بدون تصمیم مالک ایجاد نمی‌شود.

release فعلی و قبلی حفظ شوند؛ npm ci/build روی release فعال انجام نشود. symlink `/srv/hodhod` فقط پس از backup موفق به release آزموده‌شده تغییر کند، سپس وب/workerهای تنظیم‌شده شروع و health، لاگ redacted و یک جریان مصنوعی مرورگر بررسی شوند. در شکست، همان سرویس‌ها متوقف، symlink به release قبلی برگردد و start/health تکرار شود. rollback کد TTL حذف‌شده را برنمی‌گرداند و DB واقعی نباید با dump قدیمی جایگزین شود؛ پیش از startup سیاست TTL OTP و backup بررسی شوند. اثر TTL و restore در محیط مصنوعی جدا اندازه‌گیری می‌شود.

## CI/CD staging — ۲۰۲۶/۱۰/۲۷

- دامنه خریداری‌شده: `hodhodedu.ir`. تصویر مالک رکوردهای A برای @، www و * به سرور را نشان می‌دهد؛ پنل همچنان «در انتظار تغییر NS» است. انتشار DNS و TLS عمومی هنوز تأیید نشده‌اند.
- محیط GitHub `staging` ایجاد شد و deployment branch policy فقط `main` را می‌پذیرد. متغیرهای غیرمحرمانه: STAGING_HOST=87.107.54.77، STAGING_PORT=9011، STAGING_USER=hodhod. حساب محدود و کلید هنوز روی مقصد آماده نشده‌اند.
- Verify پس از همه gateهای موجود، source دقیق commit را با `git archive`، SHA256SUMS و COMMIT منتشر می‌کند؛ هیچ `.env`، داده، node_modules یا فایل خصوصی وارد artifact نمی‌شود. اعتبار artifact چهارده روز است. مسیر CD نتیجه CI همان repository، workflow، main و event معتبر را با API بررسی می‌کند.
- `.github/workflows/staging.yml` فقط workflow_dispatch است؛ run_id اجرای موفق Verify لازم دارد و activate پیش‌فرض false است. download-artifact دقیقاً artifact SHA همان run را می‌گیرد. SSH با known_hosts ثابت و StrictHostKeyChecking اجرا می‌شود، نه ssh-keyscan در زمان انتشار.
- Secrets لازم در environment: `STAGING_SSH_KEY` کلید اختصاصی کاربر محدود، `STAGING_KNOWN_HOSTS` کلید عمومی میزبان که fingerprint آن با مالک تطبیق داده شده است. رمز root داخل workflow قرار نمی‌گیرد. این secrets هنوز ثبت نشده‌اند؛ CD واقعی **Not Verified / Missing Access** است.
- سرور پس از bootstrap و بازبینی اپراتور باید `ops/deploy-staging.sh` را root-owned در `/usr/local/sbin/hodhod-deploy` نصب کند و sudo فقط برای همین فرمان به حساب انتشار بدهد. ورودی در `/var/lib/hodhod/incoming`، release در `/opt/hodhod/releases`، env در `/etc/hodhod/staging.env` و private shared در `/var/lib/hodhod/private` است. deploy script در repo خودبه‌خود نصب نمی‌شود.
- آماده‌سازی: checksum، release جدید بدون overwrite، npm ci، OCR checksum setup، typecheck، lint، build و preflight. اجرای پیش‌فرض سرویس‌ها را تغییر نمی‌دهد. تکرار همان SHA موجود با خطای روشن متوقف می‌شود؛ برای retry اپراتور باید release ناموفق را بررسی/کنار بگذارد، داده shared پاک نمی‌شود.
- activation فقط روی نصب قبلی با symlink معتبر مجاز است؛ first bootstrap جداست. وجود hook اجرایی root-owned `/etc/hodhod/backup-before-release` الزامی است. اپراتور باید آن را با credential اختصاصی backup و آزمون restore تهیه و تأیید کند؛ hook نمایشی یا `true` پذیرفتنی نیست. این hook هنوز نصب نشده و activation بدون آن متوقف می‌شود.
- هنگام activation وب و workerهای نویسنده متوقف، hook backup اجرا، symlink اتمیک جابه‌جا و health loopback و systemd بررسی می‌شوند. SMTP worker فقط اگر قبلاً فعال بوده restart می‌شود؛ سرویس جدید یا ارسال آزمایشی فعال نمی‌شود. هر شکست پس از توقف نویسندگان کد قبلی را برمی‌گرداند؛ دیتابیس restore خودکار نمی‌شود و migration مخرب در این pipeline وجود ندارد. سلامت عمومی HTTPS هنوز باید پس از تنظیم proxy/DNS جدا بررسی شود.
- وضعیت واقعی: CI قابل اجرا؛ artifact و CD جدید تا اجرای GitHub بعد از push در انتظار تأیید؛ استقرار SSH، rollback روی systemd واقعی، HTTPS و hook backup **Not Verified**. محدودیت اتصال خروجی سرور همچنان نیازمند رفع است. ساخت workflow به معنی انتشار سایت نیست.

## Staging preparation — 2026-10-31

Operator scope: preparation only; user explicitly deferred activation. No web/worker/HTTPS activation, DNS, Firewall or SSH configuration changes were performed.

- Verified GitHub Actions run https://github.com/MohammadKoolivand/hamyar/actions/runs/40672945274: all verify job gates succeeded for `f102117558a10619a01c39124de4d9178747a0c2`. Downloaded its unexpired source artifact, transferred it by SSH, and verified SHA256SUMS on destination. Local uncommitted changes were excluded.
- DNS resolves hodhodedu.ir to 87.107.54.77 with Arvan nameservers. SSH 9011 reachable; RSA fingerprint matches the previously confirmed fingerprint. HTTPS connection refused before preparation.
- Outbound npm registry and Ubuntu archive returned HTTP 200; nodejs.org was reachable. Server access to MongoDB package index and fastdl returned HTTP 403, not a general Internet outage.
- Installed official Node v22.23.4 / npm 10.9.9 after SHA256 verification, Poppler 24.02.0 and Tesseract 5.3.4 with fas/eng/osd. Installed MongoDB server 8.0.34 using the official Ubuntu Noble package downloaded locally and transferred by SSH; SHA256 matched official package metadata. Mongo service was blocked from automatic start during installation and verified inactive/disabled afterward.
- Prepared restricted user hodhod, shared private/incoming directories and isolated release `/opt/hodhod/releases/f102117558a10619a01c39124de4d9178747a0c2`. `npm ci`, `npm run typecheck`, `npm run lint`, and `npm run build` all exited 0 on the server. npm reported 11 moderate advisories; no automatic dependency rewrite was performed.
- Replica-set configuration staged at `/etc/hodhod/mongod-staging.prepared.conf`; internal key generated server-side with mode 600. Mongo was not initialized, no application database/account was created, and runtime env is not configured. Production readiness/preflight and runtime health/journeys remain Not Verified.
- Final listener check: only SSH on 9011. mongod, hodhod-web, hodhod-exam-worker and caddy inactive. Caddy not installed. No SMS/SMTP credentials or real sends configured.
- Remaining: approve activation scope, initialize authenticated localhost-only independent staging replica/database, prepare secure runtime environment and credentials, OCR model setup, systemd validation, Caddy/TLS installation/activation and synthetic teacher/student health checks. Current prepared release does not include later uncommitted question/difficulty UI changes.

### Staging activated — 2026-10-31

User subsequently explicitly approved activation. Published https://hodhodedu.ir using the same verified SHA `f102117558a10619a01c39124de4d9178747a0c2`. MongoDB initialized as authenticated `hodhodeh-staging-rs`, localhost only; separate `hodhodeh_staging_demo` database and readWrite-only application user created. Bootstrap credentials and application environment exist only in restricted files under `/etc/hodhod`; no secret is recorded here. OTP bypass=false. Current staging has zero users; no development/archive data copied.

- Official OCR models downloaded and both lockfile SHA256 checks passed. Web/exam configuration preflight READY; web warning REAL_SMS_NOT_CONFIGURED remains.
- hodhod-web, hodhod-exam-worker, mongod and caddy enabled/active. Web and exam workers NRestarts=0 at verification. SMTP/mail worker not enabled.
- Caddy installed from Ubuntu packages, configuration validated, Let's Encrypt certificate issued successfully. External HTTPS GET `/` returned HTTP/2 200 with normal certificate validation; `/api/health` returned status=ok and explicitly reported mock AI. No real AI-provider verification claimed.
- ReadWrite application credential successfully connected to the expected DB, ping succeeded and hello reported primary=true for the expected replica set.
- Chrome/Playwright public-page checks at 1280x900 and 390x844: HTTP 200, no pageerror, no horizontal overflow. Screenshots captured locally under `/private/tmp/hodhod-staging-desktop.png` and `hodhod-staging-mobile.png`. Bundled Playwright browser was missing; installed Chrome channel used successfully instead.
- Listener check: public 80/443 and unchanged SSH:9011; Mongo:27017, Next:5174 and Caddy admin:2019 bound to loopback. No Firewall, DNS or SSH configuration changed.
- Teacher/student authenticated journeys remain Not Verified on staging because real Melipayamak credentials are absent; production OTP bypass remains disabled. SMTP and real AI also unconfigured. No test account/session bypass or real sends introduced.
- Runtime is online, but this is a controlled staging release, not full acceptance. Backup hook/CD restricted-key provisioning and synthetic authenticated journey checks remain operational work. Later local uncommitted product changes are not included in this CI-tested release.

### Token OTP and font release — 2026-11-01

Published `ff27208a36b8972a5b12ad2de92caa0d878a64e8` after successful CI run https://github.com/MohammadKoolivand/hamyar/actions/runs/41207413549 . Added existing Melipayamak console shared-token API support with vendor-origin/path validation, one OTP argument, timeout, no redirects, positive recId requirement and redacted errors; legacy credentials remain supported. Token copied directly from owner's Panjoul server into restricted staging env without local secret files or printed values; body ID=573237. No SMS sent by agent; real acceptance/delivery remains to be verified with a user-initiated request. Production bypass stays disabled.

Earlier local phone-OTP integration run could not connect to local MongoDB: four tests failed ECONNREFUSED, controlled legacy adapter passed; this was an environment blocker, not reported as passing. Five focused adapter/config tests, local typecheck/lint passed; GitHub full Verify succeeded before release.

The first activation attempt was interrupted by approval-service usage limits. Server inspection confirmed old f102117 was still active, explaining SMS-not-configured response. Completed server build, config preflight (READY, zero warnings), and a non-destructive EJSON/gzip backup of 36 staging collections with zero documents before switching. Backup gzip roundtrip verified; no restore drill claimed. Current symlink ff27208, web/exam active and loopback health status=ok.

Copied existing private IRANSans font into persistent server private/fonts, outside Git, and rebuilt using existing prepare-font script. Build logged licensed IRANSans enabled. No local uncommitted product changes included.

### Profile completion release — 2026-11-01

Published `8bdda13a2c83c2b49eeba408d520418d3a545062` after successful Verify https://github.com/MohammadKoolivand/hamyar/actions/runs/41242566902 . Unknown-phone signup now transitions from a valid OTP to name/role form, hides OTP and resend controls, preserves the original code in memory and submits it with the completed profile; server still validates expiry/single-use and role boundaries. No additional SMS is requested. Regression browser scenario passed against the actual isolated backend with controlled SMS; CI reported backend 156 passed/0 failed and browser 43 passed. Server typecheck/lint/build/preflight passed; private font included. Quiesced staging backup captured 39 collections/9 documents with gzip roundtrip verification before activation. Web/exam active and health=ok after activation. Real SMS delivery is not inferred from this controlled browser test.

### Review form and requested curriculum — 2026-11-02

Published `d5cb54a8563af7368f75e81a14ccbcf27ed53745` after successful Verify https://github.com/MohammadKoolivand/hamyar/actions/runs/41323646109 . Review choices now preserve Enter/newlines; the correct choice is selected from a dropdown; explicit validation messages explain disabled approval. Browser regression exercises Enter and selecting an answer enables approval. Fixture-backed browser cleanup drains pending transport requests before unroute; assertions retained. Server production build and configuration preflight passed. Quiesced backup captured 40 collections/2022 documents (gzip roundtrip verification only); web/exam worker active and loopback health OK after activation. Unrelated working-tree changes excluded.

Transferred existing catalog to owner's staging teacher account with insert-only stable IDs: 34 books, 640 topics, 922 total nodes. Snapshot retained before transfer. Prepared seven additional source-checked books from user-provided official PDFs: biology 10/11/12, vocational biology 10, chemistry 10/11/12. Biology 12 source is explicitly the supplied 1399–1400 edition. Chemistry outline coverage is chapter-level only; finer unverified topics are not invented. Source PDFs, SHA256 metadata and repeatable node payload retained privately under `.private/curriculum-additions` and `.private/textbooks/user-requested`. No production/student data deleted or overwritten.

Requested book-topic transfer completed: seven official PDFs, 39 chapter/module nodes and 89 topics; 135 nodes inserted and five existing ancestors preserved. Existing teacher content retained. Vocational biology remains distinct; supplied biology-12 edition remains explicitly 1399–1400.

Published UUID compatibility fix `e2b9d8176a87f6d61bfb6e18f0c77aa23f0bbf16` after successful Verify https://github.com/MohammadKoolivand/hamyar/actions/runs/41345015685 . Source-transcribed SHA256 item identifiers were rejected by UUID-only review/source-image routes. Compatibility accepts only an existing, marked source-transcription draft in the authenticated owner's exact exam; ordinary UUID behavior preserved. Three local exam-import integration tests passed on a separate temporary replica set, including save/approve and negative ownership/exam cases; temporary mongod stopped. Backup, preflight and service health verified before/after activation.

Published question typography `e8f733bbcbc8a7134a174f87d7da6215ba48e255` after successful Verify https://github.com/MohammadKoolivand/hamyar/actions/runs/41347727301 . Bundled OFL Amiri Bold and STIX Two Math provide print-style question text/formulas, retaining Persian digits. These are substitutes rather than identified exact embedded PDF faces. Application UI typography preserved; question fonts not preloaded globally. Chrome preview at 1400 and 390 pixels confirmed both fonts loaded, six formula nodes rendered and no page overflow. Server build/configuration preflight passed; quiesced backup of 40 collections/2162 documents gzip-roundtrip checked; web/worker active and loopback health OK after switching. Backup restore drill not claimed.

### Original exam typeface correction — 2026-11-02

Further inspection of the original PDF font name tables identified B Nazanin Bold for Persian statement text/numerals, Times New Roman Bold for Latin identifiers, and Symbol/MT Extra for operators. The prior Amiri substitute was visibly different. Replaced question text with the complete B Nazanin Bold face; verified cmap covers all Persian alphabet letters and digits (the embedded subset did not). Latin identifiers now use upright local Times New Roman Bold with bundled STIX fallback. Font provenance and remaining native-MathML positioning limitations are recorded in `src/assets/fonts/QUESTION-FONTS.md`. Desktop/mobile Chrome previews loaded both fonts and showed no overflow. CI for `890b1211650fd00e117cc013d120d0f9264c6e79` succeeded: https://github.com/MohammadKoolivand/hamyar/actions/runs/41350832768 .

Activated original-typeface release `890b121` after server build and configuration preflight succeeded. Quiesced backup: 43 collections/2176 documents; gzip roundtrip only. Web/exam worker active and loopback health OK after activation. Typeface QA checked complete Persian alphabet/digit coverage and desktop/mobile rendering; Roman identifiers are upright bold, with platform-dependent local Times New Roman and bundled fallback as documented.
