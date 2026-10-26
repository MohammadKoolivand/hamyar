# Prioritized Engineering Roadmap

Baseline: commit `541ac2f1531686d1ade3cfa5503df90ae33526de`; clean working tree; origin https://github.com/MohammadKoolivand/hamyar.git. No push/merge/history changes authorized or performed.

## P0 — Data Integrity

Status: Completed

### Tasks

- [x] Inspect implementation and verify split-write, retry, completion/review race defects.
- [x] Real MongoDB replica-set transaction infrastructure; fail closed on standalone.
- [x] Atomic practice/evaluation/hint records and idempotency; serialize completion/review.
- [x] Explicit mission/assignment transitions and cancellation.
- [x] Security audit: origin/proxy, sessions, invites, logs, data exposure, proprietary fonts.
- [x] Failure injection, concurrency, restart/retry, state/isolation tests and existing E2E.

### Verification

- Tests run: typecheck, lint, production build, 20 unit/integration tests, 4 Chrome E2E; topology/state unit checks added and run separately.
- Results: PASS; isolated replica set on 27019; existing DB copied without mutating standalone source; read-only audit=0 mismatches.
- Remaining risks: actual OS/process kill was not injected; abort-at-write-boundary and lost-response/app-restart were tested. Replica-set deployment required; historical Git font exposure and verified licensing need owner action. Distributed proxy/rate-limit deployment remains P5.

## P1 — Extensible Evaluation

Status: Completed

### Tasks

- [x] Numeric tolerances/invalid input; bounded symbolic subset and rubric contracts.
- [x] Deterministic reference/adversarial tests, existing review flow.

### Verification

- Tests run: typecheck/lint/build; 28 unit/integration tests including 374 generated algebra comparisons, invalid/adversarial inputs and symbolic→review integration; 4 Chrome E2E including symbolic authoring.
- Results: PASS.
- Remaining risks: explicitly bounded polynomial/linear-real subset, not a universal CAS; unsupported syntax/domain/precision routes to teacher. No arbitrary model/code execution.

## P2 — Real Practice Assistant

Status: Completed

### Tasks

- [x] Provider/orchestrator, Ollama configuration, output validation, policy and failure tests.

### Verification

- Tests run: typecheck/lint/build; 36 unit/integration tests; real Ollama qwen2.5:3b two-request smoke (token counts 145/12 and 202/15); 4 browser E2E with locally configured Ollama.
- Results: PASS.
- Remaining risks: inference-assisted selection from teacher-approved text only, not free-form generated diagnosis. An unconstrained introductory selection was too advanced in the initial real-model smoke; the pre-attempt candidate pool is now enforced in code. Scientific quality still needs pilot validation. Provider outages are explicitly labeled fallback or unavailable.

## P3 — Learning Analytics

Status: Completed

### Tasks

- [x] Evidence, role-specific reports, persistent mistake notebook, transparent mastery and recommendations.

### Verification

- Tests run: typecheck/lint/build, 42 unit/integration tests, 4 browser E2E; additive rebuild of 20 legacy attempts and integrity audit.
- Results: PASS; 0 quota/evaluation mismatches. Teacher corrections and concurrent same-skill missions tested.
- Remaining risks: explainable mastery thresholds are provisional, not scientifically validated; descriptive trends do not establish causality.

## P4 — UI Architecture

Status: Completed

### Tasks

- [x] Incremental feature/component extraction, preserving input and RTL/mobile flows.

### Verification

- Tests run: typecheck/lint/build; 4 E2E including unsent draft navigation/reload, 360px overflow and keyboard focus. P3 backend suite remains 42 passing tests.
- Results: PASS; root component reduced from 1666 to 447 lines; existing JSX extracted, not rewritten.
- Remaining risks: content/mission forms still use controlled root state; future hooks may reduce prop plumbing. This is not a full WCAG audit.

## P5 — Pilot Readiness

Status: In Progress

### Tasks

- [x] Real backup/isolated restore drill with document/index equality and source verification.
- [x] Single-process rate-limit test; bounded loopback HTTP load smoke; runtime/AI-usage probe and sanitized error correlation.
- [x] Pilot target recorded: Iran, grades 1–12; three roles and parent-access revocation implemented in extension below.
- [x] HTTPS deployment template and operational runbook; deployment explicitly unverified.
- [ ] Guardian verification, age-appropriate consent/versioning/withdrawal flow, retention and deletion decision + implementation.
- [ ] Account recovery through a verified channel, teacher/student relationship revocation, deletion/anonymization with backup policy.
- [ ] Actual HTTPS host, shared edge limiting/monitoring alerts, classroom/inference load and external restore drill.
- [ ] Independent security/WCAG/browser/device and scientific content review.

### Verification

- Tests run: 125-request authenticated limiter test, 60 HTTP health requests/concurrency 10; real mongodump/mongorestore of 436 documents/22 collections, document/index hashes equal; source audit 0 quota/evaluation mismatches.
- Results: implemented technical slices pass. P5 is NOT completed and the product is not cleared for a real-child pilot.
- Remaining risks: invitation is a technical link, not legal guardian verification/consent. Country/grades supplied by owner; retention duration and responsible verification process remain undecided. No live deployment or scientific validation performed. See PILOT_READINESS.md.

## Owner extension — Human + AI question authoring

Status: In Progress

### Tasks

- [x] Separate real Ollama QuestionGenerator, bounded structured output and timeout; no runtime mock generation.
- [x] Persistent private queue; edit/reference correction, explicit teacher approval or reasoned rejection.
- [x] Atomic approved question/version/draft/audit and idempotent retry; manual question creation also transactional.
- [x] Structurally readable but invalid grading references remain flagged drafts; cannot enter bank before correction.
- [ ] Final real-model browser verification and final test result recorded.

### Verification

- Tests run: authoring integration/unit checks, genuine qwen2.5:3b generation in Chrome; final rerun in progress.
- Results: previous real-model test exposed an invalid numeric reference on a second generation; draft correction path implemented rather than bypassing grading validation.
- Remaining risks: output remains unverified educational material until human review; no automatic publishing or claim of scientific accuracy. Concurrent same-key inference can consume extra model work; educational drafts/versions remain unique.

## Owner extension — Parent portal and licensed local Persian font

Status: In Progress

### Tasks

- [x] Parent role/invite, per-parent/student/teacher link and read-only scoped analytics.
- [x] Teacher private notes/override reasons and unrelated relationships excluded; parent cannot submit answers/hints/reviews.
- [x] Parent access revocation, audit and pending invitation invalidation.
- [x] Licensed local IRANSans enabled outside Git, deterministic fallback in fresh checkouts; Poppins remains Latin font.
- [ ] Final integrated browser check: AI-approved question → student work → parent result → revoked access.

### Verification

- Tests run: real Mongo parent isolation/mutation/revocation checks; final cross-teacher/browser/font checks in progress.
- Results: implementation complete; final verification pending.
- Remaining risks: parent invitation is not guardian identity proof. Existing accounts are not rewritten; parent access is granted only for an explicit invitation/link.

## تکمیل مباحث متوسطه — درخواست 2026-10-24

Status: In Progress

### Tasks

- [x] بررسی ساختار موجود و ثبت baseline 81149f3؛ حفظ تغییرهای قبلی.
- [x] فهرست ۲۵ کتاب/بخش، ۱۲۴ فصل و ۴۳۱ مبحث؛ پوشش رشته‌های نظری و تفکیک فیزیک ریاضی/تجربی و بخش‌های علوم متوسطه اول.
- [x] UI فیلتر/مرور و واردسازی مالک‌محور، بدون تکرار/حذف/بازنویسی؛ اتصال به ورود دستی و AI authoring.
- [x] تست UUID/پوشش/مالکیت، تراکنش و rollback، retry/concurrency، ثبت سؤال و reload و regression جریان قبلی.
- [ ] تطبیق مستقیم با PDF رسمی چاپ هدف از chap.sch.ir؛ دسترسی مستقیم در این اجرا timeout/502 بود. منابع ثانویه و ۱۶ مورد در سطح فصل صریحاً علامت‌گذاری شده‌اند.

### Verification

- Tests run: typecheck/lint/build PASS؛ npm test: 63 PASS/0 fail/0 skip؛ پس از افزودن failure boundary، تست هدفمند 3 PASS؛ Chrome E2E catalog: 1 PASS و جریان اصلی موجود: 1 PASS.
- Results: برش اجرایی کار می‌کند؛ تطبیق رسمی چاپ جاری تکمیل نشده. docs/CURRICULUM_COVERAGE.md فهرست منابع/شمارش/محدودیت‌ها را ثبت می‌کند.
- Remaining risks: ریزفهرست رسمی در موارد chapter scope و تطبیق چاپ رسمی. محتوای قبلی معلم و مرجع سؤال‌ها محفوظ است؛ هیچ سؤال تولیدی به‌صورت خودکار منتشر نشده.

## انتخاب مرحله‌ای مبحث تولید سؤال

Status: Completed

### Tasks

- [x] جایگزینی dropdown بلند با پایه → رشته در صورت وجود → درس/کتاب → فصل → مبحث.
- [x] محدودکردن گزینه‌ها به مرحله قبلی، پاک‌کردن انتخاب‌های پایین‌دست و غیرفعال‌کردن تولید تا انتخاب مبحث.
- [x] حفظ ساختارهای شخصی بدون پایه/درس/فصل و حفظ brief هنگام تغییر انتخاب.

### Verification

- Tests run: typecheck/lint/build PASS؛ دو unit test و یک Chrome E2E PASS (6.0s).
- Results: شناسه واقعی topic در درخواست بررسی شد؛ تغییر فصل/پایه انتخاب قبلی را باطل می‌کند؛ مباحث شخصی و عرض موبایل بررسی شدند. در این E2E، پاسخ provider عمداً 503 شبیه‌سازی شد تا فقط قرارداد انتخاب و درخواست بررسی شود؛ inference واقعی در این تغییر اجرا نشد.
- Remaining risks: وضعیت بررسی منابع کاتالوگ تغییری نکرده است؛ هیچ تغییری به قرارداد backend یا ارزیابی وارد نشده.

### منابع رسمی متوسطه اول — ۲۰۲۶-۱۰-۲۵

- [x] دریافت ۱۲ PDF رسمی و ثبت منشأ/هش.
- [x] جداسازی کتاب عادی/سمپاد، افزودن علوم کامل و بخش‌های ریاضی تکمیلی.
- [x] فیلتر نوع کتاب با حفظ شناسه‌ها و داده خصوصی معلم.
- [x] آزمون ساختار، فصل صفر و تفاوت علوم نهم.
- [ ] استخراج و بازبینی ریزموضوع‌های علوم؛ فعلاً انتخاب کل فصل.
- [ ] تطبیق منابع متوسطه دوم با PDF رسمی چاپ جاری.

- [x] کنترل نهایی: TypeScript، Lint، Build، ۶۶ تست Unit/Integration و یک جریان Playwright موفق؛ جزئیات و محدودیت‌ها در QUALITY_REPORT.

### تطبیق رسمی متوسطه دوم — ۲۰۲۶-۱۰-۲۵

- [x] دریافت و ثبت ۱۹ PDF ارسالی با URL، کد، سال، صفحات مرجع و SHA-256.
- [x] تطبیق شش کتاب فیزیک و سیزده کتاب ریاضی؛ حفظ تفاوت رشته‌ها.
- [x] اصلاح سه عنوان با نگهداری هویت قبلی مبحث.
- [x] به‌روزرسانی تراکنشی منبع رسمی در ورود مجدد؛ حفظ ویرایش معلم و ارجاع سؤال.
- [x] تست ساختار، شناسه قدیمی، مهاجرت، rollback و مالکیت.
- [ ] استخراج و بازبینی ریزموضوع‌های علوم متوسطه اول (فعلاً کل فصل).

- [x] کنترل نهایی این مرحله: TypeScript، Lint، Build، ۶۷ تست Unit/Integration و یک تست مرورگر کاتالوگ موفق.

### مرتب‌سازی صفحه محتوا — ۲۰۲۶-۱۰-۲۵

- [x] تفکیک کارهای جانبی در بخش‌های بازشونده: کتاب‌ها، تولید AI و ساختار شخصی.
- [x] نمایش مستقل ثبت دستی و بانک سؤال، همراه با تعداد سؤال و مبحث.
- [x] جست‌وجوی بانک سؤال بر اساس متن/مبحث و جست‌وجوی ساختار؛ فهرست‌های بلند با ارتفاع محدود.
- [x] حالت خالی/بدون نتیجه، برچسب‌های فارسی و راهنماهای جایگزین بازشونده.
- [x] کنترل TypeScript و Lint؛ بررسی تصویر واقعی دسکتاپ.
- [x] تست مرورگر بخش‌های بسته، حفظ متن فرم، جست‌وجو، ورود کتاب، ذخیره سؤال و بازیابی آن.

- [x] تکمیل کنترل نهایی چیدمان: Build، ۶۷ تست Unit/Integration و چهار آزمون مرورگر مرتبط موفق؛ جزئیات در QUALITY_REPORT.

### AvvalAI برای تولید سؤال — ۲۰۲۶-۱۰-۲۵

- [x] آداپتور مستقل AvalAI Chat Completions با timeout، سقف پاسخ، اعتبارسنجی JSON و بدون fallback پنهان.
- [x] دریافت فهرست عمومی مدل‌های chat با کش پنج‌دقیقه‌ای؛ اعتبارسنجی مدل سمت سرور.
- [x] صفحه /settings، انتخاب مدل مستقل هر معلم در MongoDB و نمایش مدل در تولید سؤال.
- [x] استفاده واقعی از مدل ذخیره‌شده در درخواست بعدی و ثبت منشأ/usage در پیش‌نویس.
- [x] حفظ تأیید معلم، ایزولیشن حساب‌ها و replay درخواست قبلی با مدل قبلی.
- [x] آزمون تولید واقعی با کلید محیط سرور و gpt-4o-mini: پیش‌نویس معتبر در MongoDB آزمایشی، بدون تغییر بانک سؤال؛ دیتابیس آزمایشی پس از تست پاک شد.

- [x] کنترل نهایی: ۷۲ تست کامل + ۵ تست هدفمند پس از اصلاح داده API، Build/Lint/TypeScript و دو جریان مرورگر مرتبط موفق.

- [x] اجرای نهایی ۷۳ تست موفق و smoke واقعی gpt-4o-mini با پیش‌نویس معتبر؛ ساخت نهایی و سرور توسعه فعال‌اند.

### سؤال دارای نمودار، شکل و فرمول — ۲۰۲۶-۱۰-۲۵

- [x] مدل داده محدود و نسخه‌پذیر برای نمودار خطی، شکل هندسی/پیکان و فرمول LaTeX؛ حداکثر سه محتوا.
- [x] انتخاب نوع محتوا در تولید AI و الزام حضور آن پیش از تأیید؛ بدون جایگزینی شکل با متن توصیفی.
- [x] پیش‌نمایش دانش‌آموز، ویرایش نقاط/محورها/اجزای شکل/فرمول و پشتیبانی ثبت دستی.
- [x] ذخیره در questionVersions و انتقال همان داده به مأموریت/نمای تمرین؛ پاسخ مرجع در projection عمومی نیست.
- [x] رسم SVG از داده، نمایش MathML با KaTeX و محدودسازی HTML/URL/ماکرو و ابعاد/تعداد اجزا.
- [x] TypeScript، Lint، Build، ۷۶ تست واحد/یکپارچه و دو تست مرورگر مرتبط موفق.
- [x] تست واقعی AvvalAI برای نمودار، فرمول و شکل؛ خروجی هندسی نامعتبر در تلاش اول رد شد و تلاش بعدی معتبر بود.
- [ ] توسعه بعدی: نمودار میله‌ای/دایره‌ای، ترسیم تحلیلی توابع، اشکال تخصصی مدار/فنر و بارگذاری تصویر؛ فعلاً پشتیبانی نمی‌شوند.

### پژوهش دسته‌بندی منابع بانک سؤال ایران

- [x] بررسی آرشیوهای konkur.in و تفکیک خانواده آزمون، مرحله، سطح برگزاری، سال، نوبت و برگزارکننده.
- [x] ثبت طرح هشت نمای کاربردی و ابعاد مستقل داده در QUESTION_BANK_TAXONOMY.md.
- [ ] پیاده‌سازی مجموعه/دفترچه آزمون، مشخصات منبع و فیلترهای بانک سؤال.
- [ ] ورود آزمایشی یک مجموعه واقعی، تفکیک سؤال‌ها و بازبینی پاسخ/رسانه؛ هنوز سؤالی از این سایت وارد نشده است.

### جایگزینی فهرست‌های بلند با انتخاب مرحله‌ای — ۲۰۲۶-۱۰-۲۵

- [x] انتخاب مبحث مشترک در تولید AI و ثبت دستی: پایه ← رشته در صورت وجود ← کتاب/درس ← فصل ← مبحث.
- [x] والد ساختار از مسیر درختی پویا انتخاب می‌شود؛ هر دراپ‌دان فقط فرزندان سطح قبلی را دارد.
- [x] انتخاب مدل: ارائه‌دهنده ← مدل؛ حذف فیلد جست‌وجوی مدل و فهرست یک‌جای همه مدل‌ها.
- [x] پاک‌شدن مراحل پایین‌تر هنگام تغییر انتخاب و حفظ انتخاب موجود هنگام بازکردن دوباره صفحه.
- [x] محدودسازی مهارت‌های فرم به مبحث/اجداد مرتبط و مهارت‌های عمومی؛ پاک‌شدن مهارت انتخابی با تغییر مبحث.
- [x] ۷۷ تست Unit/Integration و چهار جریان مرورگر مرتبط موفق؛ بررسی تصویر واقعی چیدمان انجام شد.

## بانک سؤال به‌عنوان صفحه اصلی محتوا — ۲۰۲۶-۱۰-۲۵

- [x] جداسازی بانک `/content`، افزودن `/content-new` و منابع مشترک `/resources`؛ لینک و مسیر مستقیم واقعی.
- [x] فیلترهای متن، پایه، رشته، کتاب، فصل، مبحث، سختی، سال، روش پاسخ و دسته سؤال؛ پاک‌سازی وابسته انتخاب‌ها.
- [x] ثبت مبحثی، آزاد و تولید/بازبینی AI در صفحه افزودن؛ حفظ نمودار، شکل، فرمول، ارزیاب و راهنماها.
- [x] ذخیره و اعتبارسنجی سختی و سال شمسی در نسخه سؤال؛ سازگاری با سؤال‌های قدیمی با مقدار «تعیین نشده».
- [x] سؤال آزاد بدون topicId ساختگی؛ جلوگیری از ارسال همزمان مبحث/مهارت برای سؤال آزاد.
- [x] تأیید نهایی TypeScript، Lint، Build، ۷۸ تست واحد/یکپارچه و ۷ جریان مرورگر جدید و قبلی.

## نمایش و ثبت دسته‌بندی آزمون‌ها — ۲۰۲۶-۱۰-۲۵

- [x] هشت ورودی واقعی دسته‌بندی در بالای بانک، با تعداد سؤال و زیر‌فیلتر اختصاصی؛ فیلتر ترکیبی با پایه، فصل، سختی و سال.
- [x] منبع و نوع آزمون در ثبت دستی/آزاد و بازبینی پیش‌نویس AI؛ پاک‌شدن مشخصات دسته قبلی هنگام تغییر دسته.
- [x] نگهداری family/administration مستقل برای جداسازی نهایی از هماهنگ کشوری؛ مشخصات گروه، نوبت، مدرسه، مؤسسه، مرحله و دفترچه.
- [x] ذخیره در نسخه ثابت MongoDB با اعتبارسنجی Backend و سازگاری با داده قدیمی بدون دسته.
- [x] کنترل نهایی TypeScript، Lint، Build، ۸۰ تست واحد/یکپارچه و دو جریان مرورگر.

## تکمیل ورود آزمون PDF — ۲۰۲۶-۱۰-۲۵

- [x] جایگزینی پیش‌نمایش محلی با آزمون ذخیره‌شده، تاریخچه خصوصی و ادامه پس از reload.
- [x] آپلود/دانلود PDF تا ۲۰ مگابایت؛ فایل باینری در قطعات MongoDB و هش SHA-256، احراز مالک قبل از دریافت بدنه بزرگ.
- [x] استخراج متن واقعی با pdftotext محلی، پاسخ‌نامه جداگانه، تقسیم اولیه غیرقطعی و مسیر دستی برای OCR/استخراج ناموفق.
- [x] ذخیره اصلاحات پیش‌نویس، انتخاب نوع پاسخ/سختی/مبحث و رسانه‌ها، تأیید/رد انسانی و ثبت اتمیک نسخه سؤال با منبع آزمون.
- [x] کنترل تکرار درخواست‌ها، رد تعویض فایل پس از پردازش، مجوز مالک و جلوگیری از تأیید دوباره.
- [x] TypeScript، Lint و Production Build موفق؛ ۸۴ تست مجموعه کامل، سه بازآزمایی مرتبط و جریان مرورگر واقعی موفق.

## ورود واقعی کنکور ریاضی ۱۴۰۵ بنا به درخواست کاربر

- [x] دریافت PDF سؤال و کلید ارائه‌شده؛ بررسی اصل صفحات و کدهای 121A/122A.
- [x] تعیین شمارش دقیق ۱۰۵ سؤال (۴۰ ریاضی، ۳۵ فیزیک، ۳۰ شیمی)؛ عدم ورود کلیدهای ۱۰۶..۱۴۵ بدون سؤال.
- [x] افزودن تصویر اصل سؤال با asset خصوصی و مجوز جداگانه برای دانش‌آموز تخصیص‌داده‌شده؛ حفظ شکل و نمادهای علمی.
- [x] آماده‌سازی ۸ سؤال منتخب با متن بازخوانی‌شده، راهنما و مهارت؛ بقیه بدون نگاشت حدسی به مهارت.
- [x] ثبت پایدار در حساب معلم اصلی؛ کنترل ۱۰۵ کلید و ۱۰۵ تصویر، صفر تکرار و صفر تلاش روی سؤال‌های واردشده.
- [x] نمایش تصاویر و راهنمای واقعی Ollama در حساب QA با ورود عادی، تفکیک مستقل/با راهنما، موبایل و Build نهایی موفق؛ ۸۵ تست و تست مجدد ترتیب مأموریت پاس شدند.

## ویرایش سؤال — ۲۰۲۶/۱۰/۲۵

- [x] دریافت خصوصی سؤال و API نسخه‌دار با کنترل همزمانی، تراکنش، audit و idempotency.
- [x] نمایش تنها نسخهٔ جاری در بانک، حفظ سؤال و گزارش مأموریت‌های قبلی.
- [x] دکمهٔ ویرایش هر کارت؛ فرم متن، گزینه‌ها، پاسخ صحیح، سختی، سال و راهنماهای موجود؛ حفظ سایر تنظیمات ارزیابی.
- [x] برش غیرمخرب تصویر با مختصات درصدی و پیش‌نمایش، بازگردانی اصل و رندر مشترک دانش‌آموز.
- [x] TypeScript، Lint و ۸۷ تست واحد/یکپارچه موفق.
- [x] تست مرورگر با ثبت‌نام/ورود عادی حساب آزمایشی، ذخیره و بازخوانی متن/گزینه/سختی/برش موفق؛ ساخت Production با Webpack موفق و سرور ۵۱۷۴ فعال.

## کراپ تعاملی تصویر

- [x] دکمهٔ آیکون کراپ روی تصویر کارت بانک، ورود مستقیم به ابزار برش.
- [x] انتخاب محدوده روی عکس اصلی با Pointer Events برای ماوس و لمس، نمایش محدوده و سایهٔ بیرون آن.
- [x] اعمال/انصراف، بازگردانی تصویر کامل و تنظیم دقیق عددی؛ ذخیره با نسخهٔ جدید سؤال.
- [x] TypeScript و Lint موفق.
- [x] ساخت Webpack موفق؛ تست مرورگر انتخاب محدوده، ذخیره، بازخوانی و انصراف موفق.

## انتخاب مستقیم گزینه در تمرین

- [x] حذف dropdown پاسخ چندگزینه‌ای و تبدیل کارت گزینه‌ها به radio بومی قابل کلیک/کیبورد.
- [x] حالت انتخاب با border آبی روشن، پس‌زمینهٔ شیشه‌ای و focus قابل مشاهده؛ حفظ draft قبلی و ثبت نهایی با همان API.
- [x] TypeScript و Lint موفق.

## رفع قفل انتخاب/عبور و راهنمای AvvalAI

- [x] انتخاب گزینه بعد از پایان سهمیه برای مرور آزاد است؛ ثبت تلاش اضافه طبق سیاست معلم بسته می‌ماند و توضیح فارسی نمایش داده می‌شود.
- [x] دکمهٔ مستقیم «رد کردن و سؤال بعدی» کنار ثبت پاسخ، بدون ایجاد پاسخ/تلاش جعلی؛ حفظ پیش‌نویس هنگام بازگشت.
- [x] AvvalAI از مدل معلم در aiSettings برای انتخاب راهنمای تأییدشده استفاده می‌کند؛ خطای سرویس سهمیه را مصرف نمی‌کند و fallback مخفی ندارد.
- [x] ثبت provider/model/usage و نمایش برچسب درست در رابط؛ راهنماهای قدیمی تاریخچهٔ واقعی خود را حفظ می‌کنند.
- [x] TypeScript، Lint، Build با Webpack و ۸۸ تست موفق.
- [x] درخواست واقعی AvvalAI با مدل gpt-5.4-mini در fixture آزمایشی: HTTP 200، یک hintEvent ثبت شد؛ دادهٔ حساب اصلی تغییر نکرد.
- [x] تست مرورگر کلیک کارت، انتخاب پس از پایان سهمیه، ممنوعیت ثبت اضافه، عبور و بازگشت با حفظ draft موفق.

## ساده‌سازی صفحه تمرین بنا به بازخورد کاربر

- [x] حذف دکمهٔ عبور تکراری؛ پیمایش فقط با قبلی/بعدی، بدون الزام ثبت پاسخ.
- [x] جداسازی ثبت پاسخ/راهنمایی از نوار پیمایش؛ پایان تمرین به کنش متنی کم‌تأکید تبدیل شد.
- [x] کارت‌های پاسخ جمع‌وجور و دو ستونه در عرض مناسب؛ حالت انتخاب آبی و ورودی کیبورد حفظ شد.
- [x] TypeScript و Lint موفق؛ تست‌های مربوط به نام کنش‌ها به‌روز شدند.
- [x] Build Webpack و تست مرورگر انتخاب، ثبت، عبور/برگشت و نبود کنش تکراری موفق.

## ثبت خودکار و زمان نمایش نتیجه — بازخورد کاربر

- [x] بازتولید خطای واقعی: انتخاب گزینه فقط draft بود؛ «بعدی» و پایان تمرین آن را به سرور نمی‌فرستادند.
- [x] ذخیرهٔ پاسخ با قبلی/بعدی و پایان؛ flush پیش‌نویس‌های قدیمی باقی‌مانده در همهٔ سؤال‌ها، کنترل سهمیه/تکرار از وضعیت تازهٔ سرور، ماندن در صفحه هنگام خطا.
- [x] بازیابی پاسخ ثبت‌شده در برگشت/بارگذاری مجدد؛ draft و پاسخ سرور از هم تفکیک شدند؛ پایان بدون پاسخ، کاربر را به اولین سؤال خالی می‌برد.
- [x] انتخاب معلم «بعد از هر پاسخ / در پایان همه سؤال‌ها» برای مأموریت فردی و گروهی؛ پیش‌فرض UI جدید پایان، پیش‌فرض مأموریت‌های قدیمی همان فوری.
- [x] در حالت پایان، محافظت سرور در پاسخ ثبت، دریافت مأموریت، گزارش، داشبورد دانش‌آموز و تحلیل یادگیری؛ دسترسی معلم برای بررسی حفظ می‌شود.
- [x] ۸۹ تست واحد/یکپارچه، TypeScript، Lint و Build Webpack موفق؛ سه مسیر مرورگر immediate/end و legacy-drafts فقط با انتخاب+بعدی+پایان موفق.

## گزارش سؤال‌به‌سؤال و نمای یادگیری

- [x] گزارش مبتنی بر تمام نسخه‌های مأموریت به ترتیب اصلی، همراه تصویر/فرمول، پاسخ انتخابی، پاسخ صحیح پس از پایان، وضعیت و تحلیل مبتنی بر شواهد.
- [x] سبز صحیح، قرمز نادرست/ناقص، زرد نزده، بنفش نامطمئن؛ نقشه سؤال‌ها، فیلتر، آمار و تحلیل تفکیک‌شدهٔ مبحث و استقلال/کمک.
- [x] سؤال نزده بدون ساخت تلاش جعلی؛ پایان ناقص فقط با تأیید صریح کاربر و allowUnanswered در API. محافظت کلید تا پایان برای دانش‌آموز حفظ شد.
- [x] یادگیری: کارت‌های آماری رنگی، اولویت مرور، نسبت واقعی حل مستقل هر مهارت، فیلتر مهارت‌ها و لینک گزارش تمرین‌های اخیر؛ عدم ادعای تشخیص علت خطا از روی گزینه.
- [x] حفظ بازبینی معلم و گزارش راهنمای نامناسب؛ جلوگیری از نشت رکورد اشتباه مأموریت با نتیجهٔ مخفی.
- [x] ۹۰ تست کامل و دو تست اختصاصی گزارش (شامل پایان کاملاً بدون پاسخ) موفق؛ TypeScript و Lint موفق.
- [x] Build نهایی، چهار سناریوی مرورگر، تست رنگ‌ها و فیلتر/مهارت واقعی و بازبینی اسکرین‌شات گزارش/یادگیری موفق.

## پس‌زمینه شیشه‌ای گزارش

- [x] حذف پس‌زمینه رنگی بر اساس نتیجه از بدنه کارت سؤال؛ گرادیان سفید/آبی روشن با blur و حاشیه آبی ملایم مطابق مرجع.
- [x] حفظ رنگ نتیجه در badge و گزینه‌های پاسخ؛ متن تحلیل به رنگ خنثی خوانا برگشت.
- [x] TypeScript و Lint موفق؛ assertionهای قبلیِ رنگ تمام کارت با سبک جدید هماهنگ شدند.

## نمونهٔ واقعی برای دسته‌های بانک سؤال — ۲۰۲۶/۱۰/۲۵

- [x] بررسی اصل فایل‌ها و پاسخ‌ها در konkur.in؛ ثبت شش نمونه و حفظ ۱۰۵ کنکور موجود؛ مجموع ۱۱۱.
- [x] تاریخ انتشار جدا از آزمون، صفحه و پیوند منبع، تصویر خصوصی و هش شواهد؛ خالی‌ماندن داده‌های نامشخص.
- [x] importer محلی با dry-run، تراکنش، کنترل مالک و جلوگیری از ورود تکراری؛ دو تست اختصاصی و ۹۳ تست کامل موفق.
- [x] گزارش منشأ و محدودیت‌ها در `CATEGORY_SAMPLES.md`؛ نمونهٔ داخلی مدرسه تأیید نشد و ساختگی وارد نشد.
- [x] TypeScript، ESLint، Build تولید/PWA و تست مرورگر دسته‌ها و متادیتای منبع با ورود عادی موفق؛ سرور محلی دوباره آماده است.

## صفحه‌بندی و انتخاب مجموعه سؤال — ۲۰۲۶/۱۰/۲۵

- [x] جزء مشترک PagedList با ۱۰ مورد در صفحه، شماره صفحه، قبل/بعد، شمارش و بازگشت به صفحه اول هنگام تغییر نتایج.
- [x] QuestionPicker مشترک مأموریت فردی/گروهی: فیلتر دسته، نوع، مجموعه و جست‌وجو؛ انتخاب پایدار بین صفحه‌ها؛ افزودن همه نتایج فیلترشده با حذف تکرار؛ پاک‌کردن انتخاب‌ها.
- [x] مشاهده هر سؤال در dialog واقعی با متن/فرمول/تصویر و گزینه‌ها، Escape، مدیریت فوکوس مرورگر و افزودن/حذف از همان پنجره.
- [x] سقف مشترک سرور/رابط مأموریت از ۳۰ به ۵۰۰ رسید؛ انتخاب بیش‌ازحد خطای روشن دارد و هیچ truncation انجام نمی‌شود. سقف اختصاصی تمرین تقویتی تغییر نکرد.
- [x] صفحه‌بندی فهرست‌های مأموریت، پیش‌نویس، بانک، آزمون/PDF، منابع و کتاب‌ها، درس/عضویت/درخواست، کلاس/اعضا/گزارش، دانش‌آموز/اولیا، گزارش سؤال، مهارت/اشتباه/مرور/روند یادگیری و فرزندان.
- [x] تست واحد/یکپارچه: ۹۴ موفق؛ ثبت و تخصیص تمام ۳۵ سؤال، کنترل تکرار و سقف جدید. تست مرورگر انتخاب مجموعه و دسته‌بندی: دو سناریو موفق؛ کنترل نهایی نسخه تولید در QUALITY_REPORT.
- نکته معماری: این مرحله صفحه‌بندی نمایش داده‌های دریافت‌شده است؛ قرارداد API هنوز فهرست کامل مجاز را برمی‌گرداند. صفحه‌بندی سمت دیتابیس برای بانک‌های بسیار بزرگ کار جداگانه است؛ dropdownهای انتخابی و خلاصه‌های از قبل محدودشده صفحه‌بندی نشده‌اند.

## پنج نقش و کنترل دسترسی — ۲۰۲۶/۱۰/۲۶

- [x] سیاست مرکزی مسیرها با منع پیش‌فرض؛ حفظ کنترل مالکیت و رابطهٔ آموزشی.
- [x] نقش‌های دانش‌آموز، معلم، والدین، سوپرادمین و منشی با پنل مناسب؛ حوزه و سه مجوز مستقل برای منشی.
- [x] مدیریت کاربران، تغییر نقش، غیرفعال‌سازی، ابطال نشست و رخدادهای مدیریتی؛ راه‌اندازی امن اولین مدیر با فرمان اپراتور.
- [x] ۱۰۱ تست کامل موفق؛ دو تست یکپارچهٔ نقش‌ها پس از اصلاح حفظ خروج/لغو عضویت معلم دوباره موفق.
- [x] TypeScript، Lint و Build تولید موفق؛ تست مرورگر ساخت منشی، واگذاری حوزه، دعوت، منع دسترسی و نمای موبایل موفق.
- [x] مستندات ماتریس نقش‌ها و محدودیت‌ها در ACCESS_CONTROL.md؛ حساب واقعی بدون درخواست ارتقا داده نشد.

## دعوت موبایلی و سختی سؤال — ۲۰۲۶/۱۰/۲۶

- [x] فرم دعوت معلم، اولیا و منشی موبایلی؛ پذیرش، ورود، یکسان‌سازی و اتصال حساب موجود با کنترل سرور؛ سازگاری دعوت قدیمی.
- [x] ۱۰۳ تست کامل مربوط به دعوت موبایلی موفق؛ تست مرورگر پذیرش و ورود موبایلی موفق.
- [x] برآورد شفاف سختی ۳۵۷ نسخه فاقد سطح؛ حفظ سختی قبلی و برچسب نیازمند بررسی، مستند در DIFFICULTY.md.
- [x] تعیین گروهی سختی نتایج فیلترشده، انتخاب تعداد/سختی از بانک در انتخاب‌گر مشترک و تولید ۱ تا ۵ پیش‌نویس AI با سطح هدف.
- [x] تست یکپارچه انتخاب دقیق ۲۰ سؤال، ساخت و انتشار، کمبود بانک، سختی گروهی و مالکیت موفق؛ Build موفق.
- [x] تست مرورگر انتخاب ۲۰ سؤال و تغییر گروهی سختی موفق؛ TypeScript و Lint نهایی موفق.

## ممیزی و انتشار MVP هدهده — ۲۰۲۶/۱۰/۲۶

- [x] کشف فقط‌خواندنی main و معماری، ماتریس شواهد و مرز MVP در MVP_AUDIT.
- [x] رفع OCR anchor کاذب بدون تغییر assertion اسکن؛ benchmark FP/FN و محدودیت واقعی mixed ثبت شد.
- [x] رفع رقابت ورود/reset، لینک hash در همان تب، DOM انتخاب فرزند، تصاویر مرتبط والد، headerها و برند.
- [x] ایزوله‌سازی E2E، رگرسیون نقش/بازیابی، سیاست بازخورد صریح معلم، همه صفحات در چهار عرض و اصلاح fallback Linux.
- [x] ۱۱۶ تست backend موفق، ۲۹ E2E موفق با یک skip اختیاری، همان سناریو با Ollama واقعی جدا موفق؛ catalog واقعی AvvalAI موفق.
- [x] مانور backup/restore فقط روی داده مصنوعی؛ HTTP و worker راه‌اندازی مجدد؛ بازیابی خطای شبکه worker با سه تست.
- [x] CI کد UI روی 13f3218 سبز، branch اضافه و PR باز صفر؛ push معمولی commitهای منطقی. گیت commit نهایی از Actions قابل بررسی است.
- [x] مستندات MVP_TEST_REPORT، MVP_RELEASE_READINESS و MVP_REMAINING_WORK؛ محدودیت‌های خارجی و استقرار عمومی صریح.

## ادامهٔ سخت‌سازی حساب و تحویل ایمیل (۲۰۲۶/۱۰/۲۶)

- [x] خواندن وضعیت main، کد موجود reset/session، مستندات و CI قبلی.
- [x] صف MongoDB تراکنشی و AES-GCM، worker مستقل، lease/retry/expiry و عدم افشای token.
- [x] تأیید مالکیت ایمیل، درخواست مجدد محدود، تغییر ایمیل با رمز جاری و ابطال نشست‌ها.
- [x] بازیابی فقط از ایمیل تأییدشده؛ نمایش truthful برای emailVerified/phoneVerified.
- [x] صفحهٔ مستقل تأیید و تغییر ایمیل، لینک ورود، تست UI و backend نوشته شد.
- [x] گیت محلی کامل: ۱۲۳ backend و ۳۱ مرورگر موفق، یک skip قدیمی اختیاری؛ CI همین commit در انتظار push.
- [ ] consent/revocation، درخواست حذف/اجرای بررسی‌شده و retention قابل تنظیم.
- [x] SMS adapter ملی‌پیامک، HMAC، throttling پایدار، تأیید تراکنشی و رابط شماره/OTP بدون کد ساختگی؛ ارسال واقعی منتظر تنظیم پنل.
- [ ] fixture/benchmark گسترده‌تر OCR، عملیات backup/monitoring/DR.
- [ ] Inbox واقعی، AvvalAI پولی با بودجه و تصمیم‌های حقوقی/میزبانی مالک.

## Feature Freeze — پایدارسازی نهایی

- [x] دریافت main، تطبیق CI مبنا، بررسی قراردادها، نقش‌ها، صف‌ها و تنظیمات؛ قابلیت جدید افزوده نشد.
- [x] بازتولید و اصلاح محدود نشست معلق در چرخه تغییر نقش مدیر؛ تست رگرسیون.
- [x] بازتولید و اصلاح TTL اطلاعات موقت OTP؛ تست index روی DB آزمایشی.
- [x] گیت محلی: npm ci، TypeScript، ESLint، Build، ۱۲۵ backend (۴۴ واحد/۸۱ یکپارچه)، ۳۱ E2E موفق و یک skip قدیمی.
- [x] بررسی چهار عرض، سازگاری داده، OCR، Ollama محلی و backup/restore مصنوعی؛ گزارش شکست اولیه MongoDB حفظ شد.
- [x] گزارش نهایی و checklist فنی/عملیاتی در سند معادل موجود MVP_RELEASE_READINESS؛ سرویس‌های واقعی و سیاست کودک به‌جای Feature تازه، blocker ثبت شدند.
- [x] commitهای منطقی و تحویل main؛ نتیجهٔ CI نهایی از workflow آخرین main بررسی و در پاسخ تحویل اعلام می‌شود.

## اصلاح مأموریت و ورود فایل — درخواست مستقیم ۲۰۲۶/۱۰/۲۷

- [x] نمایش سختی فعلی با گیج عقربه‌ای در بانک و انتخاب سؤال، بدون ادعای سختی آماری.
- [x] فیلتر چندانتخابی دسته، نوع و مجموعه/منبع؛ اجتماع داخل هر فیلتر و اشتراک میان فیلترها.
- [x] پنجره انتخاب خودکار با سهمیه جداگانه آسان/متوسط/سخت؛ شمارش و ظرفیت از سرور و حفظ قرارداد قدیمی.
- [x] ورود PDF/PNG/JPEG/WebP از داخل مأموریت با مسیر استخراج و بازبینی موجود؛ افزودن فقط نسخه‌های تأییدشده و حفظ فرم مأموریت.
- [x] فرم کوتاه ورود آزمون با درس/پایه/رشته/سال انتخابی، عنوان خودکار و جزئیات اختیاری.
- [x] رگرسیون API انتخاب ترکیبی، امنیت بارگذاری و PDF حاصل از تصویر؛ ۱۳۰ تست backend موفق.
- [x] تست مرورگر ترکیب/چندانتخابی و PDF و تصویر→OCR→ویرایش→تأیید→مأموریت؛ چهار تست مرتبط موفق.
- [ ] CI آخرین commit پس از push؛ نتیجه در گزارش تحویل.
