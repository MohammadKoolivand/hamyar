# قرارداد API برش اول

Base `/api`، JSON، نشست `session` در cookie با HttpOnly و SameSite Strict؛ credentials همان origin. mutationهای مرورگر تنها از APP_ORIGIN یا host خود API پذیرفته می‌شوند. تمام شناسه‌ها UUID. دسترسی خارج از مالکیت 404، نقش نامجاز 403، نشست نامعتبر 401، اعتبارسنجی 400، تکرار/سقف 409، قطع Provider 503. ساخت‌ها در نسخه اول 200 برمی‌گردانند. خطا `{message, issues?}`؛ issues متعلق به Zod است.

| Method/path                     | نقش                          | Body                                        | Response                                                                            |
| ------------------------------- | ---------------------------- | ------------------------------------------- | ----------------------------------------------------------------------------------- |
| GET /health                     | عمومی                        | —                                           | status,provider؛ ping واقعی Mongo                                                   |
| POST /auth/register             | عمومی                        | name,email,password (10–128)                | message؛ نقش همیشه teacher                                                          |
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
 statement: string; type: 'numeric'|'choice'|'short'|'essay';
 reference: string; options?: string[]; tolerance?: number; hints?: string[];
}
```

سؤال numeric مرجع عددی محدود/متناهی، choice مرجع داخل گزینه‌ها، short تطبیق دقیق پس از normalize ارقام، essay همیشه pending_review. تلورانس absolute است، واحد/عبارت نمادین در این نسخه پشتیبانی نمی‌شود. hints حداکثر سه متن بررسی‌شده، فاقد پاسخ کامل؛ خود معلم صحت را تأیید می‌کند. skillIds باید به مهارت متعلق به معلم اشاره کنند.

policy: `{maxAttempts:1..10,maxHints:0..3,independent:boolean}`؛ اگر independent=true کمک فارغ از maxHints ممنوع است. انتشار سؤال‌ها را با نسخه ثابت استفاده می‌کند؛ ویرایش نسخه و جایگزینی سؤال مأموریت منتشرشده هنوز API ندارد.

Report: `total,answered,independent,assisted,pending,hints,eligibleFirstAttempts,independentSuccessRate:number|null,evidence,recommendation,provider`. شمارش صحیح بر اساس آخرین تلاش هر سؤال است؛ نرخ استقلال فقط اولین تلاش ارزیابی‌شده را می‌شمارد. معلم همه تلاش‌ها و تاریخچه بررسی را می‌بیند؛ دانش‌آموز آخرین تلاش هر سؤال، بدون یادداشت خصوصی بازبین. عدم وجود شواهد با null مشخص می‌شود.

## تفاوت با API پیشنهادی PRD

در برش اول assignment شناسه محیط تمرین است و practice-session مستقل ایجاد نشده. routeهای classes/exams/mastery و ویرایش سؤال/مأموریت هنوز پیاده نشده‌اند. قرارداد فعلی را به‌جای معرفی endpointهای آینده به‌عنوان عملیاتی استفاده کنید.
