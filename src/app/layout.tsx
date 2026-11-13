import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "katex/dist/katex.min.css";
import "./globals.css";
const poppins = localFont({
  src: "../assets/fonts/Poppins-Regular.ttf",
  variable: "--font-latin",
  display: "swap",
  adjustFontFallback: false,
  weight: "400",
});
const persian = localFont({
  src: "../assets/fonts/PersianLocal.ttf",
  variable: "--font-persian",
  display: "swap",
  adjustFontFallback: false,
});
const questionText = localFont({
  src: "../assets/fonts/BNazanin-Bold.ttf",
  variable: "--font-question-text",
  preload: true,
  weight: "700",
  display: "swap",
  adjustFontFallback: false,
});
const questionRegular = localFont({
  src: "../assets/fonts/BNazanin-Regular.ttf",
  variable: "--font-question-regular",
  preload: false,
  weight: "400",
  display: "swap",
  adjustFontFallback: false,
});
const questionMath = localFont({
  src: "../assets/fonts/STIXTwoMath-Regular.ttf",
  variable: "--font-question-math",
  preload: false,
  weight: "400",
  display: "swap",
  adjustFontFallback: false,
});
export const metadata: Metadata = {
  title: "هدهد | راهنمای هوشمند یادگیری",
  description:
    "هدهد، راهنمای هوشمند تمرین و تحلیل پیشرفت یادگیری تحت هدایت معلم",
  manifest: "/manifest.webmanifest",
};
export const viewport: Viewport = { themeColor: "#F8FBFF" };
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="fa"
      dir="rtl"
      className={`${poppins.variable} ${persian.variable} ${questionText.variable} ${questionRegular.variable} ${questionMath.variable}`}
    >
      <body className="hamyar-ambient min-h-screen text-[#17305E] [font-family:var(--font-question-text),var(--font-persian),Tahoma,serif] [&_*]:motion-reduce:animate-none [&_*]:motion-reduce:transition-none">
        {children}
      </body>
    </html>
  );
}
