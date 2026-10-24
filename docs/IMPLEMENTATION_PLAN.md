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
