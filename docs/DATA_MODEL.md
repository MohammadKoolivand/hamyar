# مدل MongoDB

شناسه‌ها UUID string، زمان‌ها UTC ISO؛ هر query منبع خصوصی با owner/student محدود می‌شود.

| collection       | ارتباط و index                                                                                    |
| ---------------- | ------------------------------------------------------------------------------------------------- |
| users            | email unique، role teacher/student/parent، passwordHash                                           |
| sessions         | tokenHash unique، userId، expiresAt TTL                                                           |
| invitations      | tokenHash unique، teacherId، email، expiresAt، usedAt؛ پذیرش یک‌بار اتمیک                         |
| relations        | teacherId+studentId unique                                                                        |
| curriculum       | ownerId، kind (system/level/grade/subject/course/chapter/topic/skill/objective)، parentId اختیاری |
| questions        | ownerId، currentVersionId                                                                         |
| questionVersions | questionId، version، immutable statement/reference/hints/type/topicId/skillIds                    |
| missions         | teacherId، questionVersionIds ثابت، studentId، policy، state draft/published                      |
| assignments      | missionId+studentId unique؛ progress per question و شمارنده‌های اتمیک                             |
| attempts         | assignmentId، questionVersionId، answer، sequence، hintsUsed، createdAt                           |
| evaluations      | attemptId unique، result/method، review history با reviewer/time/previousResult                   |
| hintEvents       | assignmentId، questionVersionId، provider/text/level/time                                         |
| auditLogs        | actorId، action، resourceId، createdAt                                                            |

Mission و assignment جدا و attempt و evaluation جدا هستند. گزارش‌ها از منابع معتبر در snapshot ساخته می‌شوند؛ شواهد، mastery و دفترچه persistent نیز ذخیره می‌شوند. تمام نوشتن‌های تمرین به replica set و تراکنش چندسندی نیاز دارند.

## P0 additive changes

- operations: SHA256(actorId, scope, key) as unique _id; requestHash, response, createdAt. Never exposed as a collection endpoint. Contains private response data and must be included in future account-retention/deletion policy.
- assignments.revision: optional legacy field, incremented atomically by writers; old documents initialize via $inc. No destructive migration.
- Unique attempt index (assignmentId, questionVersionId, sequence) and hint index (assignmentId, questionVersionId, level). Existing duplicate data prevents index creation rather than being discarded.
- Existing question/assignment/attempt/evaluation IDs are preserved. State updates and event records use one ClientSession.
- Offline copy script moves an unchanged source into an empty replica target, checks counts and refuses overwrite. Application writes must be stopped during copy. A failed copy is not a valid database and is not automatically dropped.
- audit:integrity is read-only: reports legacy quota mismatches/missing evaluations instead of fabricating evidence or renumbering first attempts. Any reported legacy mismatch requires explicit remediation before accepting new writes.

## P1 additive version/evaluation fields

questionVersions optionally contain relativeTolerance, rubric and mathContext. Existing versions retain tolerance and exact short matching; fields are not rewritten. Evaluations record evaluatorVersion, requiresTeacherReview, explanation and evidence reason codes; attemptId/questionVersionId remain authoritative provenance. No destructive schema migration.

## P2 additive tutor provenance

- aiRequests: assignmentId, questionVersionId, configuredProvider, active provider/model/promptVersion, state, timestamps and available usage. No unrelated student profile or raw model response is stored here.
- hintEvents: requestedLevel, provider/model/promptVersion/focus/requestId/optional usage; existing level still means sequence so old unique indexes remain valid.
- hintReports: unique(hintId,studentId), owner teacherId/assignmentId, reason, pending state, createdAt.
- Question versions optionally add approved hintBank; policy adds maxHintLevel/allowFullSolution with explicit effective defaults for old documents.

## P3 learning projections

learningEvidence uses attemptId as _id and stores assignment/student/teacher/question identity + version/skills/evaluation/result/method/sequence/hints/timestamp/verification. Every row points to canonical sources. mistakeRecords uses sourceAttemptId as _id and stores relationship, skills, source question, verification, improvement evidence IDs, status and null category until verified. masteryRecords is uniquely keyed by teacher/student/skill and stores policy/counts/quality/evidence IDs/last practice. masteryOverrides separately stores owner reason/status/history so later practice does not silently erase teacher decisions. All learning collections have student/teacher lookup indexes. There is no destructive migration; rebuild:learning backfills from existing sources and refuses missing canonical dependencies.

## سه نقش و تألیف سؤال

- invitations.role پیش‌فرض سازگار student است؛ parent به studentId مرتبط با teacherId نیاز دارد. parentLinks دارای unique(parentId,studentId,teacherId)، createdAt و verification=teacher_invited است؛ این مقدار ادعای احراز قانونی سرپرستی نیست. لغو، لینک را حذف و دعوت‌های باز همان ولی/دانش‌آموز/معلم را مصرف‌شده می‌کند؛ audit حفظ می‌شود. حساب‌های قبلی و relationها بازنویسی نمی‌شوند.
- questionDrafts: ownerId,state(pending_review/approved/rejected),question با reference خصوصی و validationIssues اصلاح‌لازم,provider/model/promptVersion/requestId,createdAt,reviewedAt/By,reason یا questionVersionId. index(ownerId,state,createdAt). هرگز به دانش‌آموز/ولی ارائه نمی‌شود.
- questionVersions.origin برابر human یا ai_reviewed؛ در حالت دوم sourceDraftId و provenance مدل محفوظ است. verifiedBy/At همیشه تصویب انسانی است. ایجاد دستی هم question و version را تراکنشی می‌نویسد.
- aiRequests.purpose=question_authoring و ownerId برای تولید بدون داده دانش‌آموز؛ usage ممکن است نامعلوم باشد. درخواست‌های generated که به draft متصل نیستند می‌توانند inference هم‌زمان بلااستفاده باشند؛ حذف/تسویه خودکار هنوز نداریم.
- طرح حذف داده باید users/sessions/invitations/relations/parentLinks/assignments/attempts/evaluations/hintEvents/hintReports/learningEvidence/mistakeRecords/masteryRecords/masteryOverrides/operations/aiRequests/auditLogs/questionDrafts و backupها را با حدود مالکیت و حقوق طرف‌های دیگر لحاظ کند. هیچ TTL ساختگی برای پاسخ‌های آموزشی تعیین نشده است.

## Course و Enrollment — مدل درس‌محور (۲ آبان ۱۴۰۵)

- `courses`: `_id`، `teacherId`، `title`، `subject`، `status=active` و `createdAt`. این موجودیت با نود `curriculum.kind=course` فرق دارد: اولی رابطه آموزشی و دسترسی را تعریف می‌کند؛ دومی ساختار محتوای خصوصی معلم است. دوره‌های قدیمی بدون این شناسه همچنان معتبرند.
- `enrollments`: `_id`، `courseId`، `teacherId`، `studentId`، `status=active`، `createdAt`. ایندکس یکتا روی `(courseId,studentId)` و ایندکس‌های خواندن برای هر معلم/دانش‌آموز.
- دعوت دانش‌آموز می‌تواند `courseId` متعلق به معلم داشته باشد؛ هنگام قبول دعوت، ایجاد relation و enrollment و مصرف توکن در همان تراکنش انجام می‌شوند. دعوت فاقد courseId در مسیر قدیمی، تنها relation می‌سازد و کاربر بدون رضایت مجدد عضو هیچ درس جدیدی نمی‌شود.
- `missions.courseId/enrollmentId` و `assignments.courseId/enrollmentId` برای مأموریت درس‌محور ذخیره می‌شوند؛ انتشار فقط با عضویت فعال ممکن است. اسناد قدیمی فاقد این کلیدها معتبرند. نمره‌ها/شواهد قدیمی بدون جعل منبع درس یا مهاجرت مخرب باقی می‌مانند.
- عضویت در یک درس، دسترسی به سؤال‌ها، مأموریت‌ها یا گزارش‌های خصوصی معلم دیگر ایجاد نمی‌کند؛ گزارش‌های پیشرفته فیلترشده بر اساس درس و ابزار انتقال/لغو عضویت در مراحل بعد تعریف می‌شوند.

## گزارش نمای درس دانش‌آموز

مسیر خواندنی `GET /api/student/dashboard` به‌صورت غیرمخرب از `enrollments`، `courses`، `users` (فقط نام معلم)، `assignments`، `attempts` و `evaluations` محاسبه می‌شود. هیچ درصد پیشرفت یا نسخه موازی از نتایج در دیتابیس ذخیره نمی‌شود. `courseId` از منابع خود دانش‌آموز با عضویت معتبر تطبیق داده می‌شود؛ مأموریت‌های قدیمیِ فاقد درس، بی‌سند به درس‌های جاری الصاق نمی‌شوند. پاسخ‌های خصوصی و یادداشت‌های داوری در DTO منتشر نمی‌شوند. شاخص «تکمیل» بر اساس وضعیت مأموریت است؛ شاخص «درست مستقل/با کمک» از آخرین پاسخ و آخرین نتیجه ارزیابی آن آمده و ادعای mastery نیست.


## مدیریت عضویت و چرخه تأیید درخواست

- `courseJoinCodes`: `_id,courseId,teacherId,tokenHash,expiresAt(Date)`؛ ایندکس یکتا tokenHash و TTL انقضا. کد ۱۹۲بیتی به‌صورت تصادفی تولید می‌شود؛ فقط هش ذخیره می‌گردد و هنگام صدور دوباره، کد قبلی اتمیک باطل می‌شود.
- `courseRequests`: `_id,courseId,teacherId,studentId,status(pending/approved/declined),createdAt,updatedAt,history[{status,actorId,at}]`؛ یکتا بر اساس `courseId+studentId`، شاخص خواندن برای معلم و دانش‌آموز. پس از رد یا لغو عضویت می‌توان درخواست جدید همان رکورد را به pending برگرداند و تاریخچه را حفظ کرد.
- `enrollments` مانند قبل یکتا بر اساس `courseId+studentId` است و حالا `status:active|revoked` و `history` اختیاری دارد. ردیف‌های قبل از این تسک همچنان معتبرند؛ افزودن تاریخچه به آن‌ها هنگام تغییر وضعیت انجام می‌شود. رابطهٔ کلی teacher/student پس از لغو یک درس حذف نمی‌شود، زیرا ممکن است متعلق به درس یا دعوت دیگری هم باشد.
- پایان عضویت تراکنشی است: حالت عضویت و تکلیف‌های ناتمامِ همان enrollment و وضعیت مأموریت‌های مربوط تغییر می‌کند، اما `attempts,evaluations,learningEvidence,hintEvents` پاک یا جابه‌جا نمی‌شوند. مأموریت‌های قدیمیِ بدون enrollmentId همچنان تحت جریان سازگار قبلی هستند.
- نوشتن‌های چرخه عضویت، trail در `auditLogs` دارند؛ فیلدهای محرمانه مثل کد خام را در audit و لاگ‌ها قرار ندهید. حذف قانونی اطلاعات، پشتیبان‌ها و retention همچنان تسک مستقلی برای پایلوت است.

## کلاس‌های گروهی

classGroups نگهدارنده عنوان کلاس، شناسه درس، شناسه معلم و شناسه دانش‌آموزان است. groupTasks هر بار لیست گیرندگان را به‌صورت snapshot ثبت می‌کند. هنگام انتشار، برای هر گیرنده Mission و Assignment مجزا و دارای groupTaskId ایجاد می‌شود؛ تولید همگی در یک تراکنش رخ می‌دهد. نتایج و پاسخ‌های هر فرد مستقل از دیگران در مسیرهای جاری ثبت می‌شوند. فهرست گروه و گزارش تجمیعی فقط به معلم مالک داده می‌شود.

## تمرین تقویتی فردی از شواهد

این مسیر به مدل جدید مستقل برای «مجموعه سؤال» نیاز ندارد: از `assignments` مربوط به دانش‌آموز و معلم و `learningEvidence` ساخته‌شده پس از ارزیابی/بازبینی، آخرین نتیجه معتبر هر `questionVersionId` خوانده می‌شود. سؤال‌های پیشنهادی باید `ownerId` برابر شناسه معلم داشته باشند. نتیجه `incorrect/partially_correct` با `verified=true` قابل پیشنهاد است؛ پاسخ درست تازه‌تر، خطای اصلاح‌شده یا `pending_review` کنار گذاشته می‌شود. دامنه انتخاب یا `courseId` معتبر و دارای enrollment فعال است یا فقط مأموریت‌های legacy فاقد courseId. هنگام انتشار یک Mission و Assignment جدید با `remediation:true` و اختیاری `enrollmentId` ثبت می‌شود؛ رکوردهای قدیمی، پاسخ‌ها و history بدون تغییر می‌مانند. ایندکس خواندن `learningEvidence.teacherId+studentId+assignmentId+createdAt` اضافه شده است.

## Catalog curriculum additions

curriculum nodes optionally carry catalogKey/catalogVersion/catalogBookId, order/sourceBasis and book source metadata. IDs are owner-scoped UUIDv5; $setOnInsert preserves existing titles and question references. Hierarchy is system → level → grade → course(book) → chapter → topic; the domain's generic kinds are unchanged. Dataset/version/source links live in src/data/iran-secondary-curriculum.json; officialEditionVerified=false is intentional while chap is unavailable. No destructive migration or cross-tenant seed occurs.

نسخه دوم کاتالوگ نوع کتاب (`program`) را مستقل از رشته نگه می‌دارد؛ علوم کامل و گزیده فیزیک شناسه‌های جدا دارند. تکمیلی سمپاد کتاب مستقلی با شناسه مستقل است؛ ترتیب فصل می‌تواند صفر باشد. ورود مجدد همچنان فقط افزودنی است.

در v3، `identityTitle` برای سه عنوان اصلاح‌شده، ورودی محاسبه UUID قبلی را نگه می‌دارد؛ `previousTitle` عنوان قدیمی مجاز برای اصلاح مشروط است. تغییر منبع رسمی و عنوان‌های شناخته‌شده در همان تراکنش import اعمال می‌شود. عنوان شخصی معلم بازنویسی نمی‌شود.


`aiSettings`: `_id=teacherId` (منحصربه‌فرد)، `ownerId`، `provider:avalai`، `model` و `updatedAt`. داده اختصاصی معلم است؛ کلید API در این مجموعه ذخیره نمی‌شود. مدل و ارائه‌دهنده درخواست در aiRequests و questionDrafts ثبت می‌شوند؛ تغییر تنظیمات پیش‌نویس‌های قبلی را تغییر نمی‌دهد.


### محتوای تصویری سؤال
`visuals?: QuestionVisual[]` در سؤال، پیش‌نویس و نسخه ثابت ذخیره می‌شود؛ حداکثر ۳ مورد. نوع chart شامل caption، عنوان محور/واحد، بازه‌ها و تا ۴ سری با ۲ تا ۸۰ نقطه است. نوع geometry شامل caption و مختصات ۰..۱۰۰ برای نقطه/پاره‌خط/پیکان/دایره است؛ تعداد اجزا و خروج از صفحه کنترل می‌شود. نوع formula شامل caption و LaTeX محدود است. کد SVG/HTML یا URL به‌عنوان شکل پذیرفته نمی‌شود.
`visualKind?: none|chart|geometry|formula` نیاز محتوایی درخواست تولید را نگه می‌دارد؛ نبود نوع خواسته‌شده مانع تأیید است. حذف این فیلد از payload تأیید نمی‌تواند الزام ذخیره‌شده پیش‌نویس را دور بزند. داده‌های قدیمی فاقد visuals معتبر می‌مانند و مهاجرت اجباری ندارند.

### مشخصات بانک سؤال — ۲۰۲۶-۱۰-۲۵

نسخه سؤال دارای `difficulty?` (easy/medium/hard)، `year?` (سال شمسی منبع سؤال) و `classification?` (topic/free) است. سؤال‌های قدیمی بدون classification مبحثی محسوب می‌شوند. سؤال آزاد topicId ندارد؛ برای این حالت skillIds خالی است و تحلیل مبتنی بر مهارت به آن مهارت ساختگی نسبت نمی‌دهد. سؤال آزاد همچنان با همان questionVersionId در مأموریت قابل تخصیص و ارزیابی است.

منابع مشترک در collection موجود curriculum و با ownerId معلم باقی می‌مانند؛ `/resources` تنها محل UI برای افزودن کتاب رسمی و ساختار شخصی است. صفحه افزودن و فیلتر بانک از همان شناسه‌ها و روابط والد استفاده می‌کنند، کپی مستقلی از فهرست ساخته نمی‌شود.

`questionVersions.source?` مشخصات منبع/آزمون را در همان نسخه ثابت نگهداری می‌کند. مدل source شامل family، administration و مشخصات اختیاری مرتبط با دسته است؛ هشت دسته رابط از این ابعاد استخراج می‌شوند. بنابراین هماهنگ کشوری با نهایی یکی نیست. نسخه‌های بدون source به «دسته‌بندی نشده» می‌روند و همچنان در «همه دسته‌ها» دیده می‌شوند. این مرحله مجموعه آزمون/PDF مستقل یا واردسازی فایل آرشیو ایجاد نمی‌کند.

### آزمون واردشده و فایل‌های خصوصی

- `examImports`: ownerId، metadata و source مشترک، state=collecting/review، revision، مشخصات فایل‌ها (name/size/sha256)، متن سؤال/پاسخ و پیام محدودیت استخراج.
- `examImportChunks`: examId، ownerId، kind=question/answer، position و Binary حداکثر ۲۵۶ KiB؛ ایندکس یکتای examId/kind/position. فایل ۲۰ MiB در یک سند MongoDB قرار نمی‌گیرد.
- `examImportItems`: ownerId/examId، question قابل اصلاح، state=pending/approved/rejected، originalNumber، reason، questionVersionId و زمان بررسی.

فایل‌ها، استخراج و بررسی خصوصی‌اند؛ فایل پاسخ هرگز برای دانش‌آموز باز نمی‌شود. تأیید، ثبت question/version، تغییر وضعیت آیتم و auditLog در یک تراکنش‌اند. تعارض همزمان با بازخوانی وضعیت به 409 می‌رسد. نسخه نهایی provenance آزمون را نگه می‌دارد. اصلاح متن قبل از تأیید قابل ذخیره و ادامه است؛ بعد از تأیید نسخه ثابت حفظ می‌شود.
