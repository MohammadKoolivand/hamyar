# Release Readiness — Closure ۲۰۲۶/۱۰/۲۷

| سطح | وضعیت | دلیل |
|---|---|---|
| Educational Core | **CONDITIONALLY READY** | هسته فنی روی محتوای معلم‌تأییدشده و محیط آماده: backend152/152، Chrome41pass/0fail/1skip، دو Golden، کنترل راهنمای AI و تداوم داده موفق‌اند. داوری علمی تمام محتوا و دستگاه واقعی هنوز امضا نشده؛ ورودی اصلی OTP آنلاین آماده نیست. |
| Controlled Pilot با کودک واقعی | **NOT READY** | HTTPS/استقرار، تحویل واقعی SMS/SMTP موردنیاز، داوری انسانی ضروری و Gate رضایت/نگهداری/حذف داده کودک کامل نیستند. پایلوت مصنوعی محلی آزموده شده، جایگزین آن‌ها نیست. |
| Public Release | **NOT READY** | علاوه بر موارد بالا، ظرفیت واقعی، پایش/مسئول عملیات، enforce منابع و recovery مقصد تأیید نشده‌اند. |

## نسخه واقعی

main HEAD پایه `6eb7a6acc79d64a6e756a6ca963e87ef7a07fcee` به‌علاوه working tree Closure. آخرین CI خوانده‌شده برای خود SHA پایه موفق است: https://github.com/MohammadKoolivand/hamyar/actions/runs/40471748349 . این CI شامل اصلاحات ثبت‌نشده نیست. هیچ commit/push/deploy یا حذف branch/PR انجام نشد. اثرانگشت کد نهایی در FINAL_SOURCE_MANIFEST.json و نتایج در FINAL_RESULTS.json است.

## معیارها و نقص‌ها

۴۳۰معیار:410PASS،0FAIL،10BLOCKED،0NOT_RUN،7MANUAL_REQUIRED،3NOT_IMPLEMENTED،0OUT_OF_SCOPE؛ تعیین تکلیف100% و PASS95.35%. صفرFAIL به معنی رفع موانع یا پذیرش همه معیارها نیست. P0/P1/P2 باگِ اثبات‌شده باز:0؛ Gateهای P0 انتشار مانند HTTPS و داده کودک همچنان بازند و تست‌های انسانی انجام نشده‌اند.

UAT-AI-001 با کنترل سمت سرور بسته شد؛ نثر AI نامطمئن خصوصی می‌ماند. این validator تضمین معنایی نامحدود نیست: بانک AI فقط راهنمای مفهومی محدود را می‌پذیرد؛ راهنمای تخصصی مدل ممکن است نیاز به حذف/تألیف معلم داشته باشد. پاسخ مرجع برای معلم حفظ شده و راهنمای سالم دستی از رد اشتباه محافظت شد. PDF دو‌ستونی و خروجی ناقص generator نیز با regression بسته شدند.

## عملیات و موانع

- دامنه در query تازه NXDOMAIN؛ HTTPS resolve نشد، tls_verify=0 همراه HTTP000 نشانه TLS موفق نیست. APP_ORIGIN و کوکی امن باید در مقصد واقعی بررسی شوند.
- اثرانگشت RSA سرور با مقدار قبلاً تأییدشده مالک تطبیق داده شد؛ فقط known-host موقت استفاده شد. BatchMode با کلید موجود Permission denied داد؛ رمز استفاده نشد، هیچ تنظیمی تغییر نکرد و systemd مقصد تأیید نیست.
- credential معتبر ملی‌پیامک، AUTH_OTP_SECRET و SMTP/MAIL_OUTBOX_KEY عملیاتی در محیط آزمایشی موجود نیستند. تست‌های خطا/timeout/صف/retry/OTP واقعیِ backend با transport کنترل‌شده‌اند؛ delivery گوشی/Inbox **Not Verified** است.
- مدل محلی Ollama واقعاً سه تولید و دو انتخاب راهنما داشت؛ خروجی خام نامطمئن gate شد، published0. AvvalAI پولی فراخوانی نشد؛ وجود key مجوز هزینه نیست.
- Firefox نصب موقت شد ولی هر دو batch قبل از page load خطای profile داشتند؛ BLOCKED. Safari iOS/Android/کیبورد/نصب PWA واقعی و داوری علمی/کنتراست در UAT_HUMAN_REVIEW آماده مالک‌اند.
- deadline، نمایش اختصاصی versionID و فیلتر مستقل skill پیشنهاد POST_MVP دارند؛ NI حفظ شد. نسخه immutable backend از قبل برقرار است.
- OPS-016 SHA نسخه فعال مقصد، OPS-023 MemoryMax/cgroup مقصد و OPS-024 مسئول عملیات هنوز BLOCKED هستند. memory1500M در template با اجرای واقعی یکی نیست؛ بار۳۰خواندن/concurrency5 محلی ظرفیت کلاس عمومی نیست.

## Backup و Recovery

فقط وب/worker snapshot5177 توقف یافتند. backup واقعی DB مصنوعی شامل۴۴collection و۲۰۵۹سند بود؛ restore در DB تصادفی، hash سند/ایندکس برابر و مبدأ ثابت تأیید شد؛ فقط DB restore همان drill حذف شد. archive بیرون Git با permission600 نگهداری شد. راه‌اندازی مجدد و تداوم همان session/report در closure-evidence/restart.log ثبت است؛ audit:integrity صفر مغایرت داد. این drill تضمین backup منظم و recovery سرور مقصد نیست.

runbook: نویسندگان همان محیط را متوقف کنید؛ با MONGO_DB مستقل و تأیید ایزولاسیون، WRITES_PAUSED=true npm run verify:backup؛ نتیجه و مسئول را ثبت کنید؛ فقط سرویس همان محیط را از سر بگیرید. rollback کد نباید DB را خودکار به عقب ببرد؛ تابع موجود با فرمان‌های سیستم کنترل‌شده آزمایش شد. بازیابی/حذف داده کودک پس از restore نیازمند سیاست مستقل است.

## اقدامات باقی‌مانده با اولویت

۱. P0 انتشار: دامنه/HTTPS و دسترسی امن staging، credential معتبر و تست گیرنده مجاز OTP/ایمیل؛ مجوز تغییر/هزینه باید صریح باشد.
۲. P0 پایلوت کودک: تصمیم و اجرای احراز/رضایت نسخه‌دار، لغو، نگهداری/حذف/backup و مسئول پاسخ‌گو؛ parent link جایگزین آن نیست.
۳. P1: داوری علمی، دستگاه واقعی/Firefox سازگار، مسئول عملیات، منابع/پایش/ظرفیت و SHA نسخه فعال مقصد.
۴. بازبینی diff و با دستور جدا، commit/CI/release؛ در این مأموریت push ممنوع بود و انجام نشد.

**پاسخ پذیرش:** در محیط مستقل آماده، معلم و دانش‌آموز با ورود رسمی رمز عبور و محتوای تأییدشده توانستند بدون دستکاری میانی DB چرخه کامل تا تمرین تقویتی و گزارش پایدار را طی کنند؛ دو cohort تازه. استفاده عمومی با ورود پیش‌فرض OTP و کودک واقعی هنوز قابل تأیید نیست.
