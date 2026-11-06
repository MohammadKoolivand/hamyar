# ممیزی انتقال و ذخیره دادهٔ حساس — هدهد

## دامنه و محدودیت‌ها
بررسی ایستا روی آرشیو پروژه انجام شد؛ به دیتابیس، سرور تولیدی، گواهی واقعی TLS، Secret Manager و تنظیمات Cloud دسترسی نداشتیم. هیچ ادعایی دربارهٔ فعال بودن TLS در محیط عملیاتی یا رمزنگاری دیسک واقعی نداریم. تاریخچهٔ Git و داده‌های واقعی در دسترس نبود.

## جریان اطلاعات و کنترل‌های مشاهده‌شده
| مسیر | نوع داده | شواهد در کد | الزام اجرایی |
|---|---|---|---|
| Browser → Caddy → Next/Fastify | Cookie نشست، مشخصات حساب، پاسخ آزمون و اطلاعات آموزشی | `deploy/Caddyfile`، `src/server/security/session.ts`، `src/server/app.ts`، `next.config.mjs` | HTTPS معتبر در لبه، TLS termination با Caddy و HSTS؛ سرویس داخلی فقط loopback؛ redirect HTTP→HTTPS و تمدید خودکار گواهی باید در محیط تست شود. |
| API/Workers → MongoDB | کاربران، تلفن/ایمیل، هش رمز و نشست، کدها، پاسخ‌ها، گزارش‌ها، منابع آموزشی | `src/server/db.ts` و `scripts/*` | MongoDB production حتماً TLS با hostname/CA معتبر، auth و حداقل دسترسی؛ at-rest encryption روی volume/backup؛ برنامه با `MONGO_URL` دارای `tls=true` یا `mongodb+srv` بالا بیاید. نیازمند آماده‌سازی گواهی سرور و شبکه است. |
| API → SMS | شماره موبایل و OTP | `src/server/auth/sms.ts` | HTTPS مقصد ثابت و اعتبارسنجی گواهی توسط Node؛ HTTPS به‌تنهایی محرمانگی داده نزد ارائه‌دهنده را تضمین نمی‌کند. |
| API → AvalAI | متن ارسالی به مدل، کلید API و محتوای آموزشی | `src/server/ai/avalai.ts` | فقط HTTPS؛ اطلاعات شناسایی دانش‌آموز نباید به پرامپت ارسال شود؛ قرارداد پردازش داده، retention و منطقه میزبانی بررسی شود. |
| API/Workers → Ollama | متن تمرین/پاسخ/راهنما | `src/server/ai/ollama.ts`، `src/server/ai/question-generator.ts` | HTTP فقط به loopback مجاز است؛ اگر سرویس روی میزبان دیگری است HTTPS معتبر/شبکه امن الزامی و پس از سخت‌سازی در production بدون TLS رد می‌شود. |
| Mail worker → SMTP | ایمیل بازیابی، لینک یک‌بارمصرف | `src/server/auth/reset-mail.ts` | TLS 1.2+ implicit و اعتبارسنجی گواهی فعلی، مدیریت امن رمز SMTP. |
| API → Mongo mailOutbox | ایمیل و توکن بازیابیِ در صف | `src/server/auth/mail-outbox.ts` | از قبل AES-256-GCM با IV تصادفی و AAD دارد؛ نگهداری کلید جدا از DB الزامی است. |

## طبقه‌بندی داده و تصمیم رمزنگاری در حالت سکون
- **سطح بسیار حساس:** کد OTP، session token، توکن بازیابی/دعوت، رمز عبور و توکن‌های سرویس: مقدار خام آن‌ها نباید در DB یا لاگ بماند؛ هش یک‌طرفه و الگوریتم KDF برای گذرواژه (فعلاً scrypt) مناسب‌تر از رمزنگاری برگشت‌پذیر است. صف ایمیلِ حاوی توکن با AES-256-GCM محافظت می‌شود. Secretها در Secret Manager با دسترسی حداقلی نگهداری شوند.
- **اطلاعات هویتی:** شماره تلفن، ایمیل، نام، رابطه ولی/دانش‌آموز و شناسه‌ها: برای ایمیل/شماره در صورت نیاز به جست‌وجوی تساوی، رمزنگاری تصادفی بدون طراحی index ممکن نیست. راهکار پیشنهادی: field-level AEAD با envelope encryption و کلید مجزای هر محیط + blind index بر پایه HMAC برای جست‌وجوی equality. فعلاً در کد برای همه این فیلدها فعال نشده؛ پیش از فعال‌سازی نیاز به طراحی مهاجرت، جست‌وجو، بازگردانی و rotation است.
- **اطلاعات آموزشی خصوصی:** پاسخ تشریحی، اشتباهات، گزارش پیشرفت، نمره‌ها، فایل‌های واردشده و محتوای آزاد: دسترسی بر اساس نقش و مالکیت، encryption at rest (دیسک، Mongo و backup) ضروری؛ رمزنگاری سطح فیلد برای داده‌های بسیار حساس و متن آزاد پس از مدل‌سازی جریان‌ها توصیه می‌شود. پاسخ‌های در موعد انتشار محدود، با کنترل سمت سرور و عدم درج در پاسخ HTTP محافظت شوند.
- **داده عمومی/غیرشخصی:** کاتالوگ و محتوای عمومی به رمزنگاری فیلدی نیاز ندارند؛ با این حال TLS و صحت داده لازم است.

## مدیریت کلید و دسترسی
1. کلیدها/رمزهای تولید در vault/KMS یا Secret Manager؛ نه Git، image Docker، فایل‌های آرشیو و لاگ. سطح دسترسی جدا برای وب/worker، staging/production و read/write.
2. چرخش کلیدهای رمزنگاری با **نسخهٔ کلید** و dual-read/single-write انجام شود؛ داده‌های قدیمی گام‌به‌گام re-encrypt و سپس کلید قدیمی بعد از تایید backup/restore غیرفعال گردد. چرخش ناگهانی `MAIL_OUTBOX_KEY` صف موجود را غیرقابل‌خواندن می‌کند.
3. MongoDB role با least privilege، احراز هویت، شبکه خصوصی، mTLS در صورت امکان، و backup encrypted با کلید مستقل؛ حقوق export و دسترسی‌های کارکنان دوره‌ای بازبینی شود.
4. برای رمزنگاری در سطح برنامه، از AEAD (AES-256-GCM)، nonce یکتا، AAD شامل شناسه رکورد/فیلد و شناسه نسخه کلید استفاده شود؛ ciphertext و tag و key-id ثبت، کلید اصلی ثبت نشود.
5. Logها نباید body، کوکی، authorization، شماره کامل تلفن، ایمیل، لینک بازیابی، URL دارای credential، AI prompt، متن دانش‌آموز یا خطای خام SDK باشند؛ log فقط route template، request-id، کد پاسخ و event ثابت. ابزار monitoring، trace و proxy جداگانه بررسی شوند.

## تغییرات این نسخه
- `scripts/transport-policy.mjs`: کنترل بدون side effect روی TLS MongoDB و مقصد AI (بدون چاپ credential)، رد کردن گزینه‌های غیرفعال‌کنندهٔ گواهی.
- `scripts/check-deployment.mjs`: fail-closed برای تنظیمات transport در preflight.
- `src/server/db.ts`: جلوگیری از اتصال برنامه در production با MongoDB بدون TLS معتبر.
- Providerهای Ollama: محدودسازی اتصال بدون TLS در محیط production به loopback.
- `next.config.mjs`: هدر HSTS روی پاسخ HTTPS؛ در proxy نیز باید تنظیمات production ممیزی شود.
- `tests/unit/transport-security.test.mjs`: تست‌های پیکربندی و عدم نشت مقادیر.

## کارهای ضروری پیش از انتشار
- صادر کردن گواهی معتبر MongoDB و فعال کردن TLS روی سرور، سپس تغییر MONGO_URL؛ نمونه `deploy/mongod-staging.conf` فعلی TLS ندارد و الگوی قابل استفادهٔ مستقیم برای تولید امن نیست.
- آزمایش handshake واقعی، hostname verification و سناریوهای گواهی منقضی/نامعتبر روی staging؛ تست‌ها فعلاً صرفاً **config-level** هستند.
- ممیزی لاگ‌های reverse proxy، APM، MongoDB و providerها در محیط staging با داده ساختگی؛ هیچ Secret واقعی در تست‌ها استفاده نشود.
- تأیید encryption at rest، snapshot/backup و کلیدگذاری مستقل با آزمایش restore؛ بررسی retention و درخواست حذف داده.
- برای رمزنگاری فیلدهای هویتی/آموزشی ابتدا طرح schema، migration و backward compatibility تهیه شود؛ فعلاً رمزنگاری فیلدی تازه روی داده موجود فعال نشده است.
- بررسی قرارداد سرویس SMS/AI دربارهٔ ذخیره و پردازش داده؛ در AI prompt اطلاعات شناسایی را حداقل کنید.

## اجرای آزمون‌ها
`node --test tests/unit/transport-security.test.mjs tests/unit/deployment-config.test.mjs`

`npm run ops:preflight` (با تنظیمات محیط واقعی، روی ماشین استقرار)

## MongoDB security follow-up

See `MONGODB_SECURITY_AUDIT.md` for hardened authenticated TLS and topology configuration, read-only verification, network ACLs and index requirements. Do not put credentials into committed configuration.
