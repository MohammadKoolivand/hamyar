"""Explicit evidence mapping; never infers PASS from a test file existing."""
import json, pathlib, collections
root=pathlib.Path(__file__).parent
cases=json.loads((root/'cases.json').read_text()); by={r['id']:r for r in cases}
def ids(section,spec):
 for part in spec.split(','):
  bounds=list(map(int,part.split('-')))
  for n in range(bounds[0],bounds[-1]+1): yield f'{section}-{n:03}'
def assign(section,spec,status,evidence,reason=''):
 for key in ids(section,spec):
  by[key].update(status=status,evidence=evidence,reason=reason)
def passed(section,spec,files,scope='MongoDB واقعیِ موقت؛ وابستگی خارجی کنترل‌شده مگر خلاف آن ذکر شده'):
 assign(section,spec,'PASS',files+('; evidence/e2e-existing.log' if 'tests/e2e/' in files else '; evidence/backend.log'),scope)
# Fresh 130/130 run, not the historical project reports.
passed('AUTH','001-009,012-013,015-016,018-026','tests/integration/phone-otp.test.ts; auth-session.test.ts; email-verification.test.ts; password-reset.test.ts; student-signup.test.ts')
passed('LINK','001-003,005-010,011-024','tests/integration/course-membership.test.ts; courses.test.ts; phone-invitations.test.ts; student-signup.test.ts')
passed('TEACH','009,011-013,017-021','tests/integration/curriculum-catalog.test.ts; resource-removal.test.ts; question-bank.test.ts')
passed('QB','001-009,012,014,016-017,019-022,024-027','tests/integration/question-visuals.test.ts; question-assets.test.ts; question-revisions.test.ts; authoring.test.ts; tests/unit/question-visuals.test.ts')
passed('AI','001-002,009-015','tests/integration/ai-settings.test.ts; authoring.test.ts; tutor.test.ts; avalai-hints.test.ts','قرارداد و transport کنترل‌شده؛ PASS به معنی inference واقعی AvvalAI نیست')
passed('OCR','001-002,005-006,009-014,017-019,021-034','tests/integration/document-pipeline.test.ts; exam-import.test.ts; image-import.test.ts; tests/unit/document-layout.test.ts','fixtureهای خودساخته؛ دقت عمومی کنکور تأیید نمی‌شود')
passed('HW','002-009,011,013,017-019,023-030','tests/integration/mission-selection.test.ts; mission-collection.test.ts; integrity.test.ts; courses.test.ts; feedback-mode.test.ts')
passed('PR','009-017,019-032,037-040','tests/integration/report-details.test.ts; tutor.test.ts; integrity.test.ts; feedback-mode.test.ts; tests/unit/evaluation.test.ts')
passed('EVAL','001-014','tests/unit/evaluation.test.ts; tests/integration/integrity.test.ts; report-details.test.ts')
passed('REP','003-010,012','tests/integration/report-details.test.ts; learning.test.ts; feedback-mode.test.ts; parents.test.ts')
passed('LEARN','001-014','tests/integration/learning.test.ts; remediation.test.ts; student-dashboard.test.ts; full-individual-journey.test.ts','API و projection واقعی؛ پوشش UI در اجرای مرورگر جدا مشخص است')
passed('REM','002-015','tests/integration/remediation.test.ts; full-individual-journey.test.ts')
passed('GROUP','001-004,006-013,015','tests/integration/class-groups.test.ts; course-membership.test.ts')
passed('PARENT','001-014','tests/integration/parents.test.ts; access-control.test.ts; phone-otp.test.ts','رابطه فنی و read-only؛ جایگزین رضایت/احراز حقوقی سرپرستی نیست')
passed('ADMIN','001,003-009,013-020','tests/integration/access-control.test.ts; auth-session.test.ts')
passed('SEC','001-008,010-012,014-018','tests/integration/api.test.ts; access-control.test.ts; tutor.test.ts; integrity.test.ts; pilot.test.ts; tests/unit/question-visuals.test.ts')
passed('OPS','003-007,014-015,021','tests/integration/document-pipeline.test.ts; integrity.test.ts; tutor.test.ts; learning.test.ts','تست app/worker در سطح ماژول روی replica set؛ نه اثبات systemd مقصد')
passed('EDGE','001-011,013-015','tests/integration/integrity.test.ts; tutor.test.ts; document-pipeline.test.ts; resource-removal.test.ts; access-control.test.ts')
assign('AUTH','027','BLOCKED','docs/PHONE_OTP.md; .env.example','SMTP واقعی/گیرنده مجاز تنظیم نشده؛ ارسال انجام نشد')
assign('AI','005','BLOCKED','evidence/ollama.log','دو inference محلی hint موفق؛ تولید سؤال پولی AvvalAI مجوز ندارد، تولید واقعی این case در اجرای جدید تأیید نشده')
assign('AI','006-008','MANUAL_REQUIRED','evidence/ollama.log','صحت علمی، تناسب سنی و عدم افشای معنایی نیازمند مرجع مستقل و داوری انسانی است')
assign('UI','001','BLOCKED','src/app/layout.tsx; src/components/hamyar-app.tsx','برند قبلاً تأییدشده هدهده است، سند UAT هدهد می‌خواهد؛ تصمیم مالک لازم است، بازطراحی/تغییر نام انجام نشد')
assign('UI','018-019,025-026,028','MANUAL_REQUIRED','UAT_EXECUTION_REPORT.md','کیبورد و نصب واقعی موبایل/داوری کنتراست و Safari iOS/Chrome Android واقعی در دسترس نیست؛ viewport جایگزین دستگاه نیست')
assign('UI','027','BLOCKED','evidence/environment.json','Firefox نصب/اجرا نشده؛ نتیجه Chrome به آن تعمیم داده نمی‌شود')
assign('HW','010','NOT_IMPLEMENTED','src/server/domain.ts','deadline در قرارداد مأموریت فعلی وجود ندارد؛ خارج از اصلاح محدود')
assign('QB','023','NOT_IMPLEMENTED','src/features/content/question-editor.tsx','شناسه نسخه در API و DB هست؛ نمایش اختصاصی شناسه در UI موجود نیست')
assign('QB','030','NOT_IMPLEMENTED','src/features/content/question-bank.tsx','فیلتر مبحث هست؛ فیلتر مستقل مهارت در بانک موجود نیست؛ فقط دارای راهنما/مهارت')
assign('GROUP','014','NOT_RUN','src/server/modules/class-groups.ts','سقف ۵۰ عضو در schema وجود دارد؛ آزمون مستقل مرز ۵۰/۵۱ اجرا نشده')
assign('OPS','017-018,020','BLOCKED','UAT_RELEASE_READINESS.md','HTTPS/deploy/rollback/systemd و SMTP مقصد آماده نیستند؛ روی سرور یا داده واقعی عملیاتی انجام نشد')
assign('SEC','013','BLOCKED','tests/integration/auth-session.test.ts; evidence/backend.log','ویژگی کوکی در تست backend تأیید شده؛ HTTPS واقعی محیط آنلاین هنوز تأیید نیست')
assign('T','007,010','BLOCKED','environment.json','محیط HTTP loopback؛ credential واقعی SMS/SMTP وجود ندارد')
assign('T','001-006,008-009,011-013','PASS','SOURCE_MANIFEST.json; evidence/environment.json; evidence/build.log; evidence/health.json','محیط مستقل 5176 و DB تصادفی روی replica set')
# Additional evidence from this UAT's executed browser suite.
passed('AUTH','010,014,017','tests/e2e/phone-otp.spec.ts; flow.spec.ts; navigation-layout.spec.ts')
passed('TEACH','001-002,006-008,010,014-016,022','tests/e2e/flow.spec.ts; curriculum-catalog.spec.ts; navigation-layout.spec.ts')
passed('QB','010-011,028-029,031-035','tests/e2e/question-bank.spec.ts; mission-pagination.spec.ts; question-source.spec.ts')
passed('AI','003-004','tests/e2e/ai-settings.spec.ts; tests/integration/authoring.test.ts','تنظیم/انتخاب کنترل‌شده، نه تضمین خروجی علمی مدل واقعی')
passed('OCR','003-004,007-008,015-016,020,035','tests/integration/image-import.test.ts; tests/e2e/exam-import.spec.ts; mission-file-import.spec.ts')
passed('HW','001,012,014-016,020-022','tests/e2e/flow.spec.ts; mission-pagination.spec.ts; mission-file-import.spec.ts; difficulty.spec.ts')
passed('PR','001-008,018,033-034,036','tests/e2e/flow.spec.ts; practice-selection.spec.ts; question-visuals.spec.ts; navigation-layout.spec.ts')
passed('REP','001-002,011','tests/e2e/flow.spec.ts; practice-selection.spec.ts')
passed('REM','001','tests/e2e/flow.spec.ts: teacher assigns one corrective practice')
passed('GROUP','005','tests/integration/class-groups.test.ts: members update and snapshot')
passed('ADMIN','002,010-012','tests/e2e/access-roles.spec.ts')
passed('UI','002-005,007-017,020-022,024,029-030','tests/e2e/navigation-layout.spec.ts; flow.spec.ts; practice-selection.spec.ts; design-system.spec.ts','Chrome واقعی؛ چهار viewport؛ بدون تعمیم به Safari/Android واقعی')
assign('OCR','014,030','NOT_RUN','tests/unit/document-layout.test.ts; tests/integration/document-limits.test.ts','ستون مصنوعی و PDF خراب پوشش دارند؛ PDF واقعی دو‌ستونی و PDF رمزدار این case کامل اجرا نشده‌اند')
assign('OCR','027-029','PASS','tests/integration/image-import.test.ts; document-limits.test.ts; evidence/backend.log','بارگذاری ۲۰MB+۱، تصویر ۲۵MP و PDF واقعی ۱۰۱صفحه‌ای رد شدند')

assign('AUTH','011','PASS','tests/e2e/uat-probes.spec.ts; evidence/probes.log','Chrome واقعی با پروفایل موقت بسته و دوباره اجرا شد؛ نشست بدون ساخت دوباره حساب حفظ شد')
assign('QB','015','PASS','tests/e2e/uat-probes.spec.ts; evidence/probes.log','MathML واقعی گزینه‌ها، انتخاب با کیبورد و تصحیح روی backend واقعی')
assign('QB','018','PASS','tests/e2e/question-visuals.spec.ts; evidence/e2e-existing.log','همان chart/diagram/image معلم و دانش‌آموز از نسخه محفوظ سؤال خوانده شد')
assign('UI','006,023','PASS','tests/e2e/uat-probes.spec.ts; evidence/probes.log','404 واقعی Next و transitionDuration=0s در prefers-reduced-motion')
assign('AI','005,016','PASS','local-ai-probe.ts; evidence/authoring.json','سه تولید واقعی محلی Ollama: ۳/۳ قرارداد معتبر، صفر انتشار؛ این نتیجه AvvalAI پولی یا صحت علمی عمومی را اثبات نمی‌کند')

assign('GOLD','001-010','PASS','tests/e2e/uat-golden.spec.ts; evidence/golden-final.log','دو cohort واقعی UI؛ ۵ پاسخ، ۳ مستقل، ۱ با کمک، ۱ نادرست، ۱ راهنما؛ گزارش معلم و تاریخچه ثابت')
assign('AI','008','FAIL','evidence/authoring.json; UAT_BUG_REPORT.md','UAT-AI-001: در سه پیش‌نویس واقعی Ollama متن راهنما پاسخ ۷ را آشکار کرد؛ هیچ‌کدام منتشر نشد؛ بررسی اجباری معلم مانع انتشار خودکار است')

assign('OPS','010-013','PASS','evidence/backup.log; scripts/verify-backup.ts','توقف فقط نویسندگان UAT؛ بکاپ ۴۴ collection و ۲۳۴۹ سند، restore به DB تصادفی، برابری hash سند و index و ثبات مبدأ تأیید شد')
assign('T','014','PASS','evidence/backup.log','بکاپ واقعی با بازیابی در DB تازه؛ هیچ داده واقعی هدف نبود')
# Closure run: only fresh dedicated execution evidence supersedes the baseline.
assign('AI','008','PASS','tests/integration/hint-safety.test.ts; closure-evidence/leak-before.log; closure-evidence/ai-regression.log; closure-evidence/backend-final.log','P0 closure: baseline approval accepted a leaking hint; server now blocks/reviews raw AI prose, guards legacy delivery, preserves private references and healthy conceptual hints. Semantic limits: UAT_CLOSURE_REPORT.md')
assign('LINK','004','PASS','tests/e2e/uat-closure.spec.ts; closure-evidence/ui-focused.log','Signed-in student opens invitation deep link and claims it without duplicate account')
assign('TEACH','003-005','PASS','tests/e2e/uat-closure.spec.ts; closure-evidence/ui-focused.log','Real teacher counters: students=1, assignments 1→2, completed 0→1 after reload')
assign('QB','013','PASS','tests/e2e/uat-closure.spec.ts; closure-evidence/ui-focused.log','Invalid numeric reference rejected; entered statement/reference remain in form')
assign('OCR','014,030','PASS','tests/integration/document-columns.test.ts; closure-evidence/pdf-before.json; closure-evidence/pdf-after.json; closure-evidence/remaining-backend.log','Actual two-page/two-column PDF: 4→8 detected headings after fix; encrypted and corrupt PDFs rejected. Synthetic layout is not all national PDFs')
assign('PR','035','PASS','tests/e2e/uat-closure.spec.ts; closure-evidence/ui-focused.log','Second independent browser context sees the one saved server attempt')
assign('GROUP','014','PASS','tests/integration/closure-boundaries.test.ts; closure-evidence/remaining-backend.log','50 active enrolled members accepted, 51 rejected and revoked enrollment denied')
assign('SEC','009','PASS','tests/integration/closure-boundaries.test.ts; closure-evidence/operations.json','Private sentinel/reference/password/hash absent from student APIs and real production log capture; not a universal secrecy proof')
assign('OPS','001-002,008-009,022','PASS','closure-operations-probe.ts; closure-evidence/operations.json','Owned temporary mongod: unavailable startup rejected, outage500, reconnect preserves session/data; request IDs/log redaction; 30 synthetic real backend reads concurrency5 errors0. Not public capacity qualification')
assign('OPS','019','PASS','tests/unit/deployment-config.test.mjs; closure-evidence/rollback.log','Actual rollback function executed with controlled systemctl/link/move commands; prior code/services restored, no database restore invocation. Not deployment on destination')
assign('OPS','016,023-024','BLOCKED','UAT_BLOCKERS.md','Destination release SHA/cgroup enforcement and named responsible operator not verified; local source/metrics/runbook evidence retained')
assign('EDGE','012','PASS','tests/e2e/uat-closure.spec.ts; closure-evidence/ui-focused.log','Refresh during a delayed real backend read preserves saved response and single attempt')
assign('UI','027','BLOCKED','closure-evidence/firefox-profile-failure.log; closure-evidence/firefox-retry.log','Firefox downloaded; two actual launch attempts fail before page load due inaccessible profile folder. No app assertion executed in Firefox')

assign('GOLD','001-010','PASS','tests/e2e/uat-golden.spec.ts; closure-evidence/golden-final.log','Fresh closure production build: two complete independent cohorts, strict counters/history/privacy assertions')
assign('OPS','010-013','PASS','closure-evidence/backup.log; closure-evidence/restart.log','Fresh quiesced closure backup: 44 collections, 2059 documents; isolated restore, document/index hashes equal, source unchanged')
assign('T','001-006,008-009,011-014','PASS','environment.json; FINAL_SOURCE_MANIFEST.json; closure-evidence/build.log; closure-evidence/backup.log','Fresh closure environment 5177 / owned replica27189; synthetic data only')
for row in cases:
 if row['status']=='PASS' and not row['id'].startswith('T-'):
  for proof in ['closure-evidence/backend-final.log','closure-evidence/ordinary-final.log','closure-evidence/golden-final.log']:
   if proof not in row['evidence']: row['evidence'] += '; '+proof

# Cases without a dedicated executed assertion remain explicitly NOT_RUN, not assumed successful.
for r in cases:
 r['priority']='P0' if r['id'].split('-')[0] in ['SEC','AUTH','GOLD','EVAL'] else 'P1'
 if r['id']=='AI-008': r['priority']='P0'
 if r['status']=='NOT_RUN': r['reason']='در این اجرا assertion مستقل و کافی برای تمام عبارت این مورد ثبت نشده؛ وجود کد/تست مجاور PASS محسوب نشد'
(root/'cases.json').write_text(json.dumps(cases,ensure_ascii=False,indent=2)+'\n')
def render():
 counts=collections.Counter(r['status'] for r in cases if not r['id'].startswith('T-'))
 rows=['# چک‌لیست جامع UAT','', '۴۳۰ مورد محصول + ۱۴ پیش‌نیاز محیط = ۴۴۴ شناسه. وضعیت‌ها فقط متعلق به اجرای تازه هستند؛ شمارش تست خودکار با شمارش موارد پذیرش یکسان نیست.','', '| ID | بخش / معیار | اولویت | وضعیت | شواهد | علت شکست/محدودیت |','|---|---|---|---|---|---|']
 for r in cases: rows.append('| '+' | '.join(str(r[k]).replace('|','/').replace('\n',' ') for k in ['id','description','priority','status','evidence','reason'])+' |')
 (root/'UAT_MASTER_CHECKLIST.md').write_text('\n'.join(rows)+'\n')
 (root/'COUNTS.json').write_text(json.dumps({'businessCases':430,'setupCases':14,'product':{k:counts[k] for k in ['PASS','FAIL','BLOCKED','NOT_RUN','MANUAL_REQUIRED','NOT_IMPLEMENTED','OUT_OF_SCOPE']},'setup':dict(collections.Counter(r['status'] for r in cases if r['id'].startswith('T-')))},ensure_ascii=False,indent=2)+'\n')
render()
print((root/'COUNTS.json').read_text())
