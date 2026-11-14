/** Browser PDF printing preserves Persian shaping and rendered mathematics. */
export async function printQuestions(content: HTMLElement, title: string) {
  const frame = document.createElement("iframe");
  frame.title = "خروجی PDF سؤال‌ها";
  frame.style.cssText =
    "position:fixed;left:-10000px;top:0;width:794px;height:1123px;border:0";
  document.body.appendChild(frame);
  const doc = frame.contentDocument;
  if (!doc || !frame.contentWindow) {
    frame.remove();
    throw new Error("پنجرهٔ چاپ در دسترس نیست");
  }
  doc.documentElement.lang = "fa";
  doc.documentElement.dir = "rtl";
  // next/font defines its font variables on the root, not in the stylesheet alone.
  doc.documentElement.className = document.documentElement.className;
  const base = doc.createElement("base");
  base.href = document.baseURI;
  doc.head.appendChild(base);
  const heading = doc.createElement("title");
  heading.textContent = title;
  doc.head.appendChild(heading);
  const loaded = [
    ...document.head.querySelectorAll('link[rel="stylesheet"], style'),
  ].map((style) => {
    const copy = style.cloneNode(true) as HTMLElement;
    const ready =
      copy.tagName === "LINK"
        ? new Promise<void>((resolve, reject) => {
            copy.onload = () => resolve();
            copy.onerror = () => reject(new Error("استایل چاپ بارگذاری نشد"));
            setTimeout(
              () => reject(new Error("بارگذاری استایل چاپ طول کشید")),
              15000,
            );
          })
        : Promise.resolve();
    doc.head.appendChild(copy);
    return ready;
  });
  const css = doc.createElement("style");
  css.textContent = `@page{size:A4;margin:14mm 16mm}
    body{margin:0;background:white!important;color:#000!important;font-family:var(--font-question-text),"B Nazanin",serif;font-size:13pt;line-height:1.65}
    h1{font-size:17pt;text-align:center;margin:0 0 7mm;padding-bottom:3mm;border-bottom:2px solid black}
    .pdf-question{break-inside:avoid;margin:0 0 4mm;padding:0;border:0}
    .pdf-question-head{display:flex;align-items:baseline;gap:2mm;flex-wrap:wrap;direction:rtl}
    .pdf-number{flex-shrink:0}
    .pdf-statement{flex:1;min-width:0;font-weight:700;text-align:justify;white-space:pre-wrap;overflow-wrap:anywhere}
    .pdf-source{font-family:var(--font-question-regular),"B Nazanin",serif;font-size:8pt;font-weight:400;border:0;border-radius:5px;padding:0.5mm 2mm;white-space:nowrap;background:#eff6ff;color:#1e3a5f;-webkit-print-color-adjust:exact;print-color-adjust:exact}
    .pdf-options{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:1mm 4mm;margin:1.5mm 6mm 0 0;padding:0;list-style:none;direction:rtl;font-family:var(--font-question-regular),"B Nazanin",serif;font-weight:400}
    .pdf-options[data-layout="stack"]{grid-template-columns:minmax(0,1fr)}
    .pdf-option{display:flex;align-items:baseline;gap:1.5mm;min-width:0;font-family:var(--font-question-regular),"B Nazanin",serif;font-weight:400;text-align:justify;overflow-wrap:anywhere}
    .pdf-option .hy-question-text,.pdf-option .hy-question-text math mn,.pdf-option .hy-question-text .katex .hy-math-number{font-family:var(--font-question-regular),"B Nazanin",serif!important;font-weight:400!important}
    .pdf-option-text{min-width:0;flex:1;white-space:pre-wrap;text-align:justify}
    .pdf-option figure{display:block;break-inside:avoid;max-width:75mm;margin:1mm 0 2mm}
    .pdf-option figcaption{display:none}
    .pdf-visuals{direction:ltr;text-align:left}
    .pdf-visuals figure{display:table;border:0;padding:0;margin:2mm 0 2mm 0;max-width:75mm;max-width:min(75mm,100%);margin-right:auto;margin-left:0;direction:rtl;text-align:center}
    .pdf-visuals figcaption{display:none}
    img,svg{max-width:100%;height:auto}
    .katex{color:black}.hy-question-text{font-size:inherit!important;line-height:inherit!important}
    .pdf-statement .hy-question-text{white-space:pre-wrap;text-align:justify}
    .pdf-option .hy-question-text{white-space:pre-wrap;text-align:justify}
    .pdf-question p{margin:0}`;
  doc.head.appendChild(css);
  doc.body.appendChild(content.cloneNode(true));
  try {
    await Promise.all(loaded);
    await doc.fonts.ready;
    // Decide from the actual printed width and loaded fonts, independent of images.
    // Measuring all four options avoids clipping at PDF/A4 widths.
    for (const list of doc.querySelectorAll<HTMLOListElement>(".pdf-options")) {
      const items = Array.from(list.querySelectorAll<HTMLElement>(".pdf-option"));
      if (items.length !== 4 || items.some((item) => item.querySelector("img,svg"))) {
        list.dataset.layout = "stack";
        continue;
      }
      list.dataset.layout = "row";
      const gap = parseFloat(frame.contentWindow!.getComputedStyle(list).columnGap) || 0;
      const available = list.getBoundingClientRect().width;
      const needed = items.reduce((total, item) => {
        const clone = item.cloneNode(true) as HTMLElement;
        clone.style.cssText = "position:absolute;visibility:hidden;width:max-content;max-width:none;white-space:nowrap;";
        list.appendChild(clone);
        const width = clone.getBoundingClientRect().width;
        clone.remove();
        return total + width;
      }, 0) + gap * (items.length - 1);
      if (needed > available + 1) list.dataset.layout = "stack";
    }
    await Promise.all(
      [...doc.images].map((img) => {
        img.loading = "eager";
        return Promise.race([
          img.decode().catch(() => {
            throw new Error(
              "تصویر سؤال بارگذاری نشد؛ پیش از چاپ آن را بررسی کنید",
            );
          }),
          new Promise<never>((_, reject) =>
            setTimeout(
              () => reject(new Error("بارگذاری تصاویر طول کشید")),
              15000,
            ),
          ),
        ]);
      }),
    );
    frame.contentWindow.addEventListener("afterprint", () => frame.remove(), {
      once: true,
    });
    frame.contentWindow.focus();
    frame.contentWindow.print();
    setTimeout(() => frame.remove(), 300000);
  } catch (error) {
    frame.remove();
    throw error;
  }
}
