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
  css.textContent =
    "@page{size:A4;margin:15mm}body{background:white!important;color:black!important}article{break-inside:avoid;margin:0 0 8mm;padding:4mm;border:1px solid #ddd}img{max-width:100%;height:auto}h1{font-size:20px;margin-bottom:8mm}.katex{color:black}";
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
