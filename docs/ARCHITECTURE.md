# معماری و تصمیم‌ها

مرجع: PRD.fa.md نسخه ۲؛ وضعیت اجرای اولویت‌های مهندسی در IMPLEMENTATION_PLAN.md ثبت می‌شود.

## ابهام‌ها و حل موقت

- «همه دروس» دامنه مدل داده است؛ اعتبار ارزیابی همه دروس ادعا نمی‌شود. نوع عددی، انتخابی، متن کوتاه دقیق و تشریحی انسانی در برش اول.
- فرمول شاخص فصل ۱۲ با «تعداد پاسخ صحیح» اشتباه نشود: صورت و مخرج فقط اولین تلاش ارزیابی‌شده هر سؤال؛ پاسخ درست پس از کمک جدا گزارش می‌شود.
- پایان مأموریت و پایان ارزیابی جدا هستند: submitted در حضور pending review؛ completed پس از بررسی همه.
- برند نهایی هدهده؛ نام فنی hamyar برای سازگاری حفظ می‌شود؛ ورود اصلی شماره/OTP ملی‌پیامک و ورود رمز حساب‌های قدیمی وجود دارند؛ دعوت زمان‌دار را معلم منتقل می‌کند. تأیید/بازیابی ایمیل از outbox رمزگذاری‌شده و worker مستقل استفاده می‌کنند؛ ارسال واقعی نیازمند تنظیم سرویس است.
- حداقل سن و رضایت سرپرست تعیین نشده: انتشار برای افراد کم‌سن تا طراحی و تأیید رضایت مسدود است؛ توسعه محلی داده واقعی کودک نیاز ندارد.
- زمان نگهداری، حذف حساب، لغو ارتباط و محل میزبانی باید پیش از پایلوت تصمیم و اجرا شوند.
- دفترچه خطای پایدار و قواعد اولیه mastery پیاده شده؛ سنجش ضمیمه مستقل هنوز پیاده نشده است.
- محتوای معلم خصوصی و تأییدشده توسط خود او؛ بانک عمومی و ۶۰ سؤال علمی هنوز آماده نیست.

## ساختار

پروژه واحد Next.js App Router در ریشه مخزن است. `src/app` شامل صفحه‌ها و Route Handler است؛ `src/components` رابط، `src/server` منطق سمت سرور و `src/lib` نوع‌های مشترک را نگه می‌دارند. لایه سرور یک Modular Monolith با ماژول‌های identity/content/missions/practice/analytics و MongoDB است. ماژول‌های Fastify در همان پردازش Next با inject اجرا می‌شوند و listener جدا ندارند. evaluator registry مستقل از درس است؛ موتور نمادین محدود با ارجاع موارد پشتیبانی‌نشده به معلم اضافه شده است.

تمام استایل رابط کلاس Tailwind در JSX است؛ globals.css فقط import خود Tailwind را دارد. Poppins با مجوز OFL ارائه می‌شود؛ IRANSans دارای لایسنس اعلام‌شده مالک در build توسعه این دستگاه فعال است؛ checkout فاقد فایل مجاز از fallback استفاده می‌کند.

MongoDB منبع حقیقت است. هیچ fallback حافظه‌ای برای runtime وجود ندارد. تلاش، ارزیابی، شواهد و شمارنده در یک تراکنش replica set ثبت می‌شوند؛ ورودی خارج از دامنه ارزیاب برای بررسی معلم علامت می‌خورد. نشست cookie HttpOnly، SameSite=Strict و Secure در production؛ Origin در درخواست تغییر کنترل می‌شود. hash رمز scrypt و token تصادفی با hash در DB؛ rate limit ورود و API.

AI Provider ورودی فاقد جواب مرجع دریافت می‌کند. Mock فقط hint تأییدشده را بازمی‌گرداند. UI نام mock را آشکار می‌کند. Ollama واقعی قابل تنظیم و تعویض provider با injection است؛ adapter ابری AvvalAI اضافه شده؛ وضعیت آزمون واقعی آن در گزارش انتشار ثبت می‌شود. گزارش قاعده‌محور به شناسه تلاش و سؤال متصل است، بدون ادعای تشخیص مفهومی.

## مرز عرضه

TLS/reverse proxy، backup/restore، رضایت کودک، حذف داده، بررسی دسترس‌پذیری و تست بار قبل از عرضه لازم‌اند. PWA فقط shell و assetهای عمومی را cache می‌کند؛ API خصوصی offline cache نمی‌شود. ارسال پاسخ آفلاین پشتیبانی نمی‌شود.

## یکپارچه‌سازی تمام‌استک

`src/server/backend.ts` اتصال MongoDB و برنامه داخلی را به‌صورت singleton هر پردازش نگه می‌دارد؛ `src/app/api/[...path]/route.ts` ورودی HTTP و Set-Cookie را به ماژول‌های موجود تطبیق می‌دهد. runtime برابر nodejs و cache API برابر private/no-store است. secrets فقط در سرور و MongoDB باقی می‌مانند. ورودی قدیمی مستقل سرور حذف شده است؛ برنامه فقط با npm run dev یا npm start اجرا می‌شود.

## P0: transactional write model

MongoDB replica set (or sharded deployment) is required and verified with hello before serving. Standalone deployments fail closed. Practice counter, attempt, evaluation, mission state and idempotency response commit in one snapshot/majority transaction. Hint generation occurs outside the transaction; approved output and quota/event commit together. No quota is reserved while inference fails.

Every practice/completion/review/cancellation writer updates the assignment document, providing a shared conflict/serialization point. Driver withTransaction retries transient transaction conflicts and uncertain commits. An operations record scoped by actor + resource/action + Idempotency-Key stores the committed response and request digest; reuse with changed content returns 409. Responses lost after commit replay from durable storage. Keys have no automatic TTL pending retention policy. Requests without a key remain distinct intents for API compatibility.

The browser stores only digest/key metadata for retry, and passes expectedAttempt/expectedHintLevel. An acknowledged mutation whose refresh fails is replayed until UI advances its confirmed counters. No password or answer is stored by this retry mechanism. Existing answer drafts remain unchanged.

State: draft → published → in_progress → submitted/completed; submitted → completed after all required reviews. Nonterminal states may cancel; completed/cancelled reject new writes. Repeat publish/complete/cancel are safe but never reopen a terminal assignment. Parent mission and assignment state are updated in the same transaction.

Invite acceptance and publication also use transactions. Teacher review, history, audit, assignment and parent state commit together. Failure hooks are dependency-injected in tests only; no HTTP failure switch exists.

Security: browser mutations require exact configured APP_ORIGIN (scheme/host/port), reject cross-site Fetch Metadata and do not trust Host/forwarded headers to select an allowed origin. Absent Origin remains supported for nonbrowser API clients. Production nonlocal origin requires HTTPS; HTTPS sessions are Secure even without an opt-in flag. Logs omit query strings, cookies and bodies. Unauthenticated clients behind the Next adapter intentionally share a conservative local-IP limiter until an explicitly trusted proxy design is deployed.

IRANSans lacked redistribution evidence and is excluded from tracked source/public builds; the user's original local file is preserved under ignored .private/fonts. Earlier Git history still contains it; no history rewrite or push was performed. Licensed webfont restoration and any repository-history cleanup require owner action/evidence.

## P1: evaluator registry and explicit supported mathematics

Registry in server/evaluation preserves domain evaluate() compatibility. Each outcome includes result/method/requiresTeacherReview/explanation/evidence/evaluatorVersion, attached to the immutable question version and attempt. Numeric normalization accepts Persian/Arabic digits and Unicode minus; strict decimal/scientific syntax rejects hex, NaN, infinity and trailing data. Threshold is max(absTolerance, relativeTolerance*abs(reference)); unsafe numeric magnitudes require human review.

Symbolic grading uses mathjs only to parse a bounded AST, never compile/evaluate user code. A separate exact BigInt-rational polynomial reduction proves equality over explicitly declared real variables. Supported subset: at most 3 variables, 256 input characters, 96 AST nodes, degree 4, 64 terms, constant nonzero denominators and bounded literals/coefficients. Equations are linear only and compared by proportional normalized affine coefficients. Functions, accessors, assignments, variable denominators, nonlinear equations, ambiguous/invalid syntax and unsupported domains return pending_review, not an unsupported-as-incorrect result. Zero powers with potentially zero bases also require review. This is not a general CAS and no universal grading claim is made.

Rubric criteria and weights are retained on question versions. Essay and rubric-enabled short text require teacher review; un-rubriced legacy short text retains exact matching. Teacher UI exposes numeric tolerances, mathematical variables/mode, and rubric text. See [mathjs parser security](https://mathjs.org/docs/expressions/security.html) for why arbitrary evaluation is not enabled.

## P2: constrained local tutor

Provider factory supports explicit mock, Ollama and opt-in mock fallback; unavailable/real/mock/fallback states are distinct in health and event metadata. Ollama uses the configured local /api/chat endpoint with timeout/abort, response-size limit, model/prompt versions and available token counts. No model download or paid subscription is required. The existing qwen2.5:3b model was used for synthetic local smoke inference.

The orchestrator sends only current question, authorized curriculum/skills, this question's submitted work and prior hints, remaining allowance and approved choices. It never sends the reference solution in restricted modes. Before any attempt only the teacher's first introductory choice is eligible; after work, the model selects from eligible unused options for the allowed level. Arbitrary generated prose is not shown: strict JSON index/focus schema plus an exact approved-text allowlist are application-enforced. This is real inference-assisted selection, not unrestricted generated tutoring or mathematical diagnosis. A future free-text adapter would need separate scientific and leakage validation.

Levels 1–3 have server-enforced caps; level 3 requires submitted work. Level 4 bypasses the model and returns the teacher reference only with explicit allowFullSolution and maxHintLevel=4 on a non-independent mission. Independent/level-zero policies always reject help. Existing legacy hint arrays map to their sequential levels; new hintBank permits several reviewed candidates at the same level.

aiRequests record pending/generated/committed/unavailable request provenance and available usage without prompts/raw model prose. Concurrent retried calls can perform redundant inference before the atomic evidence commit; each is accounted for, but quota/evidence remains unique. Crash-stale pending/generated requests require operational monitoring/reconciliation in P5. Student hint reports are private to the owner teacher.

## P3: learning evidence and role-specific projections

recordLearning joins each immutable question/attempt/evaluation and persists learningEvidence in the same practice/review transaction. It refreshes persistent mistakeRecords and masteryRecords; teacher corrections refresh these projections atomically, and an extra failure boundary tests rollback after learning evidence. A student/teacher/skill mastery row serializes updates across missions. Canonical snapshot reads remain the source of truth; materialized rows can be rebuilt additively with rebuild:learning while writes are stopped.

Mastery v1 is transparent and configurable (MASTERY_MIN_SAMPLES >=3, success threshold default .8). It distinguishes independent first attempts, assisted work, distinct question identities, supported automatic versus teacher review and insufficient evidence. The rules are provisional pilot policy, not scientifically validated ability scores. Mistakes are not resolved by hints or repeating the same question: two later independently correct first attempts on distinct questions in the same learning relationship are required. A teacher correction invalidating the source mistake is labeled corrected_by_review, not student improvement.

Teacher progress is restricted to that teacher's assignments; student progress is their own evidence across authorized relationships. Only the teacher receives full evidence/attempt details, trends and override history. Both projections use the same canonical facts. Mastery overrides preserve a reason/history and show the derived status separately; they never alter attempts or fabricate evidence. Recommendations separate observations, limited interpretation and a teacher-approved next action. No diagnosis of conceptual mistakes is invented.

## توسعه دامنه با درخواست مالک — سه نقش و تألیف ترکیبی

هدف پایلوت ایران و اول ابتدایی تا دوازدهم است؛ اینها داده پیکربندی curriculum و brief معلم‌اند، نه شرط hardcode در دامنه. parent نقش جدا با parentLinks(parent/student/teacher) است؛ ساخت لینک فقط با دعوت مالک ارتباط آموزشی و پذیرش حساب انجام می‌شود. گزارش اولیا از همان canonical evidence با projection غیرمعلم و فیلتر teacherId مجاز ساخته می‌شود. اولیا دسترسی به practice، پاسخ مرجع و یادداشت خصوصی ندارند. لغو parentLinks درخواست‌های بعدی را مسدود می‌کند؛ احراز سرپرستی/رضایت مستقل هنوز لازم است.

QuestionGenerator از HintProvider مستقل است: انتخاب راهنمای محدود با تولید پیش‌نویس یک سطح اعتماد ندارد. Ollama برای authoring فقط موضوع/مسیر curriculum/brief معلم/نوع سؤال می‌گیرد؛ پروفایل و پاسخ دانش‌آموز ارسال نمی‌شود. JSON محدود خروجی را از نظر ساختار کنترل می‌کند؛ questionSchema اشکالات مرجع را در draft علامت می‌زند و تأیید را تا اصلاح مسدود می‌کند. questionDrafts هرگز در فهرست questions و mission resolution نیست. معلم سؤال را ویرایش و با تأیید صریح صحت/تناسب سنی/راهنما تصویب می‌کند؛ ثبت question/version، تغییر وضعیت draft و audit یک تراکنش است. ردشدن نسخه سؤال ایجاد نمی‌کند. تولید در Mock غیرفعال است. usage/model/promptVersion ثبت می‌شوند؛ retry پذیرفته‌شده draft یا نسخه سؤال تکراری نمی‌سازد، هرچند دو inference هم‌زمان ممکن است و مصرف بلااستفاده به‌صورت generated قابل شناسایی است.

صفحه‌های اصلی از مؤلفه مرکزی به features استخراج شده‌اند. state کنترل‌شده و عمر draft در orchestration حفظ شده تا unmount یا reload پاسخ را از بین نبرد. Field و presentation مشترک‌اند. محتوا/مأموریت هنوز propهای کنترل‌شده دارند؛ این تصمیم تغییر تدریجی است، نه اضافه‌کردن لایه‌های repository/microservice/monorepo.

IRANSans محلی با اعلام مالک درباره لایسنس توسعه فعال شده است؛ prepare-font در prebuild/predev فایل خصوصی را به asset تولیدی ignored کپی می‌کند و در نبود آن fallback تولید می‌کند. Poppins OFL در مخزن می‌ماند. منبع فونت فارسی و فایل تولیدی وارد Git نمی‌شوند؛ این مجوز توسعه به معنی تأیید بازتوزیع عمومی نیست.

## فهرست مباحث نسخه‌دار

فهرست کشور/پایه/رشته در فایل داده مستقل است و شرط ریاضی/فیزیک به evaluator یا هسته اضافه نشده است. سرور کاتالوگ را ارائه و به انتخاب معلم، curriculum خصوصی را در تراکنش ایجاد می‌کند. UUIDv5 و setOnInsert واردسازی تکراری را پایدار و غیرتخریبی نگه می‌دارند. UI کتاب/فصل/مبحث و وضعیت بررسی منبع را نشان می‌دهد؛ انتخاب سؤال و authoring از همان topicهای واقعی MongoDB استفاده می‌کنند.

تولید سؤال از راهنمای دانش‌آموز مستقل است. آداپتور `AvalaiClient` فقط از سرور به دامنه ثابت API رسمی متصل می‌شود؛ URL و کلید از ورودی معلم پذیرفته نمی‌شوند. تنظیمات مدل در ماژول `ai-settings` متعلق به معلم ذخیره می‌شوند و در هر درخواست جدید authoring خوانده می‌شوند. مسیر موجود Ollama به‌صورت صریح برای نصب‌های قبلی حفظ شده است؛ خطاهای AvalAI به fallback پنهان یا سؤال Mock تبدیل نمی‌شوند.

### جداسازی گردش کار بانک سؤال — ۲۰۲۶-۱۰-۲۵

- `/content`: فقط مرور سؤال‌های تأییدشده و فیلترهای بانک؛ فرم ساخت سؤال و مدیریت منابع در این صفحه mount نمی‌شوند.
- `/content-new`: انتخاب روش مبحثی/آزاد/AI، ثبت دستی با رسانه‌ها و مشخصات اختیاری، و تأیید/رد پیش‌نویس هوشمند.
- `/resources`: مدیریت کتاب‌های رسمی و ساختار شخصی مشترک معلم، بر پایه همان collection و شناسه‌های curriculum.
- برای سازگاری با ناوبری موجود پوسته (History API و popstate)، لینک‌های جدید از AppLink استفاده می‌کنند؛ مسیرهای مستقیم در routeSegments ثبت‌اند. لینک عادی برای بازکردن در تب جدید حفظ می‌شود.
- فیلترها فعلاً در کلاینت روی داده واقعی API خصوصی معلم اعمال می‌شوند؛ جست‌وجوی سمت دیتابیس و صفحه‌بندی برای مقیاس بزرگ در این تغییر پیاده نشده است.

### ورود PDF آزمون

ماژول `server/modules/exam-imports.ts` همان قرارداد خصوصی موجود را حفظ می‌کند. PDF.js متن و مختصات را می‌خواند؛ Poppler/Sharp رندر و Tesseract فارسی/انگلیسی OCR محلی را انجام می‌دهند. صف MongoDB و worker مستقل با lease/retry، سقف فایل ۲۰ MiB، ۱۰۰ صفحه، محدودیت زمان/حافظه و cleanup موقت وجود دارند. خروجی نامطمئن و کلید تصویری نیازمند بازبینی انسانی‌اند؛ انتشار خودکار وجود ندارد. جزئیات اجرا و محدودیت علمی در EXAM_IMPORT_ENGINE.md مرجع است.

پل Next فقط مسیر دقیق آپلود را تا سقف فایل می‌پذیرد و مالکیت را پیش از خواندن بدنه بررسی می‌کند. اصل/پیش‌نمایش در MongoDB خصوصی با TTL تنظیم‌شده نگه‌داری می‌شوند؛ تصویر تأییدشدهٔ QuestionVersion مستقل می‌ماند. هیچ object storage یا سرویس موازی برای پایدارسازی افزوده نشده است.

### تصمیم‌های ممیزی MVP — ۲۰۲۶/۱۰/۲۶

برند قابل مشاهده هدهده/HodHodeh است؛ نام‌های فنی hamyar برای سازگاری حفظ شدند. ورود با تغییرات حساب تراکنشی سریال می‌شود. لینک reset در همان تب نیز consume شده و fragment پیش از ادامه از URL حذف می‌شود. پنل اولیا از select معتبر بدون wrapper صفحه‌بندی استفاده می‌کند؛ تصاویر خصوصی فقط با رابطه معتبرِ همان دانش‌آموز و معلم ارائه و پس از revoke مسدود می‌شوند. Headerهای nosniff، DENY، Referrer-Policy و Permissions-Policy در Next اعمال می‌شوند.
