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
    .pdf-question-head{display:flex;align-items:baseline;gap:2mm;flex-wrap:wrap}
    .pdf-number{flex-shrink:0}
    .pdf-statement{flex:1;min-width:0;font-weight:700}
    .pdf-source{font-size:9pt;font-weight:700;border:0;border-radius:5px;padding:0.5mm 2mm;white-space:nowrap;background:#eff6ff;color:#1e3a5f;-webkit-print-color-adjust:exact;print-color-adjust:exact}
    .pdf-options{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:1mm 4mm;margin:1.5mm 6mm 0 0;padding:0;list-style:none}
    .pdf-options.pdf-options-long{grid-template-columns:1fr}
    .pdf-option{display:flex;align-items:baseline;gap:1.5mm;min-width:0}
    .pdf-visuals figure{border:0;padding:0;margin:2mm 0;max-width:75mm}
    .pdf-visuals figcaption{display:none}
    img,svg{max-width:100%;height:auto}
    .katex{color:black}.hy-question-text{font-size:inherit!important;line-height:inherit!important}
    .pdf-question p{margin:0}`;
  doc.head.appendChild(css);
  doc.body.appendChild(content.cloneNode(true));
  try {
    await Promise.all(loaded);
    await doc.fonts.ready;
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
