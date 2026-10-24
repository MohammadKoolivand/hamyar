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
