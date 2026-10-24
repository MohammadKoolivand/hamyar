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
  title: "همیار | تمرین آگاهانه",
  description: "همیار تمرین و تحلیل یادگیری تحت هدایت معلم",
  manifest: "/manifest.webmanifest",
};
export const viewport: Viewport = { themeColor: "#233B8F" };
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
      <body className="hamyar-ambient min-h-screen text-[#1f2937] [font-family:var(--font-persian),var(--font-latin),Tahoma,sans-serif] [&_*]:motion-reduce:animate-none [&_*]:motion-reduce:transition-none">
        {children}
      </body>
    </html>
  );
}
