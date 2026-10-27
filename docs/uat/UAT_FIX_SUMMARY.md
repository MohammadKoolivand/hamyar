# UAT — خلاصه اصلاحات

| قابلیت | مشکل | اصلاح | فایل | تست و نتیجه | ریسک |
|---|---|---|---|---|---|
| ورود PDF واقعی | ادغام سؤال ۳ و ۴ پس از گزینه ناقص سؤال ۲ | تشخیص محافظه‌کارانه heading متن با شماره متوالی و هندسه هم‌تراز | src/server/imports/layout.ts | رگرسیون ابتدا fail، سپس ۶/۶ pass؛ نمونه واقعی از ۴ به ۶ شماره رسید؛ backend نهایی ۱۳۲/۱۳۲ | نیاز به review متن/کلید همچنان برقرار |
| پوشش تصویر و محدودیت سند | نبود assertion مستقل JPG/WebP، حجم، ابعاد و ۱۰۰صفحه | تقویت تست موجود و fixture معتبر ۱۰۱صفحه‌ای | tests/integration/image-import.test.ts; document-limits.test.ts | JPG/PNG/WebP و PDF.js؛ رد ۲۵MP، ۲۰MB+۱ و ۱۰۱صفحه؛ backend موفق | کد محصول این قسمت تغییر نکرد |
| پذیرش پیوسته | نبود Golden پنج‌سؤالی کامل UI در یک test | دو cohort مستقل؛ ثبت‌نام رسمی و UI واقعی تا والد/تقویت | tests/e2e/uat-golden.spec.ts | وضعیت نهایی در UAT_GOLDEN_JOURNEY.md و evidence/e2e-final.log | سرعت کنترل‌شده؛ تست ظرفیت نیست |
| مرورگر | شکاف در persistent browser / فرمول گزینه / motion / 404 | سه probe واقعی Chrome و fixture backend واقعی | tests/e2e/uat-probes.spec.ts | اجرای اولیه ۳/۳ pass؛ هر سه در گیت نهایی ۳۷ pass/یک skip نیز موفق شدند | شبیه‌ساز عرض، Safari/Android واقعی نیست |

گیج کوچک و اصلاح جداکننده سال/شرط رشته از قبل در working tree مالک بودند. آن‌ها حفظ و در snapshot آزموده شدند؛ به‌عنوان اصلاح کشف‌شده این ممیزی گزارش نمی‌شوند. هیچ push، force push، نصب سیستمی، تغییر DNS/SSH/Firewall، ارسال واقعی SMS/SMTP یا inference پولی انجام نشد.

گیت نهایی: typecheck، lint و production build موفق؛ backend ۱۳۲ pass/صفر fail/صفر skip؛ مرورگر ۳۷ pass/صفر fail/یک skip اختیاری مدل واقعی. باگ OCR بسته و مورد کیفیت پیش‌نویس AI-008 صریحاً FAIL/P2 باز است.
