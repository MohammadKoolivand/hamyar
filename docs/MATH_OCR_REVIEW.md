# Math OCR تخصصی برای بازبینی آزمون

> **به‌روزرسانی ۱۴۰۵/۰۸/۲۶:** امکان انتخاب محدوده فرمول با کشیدن کادر روی تصویر (ماوس یا لمس)، تنظیم دستی درصدها و ویرایش دستی LaTeX حتی بدون نصب مدل اضافه شده است. یک مجموعهٔ اولیه از **۳ ناحیه کاندید واقعی** از [دفترچه ریاضی تیر ۱۴۰۴](https://dl.aligebra.com/PACKAGES/27/485/1.pdf) در [`benchmarks/math-ocr/konkur-riazi-1404-tir-candidates.json`](../benchmarks/math-ocr/konkur-riazi-1404-tir-candidates.json) ثبت شد. این‌ها از روی نمایش PDF برچسب خورده‌اند، هنوز بازبینی مستقل نشده‌اند و **به‌عنوان نتیجه دقت مدل حساب نمی‌شوند**. اسکریپت benchmark از اجرای نمونهٔ `referenceReviewed: false` جلوگیری می‌کند.
>
> Workflow [`math-ocr-preflight.yml`](../.github/workflows/math-ocr-preflight.yml) روی Staging فقط میزان حافظه، فضای دیسک، Python و فایل‌های وزن را می‌خواند؛ چیزی نصب یا فعال نمی‌کند. نتیجه در GitHub Actions قابل پیگیری است.


وضعیت: پیاده‌سازی اتصال محلی **pix2tex** به‌صورت اختیاری، با کنترل انسانی. **مدل در CI و روی Staging این تغییر نصب نشده و هیچ آزمون دقت روی دفترچه واقعی به‌عنوان PASS ادعا نمی‌شود.**

## رفتار در پنل

در «ورود آزمون» → آزمون پردازش‌شده → «بازبینی پیش‌نویس سؤال» بخش «تشخیص تخصصی فرمول از تصویر» را باز کنید؛ صفحه را انتخاب و محدودهٔ فرمول را با درصدهای x/y/عرض/ارتفاع روی تصویر تعیین کنید. پس از درخواست، LaTeX پیشنهادی با پیش‌نمایش KaTeX دیده می‌شود. فقط پس از تیک تطبیق انسانی، دکمه افزودن به متن فعال می‌شود. پس از افزودن نیز تأیید نهایی سؤال در همان فرم جداگانه ضروری است.

- متن و تصویر اصل PDF محفوظ می‌ماند و هیچ فرمول به‌صورت خودکار در بانک منتشر نمی‌شود.
- تشخیص روی **برش فرمول** است، نه کل PDF یا سؤال. Tesseract همچنان برای متن فارسی استفاده می‌شود.
- برای جلوگیری از اشتباه، فرمول نامعتبر یا LaTeX ناسازگار با KaTeX رد می‌شود. قبول‌شدن syntax به معنی درست‌بودن فرمول نیست.
- مدل confidence کالیبره‌شده برنمی‌گرداند؛ `confidence=null` و `requiresHumanReview=true` هستند.
- هر درخواست owner-scoped است، فقط پیش‌نویس بازبینی را می‌پذیرد، روی فایل رندرشده خصوصی تا پیش از انقضا کار می‌کند و محدوده و نرخ را محدود می‌کند.
- درخواست‌ها در هر فرایند سرور همزمان اجرا نمی‌شوند، timeout دارند و فایل موقت پاک می‌شود.

## نصب مدل روی **سرور مجزا/محیط تأییدشده**

۱. بر اساس [مستندات pix2tex](https://pix2tex.readthedocs.io/en/latest/installation.html) یک محیط Python مجزا بسازید و نسخه‌های سازگار PyTorch/pix2tex را نصب کنید. نصب مدل و وزن‌ها مرحلهٔ **صریح عملیاتی** است؛ runtime نباید وزن دانلود کند. مجوز کتابخانه و فایل وزن را بررسی کنید.

۲. دو فایل غیرعمومی را روی سرور قرار دهید: `config.yaml` مدل و `weights.pth` (از همان نسخه سازگار). checksum و نسخه این دو را در صورت‌جلسه انتشار ثبت کنید. هرگز وزن مدل یا PDF محرمانه را در Git commit نکنید.

۳. متغیرها را روی سرور تنظیم کنید (نه متغیرهای `NEXT_PUBLIC_`):

```env
MATH_OCR_ENABLED=true
MATH_OCR_PYTHON=/opt/hodhod/math-ocr-venv/bin/python
MATH_OCR_CONFIG=/etc/hodhod/math-ocr/config.yaml
MATH_OCR_CHECKPOINT=/etc/hodhod/math-ocr/weights.pth
```

۴. نصب Python با محدودیت CPU/RAM، عدم دسترسی شبکه و بدون دسترسی به credentialهای دیتابیس انجام شود. اسکریپت `scripts/math-ocr-pix2tex.py` تنها فایل برش‌خورده محلی را دریافت می‌کند. در محیط‌های با چند replica باید محدودیت همزمانی سراسری نیز اعمال شود؛ محدودیت فعلی در هر فرایند است.

۵. قبل از فعال‌سازی واقعی، با اسکن تصویری یک دفترچه مجاز و مرور دستی فرمول‌ها صحت مدل و جهت نمایش را بررسی کنید. بدون نصب model، پنل وضعیت «مدل غیرفعال» را صریح نشان می‌دهد و ورود دستی LaTeX همچنان کار می‌کند.

## بنچمارک روی دفترچه‌های واقعی کنکور

منابع پیشنهادی برای نمونهٔ آزمون واقعی:
- [دفترچه ریاضیات کنکور ریاضی اردیبهشت ۱۴۰۴](https://www.aligebra.com/konkur/riazi/dakhel-ordibehesht-1404/).
- [دفترچه ریاضیات کنکور ریاضی تیر ۱۴۰۴](https://www.aligebra.com/konkur/riazi/dakhel-tir-1404/).
- [دفترچه ریاضی ۱۴۰۳](https://www.aligebra.com/konkur/riazi/dakhel-ordibehesht-1403/).

فقط پس از بررسی اجازهٔ دسترسی، PDF را **محلی** دریافت کنید. برای هر کسر، رادیکال، توان، واحد، عبارت مختلط و پرانتز دست‌کم یک ناحیهٔ واقعی را از روی صفحه اصلی انتخاب و LaTeX مرجع را مستقل و دستی بنویسید. manifest JSON مانند نمونه:

```json
[
  {
    "id": "konkur-math-1404-first-example-01",
    "pdf": "/private/exams/konkur-math-1404-first.pdf",
    "page": 2,
    "crop": { "x": 12, "y": 25, "width": 34, "height": 12 },
    "referenceLatex": "x^2+1"
  }
]
```

**مقادیر نمونه در بالا برش و فرمول واقعیِ تأییدشده نیستند** و نباید به‌عنوان نتیجه benchmark استفاده شوند.

اجرای benchmark با مدل نصب‌شده:

```bash
MATH_OCR_ENABLED=true MATH_OCR_PYTHON=/path/to/python \
 MATH_OCR_CONFIG=/private/config.yaml MATH_OCR_CHECKPOINT=/private/weights.pth \
 node --import tsx scripts/benchmark-real-math-ocr.ts /private/manifest.json \
 > /private/math-ocr-results.json
```

گزارش `attempted/exact/error` شامل SHA-256 فایل اصلی است؛ انطباق رشته LaTeX معیار نهایی صحت علمی نیست و فرمول‌های معادل ممکن است متن متفاوت داشته باشند. **تا زمان تأمین مدل و فایل‌های واقعی و اجرای این فرمان، دقت واقعی = اندازه‌گیری‌نشده.**

## مسیر API

- `GET /api/exam-imports/:eid/math-ocr/status`: وضعیت مدل، فقط برای معلم صاحب آزمون.
- `POST /api/exam-imports/:eid/items/:iid/math-ocr`: `{page,crop:{x,y,width,height}}`، خروجی موقت LaTeX بدون ذخیره در بانک.
- کد سرویس: `src/server/imports/math-ocr.ts` و `scripts/math-ocr-pix2tex.py`.
- تست واحد: `tests/unit/math-ocr.test.ts`؛ این تست‌ها مدل واقعی را اجرا نمی‌کنند.
