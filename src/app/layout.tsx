import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
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
      className={`${poppins.variable} ${persian.variable}`}
    >
      <body className="hamyar-ambient min-h-screen text-[#17305E] [font-family:var(--font-persian),var(--font-latin),Tahoma,sans-serif] [&_*]:motion-reduce:animate-none [&_*]:motion-reduce:transition-none">
        {children}
      </body>
    </html>
  );
}
