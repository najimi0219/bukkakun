import type { Metadata } from "next";
import "./globals.css";
import { ToastProvider } from "@/components/Toast";

export const metadata: Metadata = {
  title: "BukkenLink - 物件問い合わせ管理SaaS",
  description: "レインズ掲載物件への問い合わせを効率化するSaaS",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body className="min-h-screen text-gray-900">
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
