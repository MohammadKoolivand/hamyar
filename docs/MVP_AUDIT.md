# ممیزی واقعی MVP هدهده

شروع: ۲۰۲۶/۱۰/۲۶؛ مبنا main@8df89d7، checkout پاک و مطابق origin/main پس از fetch. PR باز صفر؛ تنها branch ریموت main. دو branch محلی قدیمی، قبل از حذف از نظر ancestor بررسی می‌شوند.

## ماتریس کشف اولیه

Implemented/Tested بر اساس کد و تست موجود است؛ «تست موجود» به معنای اجرای موفق این ممیزی نیست. نتایج تازه در MVP_TEST_REPORT ثبت می‌شوند.

| Feature                          | Implemented                              | Tested                                   | Broken                        | Missing                                | MVP Priority | Action                                  |
| -------------------------------- | ---------------------------------------- | ---------------------------------------- | ----------------------------- | -------------------------------------- | ------------ | --------------------------------------- |
| ثبت‌نام/ورود ایمیل و موبایل/نشست | identity/context، phone schema           | auth-session، phone-invitations          | در بررسی اولیه خیر            | OTP و اثبات مالکیت                     | P0           | اجرای regression و UI                   |
| بازیابی رمز                      | password-reset و TLS SMTP                | ۳ تست reset +۲ session                   | در بررسی اولیه خیر            | تحویل Inbox واقعی، صف durable          | P0           | اجرا و ثبت Not Verified سرویس واقعی     |
| پنج نقش و scope                  | access-management و routeRoles           | access-control و E2E نقش‌ها              | در بررسی اولیه خیر            | بدون نقش موازی                         | P0           | تست منفی و IDOR                         |
| بانک/ویرایش/نسخه                 | content/authoring، references نسخه‌ای    | question-revisions/source/assets         | در بررسی اولیه خیر            | سختی کالیبره؛ بانک عمومی               | P1           | حفظ برآورد اولیه و تأیید انسان          |
| مأموریت/تمرین/گزارش              | missions/practice/analytics/learning     | full-individual-journey، integrity، flow | در بررسی اولیه خیر            | تمرین عمومی بدون معلم خارج از برش فعلی | P0           | اجرای کامل و مرورگر                     |
| دعوت/اولیا/منشی                  | identity/access-management/parentLinks   | parents، phone، access                   | در بررسی اولیه خیر            | پیامک/احراز سرپرستی واقعی              | P0           | بررسی لغو رابطه و محتوای خصوصی          |
| PDF/OCR/worker                   | document-engine/layout/jobs/exam-imports | document-pipeline و E2E PDF              | CI: [12,4,19] به جای [12,19]  | OMR/تطبیق کامل همه PDFها               | P0           | بازتولید، اصلاح عمومی parser، benchmark |
| AI پیش‌نویس/راهنمای محدود        | AvvalAI/Ollama adapter و mock صریح       | adapter tests با transport کنترل‌شده     | سرویس واقعی هنوز بررسی نشده   | اعتبار علمی همگانی                     | P1           | failure امن، بدون ادعای inference واقعی |
| RTL/PWA/routes                   | App Router، shell-only cache             | flow/navigation/design                   | نام برند قدیمی در metadata/UI | نام یکدست هدهده                        | P1           | تست همه صفحه‌ها و برند                  |
| عملیات/حریم خصوصی                | TTL موقت، تراکنش، backup scripts         | pilot/integrity                          | بررسی ادامه دارد              | سیاست نگهداری داده کودک/استقرار HTTPS  | P1           | تست غیرمخرب، مستند مرز عرضه             |

## شواهد اولیه

- GitHub Actions مبنا: https://github.com/MohammadKoolivand/hamyar/actions/runs/40288228756 ؛ ۱۰۸/۱۰۹ موفق، فقط OCR شکست خورده.
- بازاجرای محلی هفت تست reset/session/document-pipeline پیش از تغییر parser: ۷ موفق؛ اختلاف محیط Tesseract در macOS و Linux محتمل است. Docker daemon محلی فعال نیست؛ اعتبار لینوکسی با CI بررسی خواهد شد.
- README/ARCHITECTURE/DATA_MODEL برخی توضیحات قدیمی سه‌نقشی/دعوت ایمیلی دارند؛ کد جاری پنج نقش و دعوت موبایلی را پشتیبانی می‌کند.
- MockProvider فقط برای انتخاب راهنمای تأییدشده و با عنوان صریح موجود است؛ تولید سؤال بدون provider واقعی 503 می‌دهد.

## دامنه عرضه

MVP: معلم → سؤال تأییدشده → دعوت/درس/کلاس → مأموریت → حل دانش‌آموز → ارزیابی و بازبینی معلم → گزارش/مرور → اولیای مرتبط. PDF یک ابزار کمک به ورود با تأیید انسانی است، نه ناشر خودکار سؤال. نقش منشی اداری و سوپرادمین مدیریت حساب است. فهرست بلندمدت/۱۶۰ تسک معیار افزودن قابلیت تازه نیست. بانک عمومی، OTP، پرداخت و کالیبراسیون روان‌سنجی خارج از این برش‌اند؛ محدودیت‌های استقرار و حریم خصوصی باید صریح باقی بمانند.

## یافته‌های تأییدشده و اصلاحات

| نقص واقعی                                | Root cause                                  | اصلاح و regression                                                                                      |
| ---------------------------------------- | ------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| OCR گزینه را سؤال می‌گیرد                | نشانگر گمشده/خراب در بلوک گزینهٔ ناقص       | parser محافظه‌کار، نگه‌داری متن خام، هشدار؛ assertion قبلی اسکن بدون تغییر در Linux پاس شد              |
| نشست قدیمی پس از reset                   | بررسی رمز بیرون از تراکنش ایجاد نشست        | نقطهٔ مشترک نوشتن روی users و شرط hash/role/active؛ تست رقابت پس از reset نشست صفر را ثابت می‌کند       |
| لینک reset در همان تب فرم را عوض نمی‌کند | effect فقط هنگام mount                      | hashchange + مصرف و حذف fragment؛ تست UI یک‌بارمصرف و invalidation                                      |
| select فرزند DOM نامعتبر دارد            | PagedList با div/nav داخل select            | map مستقیم option، تست DOM/hydration و revoke اولیا                                                     |
| والد تصویر سؤال مرتبط را نمی‌بیند        | role gate تصویر فقط teacher/student         | دامنهٔ parentLinks با جفت student/teacher و assignment؛ تصویر نامرتبط و revoke همچنان 404               |
| برند قدیمی در UI                         | metadata، wordmark، manifest و متن‌های قبلی | هدهده/HodHodeh؛ نام فنی package/API حفظ شد                                                              |
| تست‌های مرورگر به DB اشتباه وصل می‌شوند  | default DB در تست مستقیم assets             | guard نام دیتابیس آزمایشی در runner؛ تنظیم یکسان صریح وب، worker و تست                                  |
| E2E خارجی تکرارپذیر نیست                 | انتظار catalog زنده از سرویس بیرونی         | transport fixture فقط برای catalog؛ API/DB واقعی حفظ و نام تست صادقانه اصلاح شد؛ probe واقعی جدا ثبت شد |
| عرض فرم با fallback در Linux             | min-content پیش‌فرض control/grid            | min-w-0 و max-w-full روی Field/control؛ assertion overflow ثابت ماند و diagnostic اضافه شد              |

۹۲ مسیر API ایستا از کد اسکن شدند و هیچ مسیر بدون سیاست نقش نبود؛ این بررسی جایگزین کنترل مالکیت در query نیست. تست‌های منفی RBAC/IDOR در access-control، parents، assets، integrity و جریان‌های مالکیت موجود اجرا شدند. نسخه‌های سؤال و references مأموریت حفظ شدند. نتیجهٔ گیت‌ها و محدودیت‌های واقعی سرویس‌ها در MVP_TEST_REPORT مرجع نهایی‌اند.

### بسته‌شدن موارد واقعی

اصلاح overflow در Linux با اجرای سبز 40299755458 تأیید شد. پس از مشاهدهٔ خروج worker در خطای شبکه، retry محدود فقط برای MongoNetworkError/MongoServerSelectionError اضافه شد؛ سه رگرسیون جدید و کل ۱۱۶ تست محلی موفق‌اند. production DB برای بازتولید outage خاموش نشد. catalog واقعی AvvalAI با ۲۰۹ مدل و سناریوی کامل Ollama واقعی موفق بود؛ SMTP و inference واقعی AvvalAI همچنان طبق گزارش Not Verified هستند.

## ادامهٔ تکمیل حساب — ۲۰۲۶/۱۰/۲۶

- نقص واقعی: صف reset حافظه‌ای بود. توکن و پیام اکنون با تراکنش، AES-GCM و worker مستقل در MongoDB نگه‌داری می‌شوند؛ retry و بازیابی lease و حذف ciphertext آزموده‌اند.
- نقص واقعی: ایمیل ثبت‌شده بدون اثبات مالکیت قابل بازیابی بود. مسیر درخواست/تأیید مالکیت و تغییر امن ایمیل افزوده شد؛ reset فقط emailVerified=true را می‌پذیرد. تأیید ایمیل نشست‌ها را باطل می‌کند و securityRevision جلوی بازگشت login قدیمی در رقابت را می‌گیرد.
- تغییر صریح مالک: ورود/ثبت‌نام اصلی با موبایل و OTP از ملی‌پیامک. شماره نرمال، HMAC، پنج تلاش، throttle پایدار، مصرف تراکنشی و نقش از دعوت/حساب معتبر اجرا می‌شوند. تشکیل رابطه دعوت از همان helper مشترک identity استفاده می‌کند؛ مسیر آموزشی موازی ساخته نشد.
- مسیر OTP و ایمیل در چهار عرض ۳۶۰/۳۹۰/۷۶۸/۱۲۸۰ آزموده شدند. تست‌های credential پیشین با انتخاب صریح روش رمز حفظ شدند؛ OTP با context خالی جدا بررسی شد.
- محدودیت واقعی: Meli credential/الگو و OTP secret در محیط تنظیم نیستند؛ هیچ پیامک واقعی ارسال نشده. SMTP Inbox، AvvalAI پولی، سیاست کودک و زیرساخت حذف/consent هنوز آماده اعلام نمی‌شوند.

## پایدارسازی در Feature Freeze

مبنای تازه 4963aa7 و ریموت یکسان/CI سبز بود. رگرسیون‌ها دو نقص موجود را پیش از اصلاح اثبات کردند: بازگشت نشست login قدیمی پس از چرخه نقش مدیر (200 به‌جای 401)، و نبود index TTL هر دو مجموعهٔ OTP. commit `90eabe9` فقط securityRevision مدیریت و TTL افزایشی را اصلاح کرد. رگرسیون و کل گیت‌ها پس از تغییر پاس شدند؛ نتیجه، محدودیت اجرای MongoDB و checklist استقرار در MVP_RELEASE_READINESS مرجع است. هیچ قابلیت/route/page/role جدید اضافه نشد.
