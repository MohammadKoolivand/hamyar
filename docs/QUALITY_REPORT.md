# P0 engineering run

Baseline `541ac2f1531686d1ade3cfa5503df90ae33526de`, clean working tree. Transaction/idempotency/state/security implementation in progress; final verification results will be updated after browser checks. Existing local database copied from standalone 27018 into empty replica set 27019 without changing source; read-only integrity audit reported 0 mismatches.

The previous report below is a historical baseline; its standalone MongoDB and IRANSans distribution assumptions have been superseded by P0.

---

# گزارش کیفیت — ساختار نهایی

## دامنه

یک پروژه Next.js تمام‌استک در ریشه، با Node.js و MongoDB؛ ورودی API مستقل و monorepo حذف شده‌اند. منطق آموزشی و داده‌ها حفظ شده‌اند. تمام استایل‌های رابط utilityهای Tailwind در JSX هستند؛ globals.css فقط import Tailwind را دارد. دو فایل فونت ارائه‌شده با next/font/local بارگذاری می‌شوند.

## کنترل کیفیت

- TypeScript strict: PASS
- ESLint: PASS
- Build تولیدی Next.js 16.4.2 با Turbopack: PASS
- backend unit/integration روی MongoDB واقعی: ۴ تست PASS، صفر failure/skip
- Chrome E2E: چهار تست PASS در ۶٫۱ ثانیه، صفر failure/skip

اجرای اول Turbopack به محدودیت socket در sandbox برخورد کرد. پس از حذف cache همان build و اجرای مجاز، build استاندارد موفق شد؛ نیاز به تغییر به Webpack نبود.

## پوشش تست

تست‌های tests/unit و tests/integration: ارقام فارسی، تلورانس، مرجع نامعتبر، بررسی انسانی، ثبت‌نام و نشست، دعوت و ارتباط چندمعلمی، انتشار، تلاش و کمک با محدودیت هم‌زمان، نرخ استقلال، گزارش شواهد، بازبینی با تاریخچه، عدم افشای مرجع یا یادداشت خصوصی، جلوگیری از دسترسی معلم/دانش‌آموز نامرتبط، قطع Provider و حفظ پاسخ، سنجش بدون کمک، Origin و خروج.

تست‌های tests/e2e: جریان کامل معلم و دانش‌آموز در context مجزا، عرض موبایل 390px بدون سرریز، گزارش‌های دو نقش، shell آفلاین بدون API خصوصی، header no-store و محدودیت 413، بارگذاری واقعی فونت‌های فارسی/لاتین، utilityهای Tailwind و نبود style attribute در رابط خود برنامه (استایل اعلان دسترس‌پذیری تولیدشده توسط Next.js مستثناست). تصاویر و trace در test-results قرار می‌گیرند و وارد docs نمی‌شوند.

محیط بررسی: MongoDB مجزا روی 27018، دیتابیس E2E برابر hamyar_browser با حساب‌های مصنوعی @test.dev. دیتابیس‌های integration تصادفی پس از تست حذف می‌شوند. رابط و API هر دو روی http://127.0.0.1:5174 هستند.

## قابلیت عملیاتی

ثبت‌نام معلم، ورود/خروج، دعوت زمان‌دار بدون ارسال ایمیل، عضویت/ارتباط چندمعلمی، ساختار آموزشی پویا، سؤال مرجع‌دار numeric/choice/short/essay، ساخت و انتشار مأموریت، ثبت تلاش و کمک، سنجش مستقل در سطح مأموریت، گزارش دو نقش با شواهد و تاریخچه بازبینی.

Mock Provider فقط راهنمای تأییدشده معلم را بازمی‌گرداند؛ مدل مولد یا تشخیص خطای مفهومی متصل نیست. پاسخ تشریحی نیازمند بررسی انسان است.

## باقی‌مانده برای پایلوت

- transaction/recovery و idempotency کامل میان reserve شمارنده و insert event؛ crash بین نوشتن‌ها می‌تواند سهمیه بدون رویداد ایجاد کند.
- دفترچه اشتباهات اختصاصی، mastery معتبر و سنجش پایانی ضمیمه.
- ویرایش نسخه سؤال و پیش‌نویس، مهلت مأموریت، لغو رابطه، تأیید ایمیل و بازیابی رمز.
- رضایت افراد کم‌سن، نگهداری/حذف داده، backup/restore، HTTPS استقرار، تست بار و WCAG audit کامل.
- Provider مولد، موتور نمادین و واحدها، بودجه مصرف مالی، محتوای علمی معتبر و پایلوت واقعی.
- نصب PWA در سیستم‌عامل و مرورگرهای Safari/Firefox آزموده نشده؛ ثبت پاسخ آفلاین وجود ندارد.

تمام P0های PRD هنوز کامل نشده‌اند؛ این نسخه برش عملیاتی برای توسعه و تست محلی است.
