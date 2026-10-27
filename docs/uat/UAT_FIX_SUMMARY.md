# خلاصه اصلاحات Closure

| تغییر | فایل‌های اصلی | علت و اثبات |
|---|---|---|
| کنترل مصرف راهنمای AI | ai/hint-safety.ts؛ ai/tutor.ts؛ modules/authoring.ts؛ modules/practice.ts | تأیید نشدن خروجی خام نامطمئن، schema خروجی، guard قبل از ذخیره/تحویل و فیلتر رویداد تاریخی؛ مرجع و audit خصوصی حفظ شد |
| حفظ راهنمای سالم | hint-safety.ts؛ tests/unit/hint-safety.test.ts | ذکر تعداد/operand معلم با افشای جواب یکی نیست؛ رگرسیون گروه قدیمی حفظ شد و gate raw AI محافظه‌کار ماند |
| PDF دو‌ستونی | imports/text-columns.ts؛ document-engine.ts | قبل۴از۸، بعد۸از۸؛ جداسازی فقط با heading تکراری در هر دو نیمه؛ unit+PDF integration |
| پوشش پذیرش | tests/integration/hint-safety.test.ts؛ document-columns.test.ts؛ closure-boundaries.test.ts؛ tests/e2e/uat-closure.spec.ts |۱۵شناسه leak، مرزگروه۵۰/۵۱، خصوصی‌بودن داده، شمارنده معلم، فرم، مرورگر دوم، تأخیر و دعوت |
| عملیات | tests/unit/deployment-config.test.mjs؛ docs/uat/closure-operations-probe.ts | rollback کد بدون restore، قطع/وصل mongod اختصاصی و log production با حذف sentinel |

فیچر مهلت/فیلتر/نمایش نسخه ساخته نشد؛ تصمیم POST_MVP پیشنهادی مستند شد. هفت داوری انسانی و Gate داده کودک بسته اعلام نشدند. کد و داده قبلی حفظ شدند؛ push/deploy/تنظیم مقصد یا سرویس پولی انجام نشد. نتایج عددی نهایی در FINAL_RESULTS.json و گزارش اجرای تازه است؛ evidence قدیمی baseline محسوب می‌شود.
