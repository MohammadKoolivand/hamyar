# HamYar — همیار

Next.js تمام‌استک، TypeScript، Tailwind CSS و MongoDB. رابط فارسی RTL؛ فونت‌های محلی Poppins و IRANSans با next/font/local. یک برنامه Node.js، یک پایگاه داده، بدون monorepo یا سرور API جدا.

## ساختار

```text
src/
  app/             صفحات، layout و Route Handlerهای Next.js
  components/      رابط کاربری و مؤلفه‌های ui
  server/          اتصال MongoDB، نشست، ارزیابی و ماژول‌های آموزشی
  lib/             نوع‌های مشترک
  assets/fonts/    فونت‌های محلی
public/            آیکن و manifest
scripts/           تولید service worker از build
tests/            unit، integration و e2e
docs/             PRD، معماری، قرارداد API و وضعیت اجرا
```

## اجرا

Node.js 22+ و MongoDB لازم است.

```sh
npm ci
cp .env.example .env
npm run dev
```

آدرس: http://127.0.0.1:5174. MongoDB پیش‌فرض روی 27017؛ برای MongoDB دیگر MONGO_URL را در .env تنظیم کنید. برای نمونه مجزا:

```sh
mkdir -p .data/mongo
mongod --dbpath .data/mongo --bind_ip 127.0.0.1 --port 27018 --logpath .data/mongo.log
```

در این حالت MONGO_URL=mongodb://127.0.0.1:27018 باشد. Docker اختیاری: `docker compose up -d mongo`.

تولید: `npm run build` سپس `npm start`. در استقرار عمومی HTTPS و COOKIE_SECURE=true لازم است؛ APP_ORIGIN باید origin برنامه باشد.

## استفاده

ثبت‌نام معلم ← ایجاد درس/مبحث و سؤال مرجع‌دار ← دعوت دانش‌آموز و انتقال لینک ← پذیرش و ورود دانش‌آموز ← ساخت و انتشار مأموریت ← تمرین و راهنمای مجاز ← گزارش هر دو نقش و بازبینی معلم.

ایمیل دعوت ارسال نمی‌شود؛ لینک را معلم منتقل می‌کند. Mock Provider فقط راهنمایی‌های تأییدشده معلم را ارائه می‌دهد؛ مدل مولد متصل نیست. تشریحی به بررسی انسانی می‌رود. داده و آمار نمایشی وجود ندارد.

استایل رابط فقط کلاس‌های Tailwind در JSX است. `src/app/globals.css` تنها شامل import ضروری Tailwind است؛ فونت‌ها با next/font/local ثبت می‌شوند. مؤلفه Button از الگوی shadcn/Radix استفاده می‌کند.

## تست

```sh
npm run typecheck
npm run lint
npm run build
# MongoDB آزمایشی روشن باشد؛ پیش‌فرض 27018
npm test
# برنامه Next.js روشن باشد
npm run test:e2e
```

TEST_MONGO_URL و E2E_BASE_URL قابل تنظیم‌اند. Integration دیتابیس تصادفی می‌سازد و فقط همان را پاک می‌کند. E2E حساب مصنوعی @test.dev در دیتابیس برنامه می‌سازد؛ برای آن MONGO_DB=hamyar_browser توصیه می‌شود. اسکرین‌شات و trace در test-results ذخیره می‌شوند.

PWA فقط shell و asset عمومی را cache می‌کند؛ ثبت پاسخ آفلاین ندارد. پروژه برای توسعه و تست محلی است؛ وضعیت کامل پایلوت در مستندات:

- [معماری](docs/ARCHITECTURE.md)
- [مدل داده](docs/DATA_MODEL.md)
- [قرارداد API](docs/API_CONTRACT.md)
- [برنامه اجرا](docs/IMPLEMENTATION_PLAN.md)
- [گزارش کیفیت و محدودیت‌ها](docs/QUALITY_REPORT.md)
