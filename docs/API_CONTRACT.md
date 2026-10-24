# قرارداد API برش اول

Base `/api`، JSON، نشست `session` در cookie با HttpOnly و SameSite Strict؛ credentials همان origin. mutationهای مرورگر تنها از APP_ORIGIN یا host خود API پذیرفته می‌شوند. تمام شناسه‌ها UUID. دسترسی خارج از مالکیت 404، نقش نامجاز 403، نشست نامعتبر 401، اعتبارسنجی 400، تکرار/سقف 409، قطع Provider 503. ساخت‌ها در نسخه اول 200 برمی‌گردانند. خطا `{message, issues?}`؛ issues متعلق به Zod است.

| Method/path                     | نقش                          | Body                                        | Response                                                                            |
| ------------------------------- | ---------------------------- | ------------------------------------------- | ----------------------------------------------------------------------------------- |
| GET /health                     | عمومی                        | —                                           | status,provider؛ ping واقعی Mongo                                                   |
| POST /auth/register             | عمومی                        | name,email,password (10–128),role?:teacher\|student | message؛ role پیش‌فرض teacher برای سازگاری؛ parent/admin از ثبت‌نام عمومی ممنوع                                                          |
| POST /auth/login                | عمومی                        | email,password                              | User DTO + session cookie                                                           |
| GET /auth/me                    | واردشده                      | —                                           | User DTO: _id,name,email,role                                                       |
| POST /auth/logout               | عمومی                        | {}                                          | ok؛ حذف نشست                                                                        |
| POST /invitations               | معلم                         | email                                       | token,expiresInHours=72؛ token تنها همین بار خام بازمی‌گردد                         |
| POST /invitations/accept        | دارنده دعوت                  | token,name,email,password                   | message؛ حساب جدید student یا اتصال حساب student موجود با رمز همان حساب             |
| GET /students                   | معلم                         | —                                           | User DTO[] تنها روابط همان معلم                                                     |
| GET /curriculum                 | معلم                         | —                                           | Node[] خصوصی                                                                        |
| POST /curriculum                | معلم                         | title,kind,parentId?                        | Node؛ kind: system/level/grade/subject/course/chapter/topic/skill/objective         |
| GET /questions                  | معلم                         | —                                           | نسخه‌های سؤال خصوصی با مرجع                                                         |
| POST /questions                 | معلم                         | QuestionInput زیر                           | نسخه ۱ ثابت با questionId مستقل                                                     |
| GET /missions                   | واردشده                      | —                                           | معلم Mission[]؛ دانش‌آموز Assignment[]                                              |
| POST /missions                  | معلم                         | title,studentId,questionVersionIds[],policy | Mission draft                                                                       |
| POST /missions/:mid/publish     | مالک معلم                    | {}                                          | ok؛ تخصیص idempotent با index یکتا                                                  |
| GET /assignments                | واردشده                      | —                                           | تخصیص‌های همان نقش/مالک                                                             |
| GET /assignments/:aid           | دانش‌آموز مربوط یا معلم مالک | —                                           | Assignment + questions عمومی بدون reference/hints + attempts/evaluations/hintEvents |
| POST /assignments/:aid/attempts | دانش‌آموز مربوط              | questionId (=version ID),answer             | attempt,evaluation؛ sequence و hintsUsed در بک‌اند ثبت می‌شود                       |
| POST /assignments/:aid/hints    | دانش‌آموز مربوط              | questionId                                  | HintEvent؛ شمارنده شرطی اتمیک؛ در independent ممنوع                                 |
| POST /assignments/:aid/complete | دانش‌آموز مربوط              | {}                                          | ok؛ همه سؤال‌ها باید تلاش داشته باشند؛ submitted یا completed                       |
| GET /assignments/:aid/report    | دانش‌آموز مربوط یا معلم مالک | —                                           | Report زیر                                                                          |
| POST /evaluations/:eid/review   | معلم مالک                    | result:correct/incorrect,note               | ok؛ تاریخچه قبلی با هویت بازبین و زمان                                              |

## QuestionInput

```ts
{
 topicId: UUID; skillIds?: UUID[];
 statement: string; type: 'numeric'|'choice'|'short'|'essay'|'symbolic';
 reference: string; options?: string[]; tolerance?: number; hints?: string[];
}
```

سؤال numeric مرجع عددی محدود/متناهی، choice مرجع داخل گزینه‌ها، short تطبیق دقیق پس از normalize ارقام، essay همیشه pending_review. تلورانس absolute و relative و زیرمجموعه نمادین طبق قرارداد P1 پشتیبانی می‌شوند؛ واحدها پشتیبانی نمی‌شوند. hints حداکثر سه متن بررسی‌شده، فاقد پاسخ کامل؛ خود معلم صحت را تأیید می‌کند. skillIds باید به مهارت متعلق به معلم اشاره کنند.

policy: `{maxAttempts:1..10,maxHints:0..3,independent:boolean}`؛ اگر independent=true کمک فارغ از maxHints ممنوع است. انتشار سؤال‌ها را با نسخه ثابت استفاده می‌کند؛ ویرایش نسخه و جایگزینی سؤال مأموریت منتشرشده هنوز API ندارد.

Report: `total,answered,independent,assisted,pending,hints,eligibleFirstAttempts,independentSuccessRate:number|null,evidence,recommendation,provider`. شمارش صحیح بر اساس آخرین تلاش هر سؤال است؛ نرخ استقلال فقط اولین تلاش ارزیابی‌شده را می‌شمارد. معلم همه تلاش‌ها و تاریخچه بررسی را می‌بیند؛ دانش‌آموز آخرین تلاش هر سؤال، بدون یادداشت خصوصی بازبین. عدم وجود شواهد با null مشخص می‌شود.

## تفاوت با API پیشنهادی PRD

در برش اول assignment شناسه محیط تمرین است و practice-session مستقل ایجاد نشده. routeهای classes/exams و ویرایش سؤال/مأموریت هنوز پیاده نشده‌اند؛ progress و mastery طبق قرارداد P3 فعال‌اند. قرارداد فعلی را به‌جای معرفی endpointهای آینده به‌عنوان عملیاتی استفاده کنید.

## P0 update — retry and states

All practice mutations, publish/cancel and teacher review accept `Idempotency-Key: <8..128 ASCII word/dash/colon characters>`. Scope includes authenticated actor and action/resource. Exact retry returns the originally committed response, including after completion. Changed parsed body with the same key returns 409. A keyless request remains a distinct intent for compatibility; API clients should always send keys. Keys currently do not expire.

POST /assignments/:aid/attempts additionally accepts optional `expectedAttempt` (1..10). POST hints additionally accepts `expectedHintLevel` (1..3). Stale counters reject with 409; the stored replay is checked before this rejection. The official UI supplies these fields and durable retry keys.

POST /missions/:mid/cancel (teacher owner) atomically cancels a draft/open/submitted mission and its assignment; repeating cancellation succeeds. Completed/cancelled states cannot be reopened. Attempt/hint/complete on cancelled assignments returns 409. Publishing an already published/in-progress/submitted/completed mission is a no-op; publishing cancelled returns 409.

Attempt, evaluation, quota, operation response and parent state commit together. Teacher review history/audit/state also commit together. Any missing legacy evaluations prevent completion rather than silently completing. MongoDB standalone is unsupported; configure a replica set. Provider errors/timeouts preserve attempts and consume no hint quota.

Browser Origin is matched to APP_ORIGIN exactly, not to untrusted Host or forwarded headers. Requests marked cross-site are rejected. Authenticated reads have private/no-store via the Next adapter; PWA never caches /api.

## P1 additive evaluation contract

QuestionInput additionally supports type=symbolic, relativeTolerance=0..1 (default 0 for legacy), absolute tolerance=0..1e9, optional rubric=[{criterion,weight}], and mathContext={variables:[ASCII symbol names, max 3],domain:"real",mode:"expression"|"equation"}. mathContext is required when creating symbolic questions. Domain, variables and mode are immutable with the version.

Evaluation retains result/method and adds requiresTeacherReview, explanation (reason code), evidence (reason list), evaluatorVersion. Supported methods include existing human_required for compatibility. Symbolic unsupported input is pending_review; only supported exact comparisons return correct/incorrect. Numeric invalid syntax returns incorrect with invalid_numeric_input; magnitude beyond safe floating precision returns pending_review. No AI scores open-ended text.

## P2 additive tutor contract

- policy.maxHintLevel:0..4 (default 3 for new missions; legacy effective 3); allowFullSolution:false by default. Independent overrides every permission.
- question.hintBank?:[{level:1..3,text}] (max 12) is an immutable teacher-approved candidate set; legacy hints remain supported.
- POST hints accepts optional level:1..4 (in addition to expectedHintLevel, which tracks consumed hint count). Level 3 requires an existing attempt; level 4 requires explicit permission.
- HintEvent retains level as usage sequence and adds requestedLevel, provider, model, promptVersion, focus, requestId and optional usage.
- GET health adds ai:{configured,active,state,model?}; configured is not a successful-inference claim.
- POST /assignments/:aid/hints/:hid/report {reason}: student owner; creates one private feedback record per student/hint. Teacher report includes hintFeedback; student report does not expose teacher-only feedback.

AI_PROVIDER=mock|ollama; OLLAMA_BASE_URL, OLLAMA_MODEL, AI_TIMEOUT_MS; AI_FALLBACK=mock is explicit opt-in. Cloud inference is not implemented. Mock/fallback outputs are always labeled mock.

## P3 learning endpoints

- GET /students/:sid/progress: student self or related teacher. Snapshot statistics, skills/mastery/policy/evidence counts, persistent mistake notebook, observations/interpretations/actions. Teacher-only evidence (including authorized submitted answers), mission trends and override history; student-only observed strengths.
- GET /students/:sid/mistakes: same authorization, persistent source-linked records; no inferred mistake category without verification. Assisted success does not resolve a record. Source correction is distinguished from independently observed improvement.
- POST /students/:sid/mastery/:skillId/override {status,reason}: related owner teacher only, skill must belong to that teacher. Allowed statuses: not_started/insufficient_evidence/needs_practice/developing/proficient/needs_review. History persists and derived status remains visible. Accepts Idempotency-Key.

First-attempt independent success uses eligible supported/teacher-verified evaluations. Hint usage rate is unique hinted assignment/question pairs divided by assigned question count; empty denominators return null. Trends are descriptive comparisons and do not imply controlled learning gains. Rebuild legacy evidence with npm run rebuild:learning while writes are stopped; this does not rewrite source attempts or grades.

## تألیف ترکیبی و نقش اولیا — عملیاتی

همه endpointها زیر /api هستند؛ پاسخ خصوصی no-store و کنترل Origin برای mutationها برقرار است.

| endpoint                                 | مجوز              | ورودی/رفتار                                                                                                                                                            |
| ---------------------------------------- | ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| POST /invitations                        | معلم              | email, role:student(default)/parent؛ برای parent، studentId از رابطه همین معلم لازم است                                                                                |
| POST /invitations/accept                 | دارنده دعوت معتبر | همان قرارداد قبلی؛ role از دعوت سرور تعیین می‌شود، نه body مشتری؛ حساب موجود باید همان نقش و رمز را داشته باشد                                                         |
| GET /children                            | ولی               | فقط شناسه/نام فرزندان دارای parentLink                                                                                                                                 |
| GET /students/:sid/parents               | معلم مرتبط        | حساب‌های اولیای پذیرفته‌شده همان ارتباط                                                                                                                                |
| POST /students/:sid/parents/:pid/revoke  | معلم مرتبط        | {}؛ حذف لینک، ابطال دعوت‌های باز مربوط و audit تراکنشی؛ حساب و شواهد حذف نمی‌شوند                                                                                      |
| GET /students/:sid/progress یا /mistakes | ولی مرتبط هم مجاز | فقط داده teacherIdهایی که همان ولی به آن‌ها متصل است؛ بدون evidence/trends خصوصی معلم، override reason/history یا مرجع                                                 |
| GET /assignments/:aid/report             | ولی مرتبط هم مجاز | projection خواندنی غیرمعلم؛ مشاهده مستقیم practice یا ثبت پاسخ/کمک ممنوع است                                                                                           |
| GET /question-drafts                     | معلم              | صف خصوصی pending_review                                                                                                                                                |
| POST /question-drafts/generate           | معلم              | topicId,skillIds?,brief(5..1000),type:numeric/choice/short/essay؛ یک draft با مدل واقعی؛ Mock=503؛ JSON/ساختار نامعتبر=502؛ draft با اشکال مرجع دارای validationIssues و نیازمند اصلاح است؛ timeout/unavailable=503؛ حداکثر ۶ درخواست در دقیقه |
| POST /question-drafts/:did/approve       | معلم مالک         | {question:QuestionInput,confirmed:true}؛ امکان اصلاح قبل از تأیید، ایجاد نسخه و audit تراکنشی؛ وضعیت تعیین‌تکلیف‌شده=409                                               |
| POST /question-drafts/:did/reject        | معلم مالک         | {reason:3..1000 chars}؛ هیچ سؤال بانکی ایجاد نمی‌شود؛ approved قابل رد نیست                                                                                            |

ایجاد دستی سؤال، generate/approve/reject و revoke از Idempotency-Key پشتیبانی می‌کنند؛ پاسخ پذیرفته‌شده با کلید ثابت تکرار می‌شود و body متفاوت 409 است. mutationهای UI تألیف کلید retry دارند. reference در draft خصوصی معلم است؛ نمایش آن برای بررسی انسانی عمدی است. مدل تولید سؤال از هیچ endpoint خودکار publish یا assign استفاده نمی‌کند. API احراز سرپرستی، رضایت، حذف حساب و بازیابی رمز هنوز پیاده نشده‌اند؛ این‌ها قابلیت تکمیل‌شده نیستند.


## ثبت‌نام مستقل دانش‌آموز و اتصال به معلم

- `POST /api/auth/register` اکنون `role?: "teacher" | "student"` را می‌پذیرد. اگر role حذف شود، برای سازگاری با کلاینت‌های قدیمی teacher ایجاد می‌شود. نقش parent فقط از دعوت موجود مجاز است؛ admin قابل ثبت‌نام عمومی نیست.
- دانش‌آموز تازه ثبت‌نام‌شده می‌تواند بدون ارتباط با معلم وارد پنل شود. `GET /api/assignments` برای حساب بدون تکلیف آرایه خالی است. تا ایجاد رابطه و انتشار مأموریت، دسترسی به بانک خصوصی معلم یا تمرین مستقل عمومی وجود ندارد.
- `POST /api/invitations/claim` نیازمند نشست معتبر student و body برابر `{token:string}` است. توکن فقط برای ایمیل همان حساب، دعوت student، وضعیت استفاده‌نشده و انقضای معتبر پذیرفته می‌شود. توکن و رابطه در تراکنش ثبت می‌شوند، حساب جدید ساخته نمی‌شود؛ پاسخ موفق `{message}` است. تکرار توکن مصرف‌شده یا دعوت نامعتبر 400 می‌دهد، نقش‌های دیگر 403.
- `POST /api/invitations/accept` قبلی برای دانش‌آموز فاقد حساب و دعوت اولیا بدون تغییر باقی مانده و از حساب‌های student موجود همراه با رمز معتبر نیز پشتیبانی می‌کند.
- دعوت دانش‌آموز برای ارتباط با معلم است، **نه تأیید هویت/سن یا رضایت سرپرست**. استفاده عمومی با داده واقعی کودکان همچنان مجاز اعلام نشده است.

## API درس‌ها و عضویت‌ها

- `POST /api/courses` فقط معلم: `{title:2..120,subject:2..100}`؛ پاسخ `{_id,teacherId,title,subject,status,createdAt}`.
- `GET /api/courses` معلم: فقط درس‌های خود؛ دانش‌آموز: فقط درس‌های فعال با عضویت فعال؛ والدین 403.
- `GET /api/enrollments` معلم: فقط عضویت‌های فعال درس‌های خودش؛ دانش‌آموز: فقط عضویت‌های فعال خودش به‌همراه `courseTitle,subject,teacherName` بدون انتشار ایمیل سایر کاربران؛ والدین 403.
- `POST /api/invitations` پارامتر اختیاری `courseId` برای دعوت `role=student` به درس فعال همان معلم دارد. برای نقش والدین مجاز نیست و شناسه نامعتبر یا متعلق به معلم دیگر 404 می‌دهد.
- `POST /api/invitations/claim` و `POST /api/invitations/accept` در دعوت درس‌محور، مصرف توکن و ایجاد Enrollment را اتمیک انجام می‌دهند؛ پذیرش تکراری برای همان درس، رکورد تازه ایجاد نمی‌کند.
- `POST /api/missions` `courseId` اختیاری می‌پذیرد؛ اگر ارائه شود، عضویت فعال همین دانش‌آموز در درسِ همین معلم اجباری است. پاسخ Mission حاوی `courseId,enrollmentId` است و هنگام انتشار به Assignment کپی می‌شود. مجوز مأموریت‌های قدیمی بدون `courseId` تغییر نکرده است.

## داشبورد یکپارچه دانش‌آموز

- `GET /api/student/dashboard` فقط برای نشست معتبر `student` (سایر نقش‌ها 403، بدون نشست 401). هیچ شناسه دانش‌آموزی در URL ورودی ندارد؛ هویت تنها از نشست سرور گرفته می‌شود.
- خروجی `{summary,courses,legacy}`: `courses[]` فقط درس‌هایی را برمی‌گرداند که کاربر عضویت فعال در آن‌ها دارد و `teacherId` درس و عضویت یکسان است. هر درس `courseId,title,subject,teacherName`، شمارش مأموریت، تعداد تکمیل‌شده/در انتظار بررسی/فعال، تعداد سؤال‌های تخصیص‌یافته و پاسخ‌داده‌شده، تعداد پاسخ‌های ارزیابی‌شده و تعداد پاسخ‌های درست بدون کمک و با کمک دارد؛ `missions` تنها عنوان، وضعیت، شناسه مأموریت تخصیص‌یافته و زمان دارد.
- `summary` آمار کل کاربر (شامل تمرین قدیمی) و `activeCourses` را نشان می‌دهد. `legacy` مأموریت‌های بدون ارجاع معتبر به درس فعال را مستقل نگه می‌دارد، نه تحت یک درس دلخواه.
- شمارش سؤال پاسخ‌داده‌شده برای هر مأموریت/سؤال از آخرین تلاش ثبت‌شده استفاده می‌کند؛ نتیجه ارزیابی جاری (شامل اصلاح معلم) مبنای شمارش پاسخ درست است. پاسخ در انتظار داوری به عنوان صحیح شمرده نمی‌شود. پیشرفت مأموریت (completed/assignments) نمره مهارت یا ادعای تسلط نیست. بدون مخرج شواهد معتبر، درصد موفقیت آموزشی ساخته نمی‌شود.
- خروجی هیچ جواب خام، متن خصوصی، توکن، رمز، کلید مرجع سؤال یا یادداشت خصوصی معلم را بازنمی‌گرداند. حجم اسناد با افزایش تاریخچه نیازمند صفحه‌بندی/تجمیع مقیاس‌پذیر در فاز بعد است.
