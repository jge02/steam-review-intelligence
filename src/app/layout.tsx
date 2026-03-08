import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Steam 评论智能分析",
  description: "面向发行与运营团队的 Steam 评论分析 agent。",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
