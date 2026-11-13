# ساده‌سازی Development و انتشار Staging هدهد

## کار روزمره روی لپ‌تاپ

```bash
npm ci             # فقط در ابتدا یا پس از تغییر package-lock.json
npm run dev        # توسعه، بدون build
npm run check      # TypeScript + ESLint + تست‌های سریع؛ بدون build/MongoDB
```

اگر می‌خواهید قبل از انتشار بررسی کامل‌تری روی سیستم آماده انجام دهید: `npm run check:full` (شامل Build و تست‌های یکپارچه؛ نیازمند MongoDB تست). `npm run build` در اجرای محلی روزمره لازم نیست.

## به‌روزرسانی سایت Staging

1. تغییرات را روی شاخه `staging` Push کنید.
2. Workflow **Verify HodHod MVP** یک‌بار `npm ci`، Typecheck، Lint، اسکن Secret، تست‌های سریع و **یک‌بار Build** را اجرا می‌کند.
3. پس از موفقیت Verify مربوط به Push همان مخزن، Workflow **Deploy verified staging release** همان Artifact را دانلود می‌کند؛ **روی سرور `npm install` یا `npm run build` اجرا نمی‌کند**.
4. روی سرور `/usr/local/sbin/hodhod-deploy` بررسی پیش از استقرار، Backup، فعال‌سازی، Health Check و در صورت شکست، بازگشت کد به نسخه قبلی را انجام می‌دهد. Rollback دیتابیس خودکار نیست.

### تنظیمات یک‌باره لازم

- Environment در GitHub به نام `staging`.
- Secrets: `STAGING_SSH_KEY` و `STAGING_KNOWN_HOSTS` (host key واقعی را از مسیر مورد اعتماد تأیید کنید).
- Variables: `STAGING_HOST`، `STAGING_USER`، `STAGING_PORT`.
- سرور از قبل Bootstrapped باشد و اسکریپت `ops/deploy-staging.sh` با بررسی اپراتور به‌صورت root-owned در `/usr/local/sbin/hodhod-deploy` نصب شده باشد؛ `sudo` برای اکانت Deploy فقط روی همین فرمان محدود شده باشد.
- فایل محیطی و Secretها روی سرور باقی می‌مانند و در Artifact قرار نمی‌گیرند.

> توجه: این Workflow به‌روزرسانی **Staging** است، نه Production. بدون تنظیم سرور و مجوزهای بالا انتشار انجام نمی‌شود. اگر برای Environment `staging` تأییدیه دستی گذاشته‌اید، GitHub همچنان قبل از Deploy آن را می‌خواهد.

## کارهای سنگین و اختیاری

Workflow **Deep HodHod verification** دیگر هفتگی خودکار اجرا نمی‌شود و از تب Actions به‌صورت دستی اجرا می‌شود؛ شامل MongoDB، مرورگر، OCR و E2E است. تست‌های امنیتی را حذف نکرده‌ایم، فقط اجرای پرهزینه را جدا کرده‌ایم. برای انتشار عمومی با کاربران واقعی، نتیجهٔ موفق بررسی‌های یکپارچه و امنیتی همچنان ضروری است.

## محدودیت‌ها

- اجرای Workflowها و اتصال واقعی سرور در این بسته تست نشده است.
- Verify روی Pull Request هم اجرا می‌شود، اما فقط Push موفق به `staging` می‌تواند Deploy را شروع کند.
- اگر Commit جدیدتری وارد `staging` شده باشد، Deploy قدیمی کنار گذاشته می‌شود.
