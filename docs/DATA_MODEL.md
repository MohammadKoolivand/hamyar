# مدل MongoDB

شناسه‌ها UUID string، زمان‌ها UTC ISO؛ هر query منبع خصوصی با owner/student محدود می‌شود.

| collection       | ارتباط و index                                                                                    |
| ---------------- | ------------------------------------------------------------------------------------------------- |
| users            | email unique، role teacher/student، passwordHash                                                  |
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

Mission و assignment جدا؛ attempt و evaluation جدا. reports به صورت projection بازسازی می‌شوند، LearningEvidence در این مرحله ارجاع به attempts/evaluations است؛ collection mastery و دفترچه persistent در فاز بعد. Mongo transaction چندسندی نیازمند replica set است؛ برش اول از شمارنده شرطی اتمیک استفاده می‌کند. قطع پردازش بین reserve و insert می‌تواند سهمیه را مصرف کند؛ retry/idempotency و recovery worker پیش از پایلوت لازم است.
