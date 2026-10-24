# برنامه اجرا

- [x] ۰. مطالعه PRD، ثبت تصمیم‌ها، مدل داده، قرارداد و جریان‌ها
- [x] ۱. زیرساخت monorepo، TypeScript/Lint/Build، اتصال MongoDB و session
- [x] ۲. دعوت و پذیرش، محتوای پویا و بانک سؤال نسخه‌دار
- [x] ۳. مأموریت و تخصیص، تلاش قطعی و راهنمایی محدود اتمیک
- [x] ۴. گزارش دو نقش و review با تاریخچه
- [x] ۵. رابط کامل RTL و PWA shell
- [x] ۶. unit/integration روی MongoDB واقعی، کنترل مجوز و failure provider
- [ ] ۷. پایلوت: رضایت/حذف/backup، idempotency، محتوای علمی، مرورگرهای بیشتر، سنجش ضمیمه، دفترچه و mastery

در هر فاز check مشترک اجرا و نتیجه واقعی در QUALITY_REPORT.md ثبت می‌شود. فاز ۷ شرط آمادگی پایلوت عمومی است.

- [x] ۶.۱. E2E مرورگر Chrome دسکتاپ و موبایل با MongoDB واقعی؛ اسکرین‌شات در docs
- [x] ۶.۲. آزمون shell آفلاین PWA و عدم کش API خصوصی

اتمام این مراحل به معنی تکمیل کل P0 سند اصلی نیست؛ موارد فاز ۷ همچنان باز هستند.

## ساختار نهایی و پاک‌سازی

- [x] پروژه واحد Next.js: src/app، src/components، src/server، src/lib
- [x] حذف apps/workspaces، سرور مستقل، تنظیمات و وابستگی‌های بلااستفاده
- [x] تبدیل CSS سفارشی و styleهای JSX به Tailwind؛ فقط import Tailwind در globals.css
- [x] فونت‌های محلی Poppins و IRANSans با next/font/local
- [x] انتقال تست‌ها به tests/unit، tests/integration و tests/e2e
- [x] کنترل نهایی TypeScript، Lint، Build، چهار تست backend و چهار تست مرورگر
