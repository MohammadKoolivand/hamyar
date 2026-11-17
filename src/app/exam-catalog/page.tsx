import type { Metadata } from "next";
import ExamCatalogPage from "@/features/content/exam-catalog-page";

export const metadata: Metadata = {
  title: "فهرست موردی آزمون‌ها | هدهد",
  description: "بانک آزمون‌های کنکور و آزمایشی ریاضی و تجربی و متوسطه اول، با تفکیک سال، برگزارکننده، پایه و وضعیت تکمیل.",
};

export default function Page() {
  return <ExamCatalogPage />;
}
