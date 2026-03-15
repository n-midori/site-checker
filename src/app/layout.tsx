import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "SiteCheck - サイトチェック管理ツール",
  description: "チームで使えるサイトチェック管理ツール",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body style={{ margin: 0 }}>{children}</body>
    </html>
  );
}
