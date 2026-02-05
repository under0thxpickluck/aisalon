import "./globals.css";
import type { ReactNode } from "react";
import type { Metadata, Viewport } from "next";
import { ToastHost } from "@/components/Toast";

export const metadata: Metadata = {
  title: {
    default: "LIFAI | AI副業コミュニティ",
    template: "%s | LIFAI",
  },
  description: "AI × LIFE × 副業。学びを収益に変えるオンラインサロン。",
  applicationName: "LIFAI",
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "https://aisalon-sigma.vercel.app"),

  // ✅ LINE / X / Facebook のカード表示
  openGraph: {
    type: "website",
    url: "/",
    siteName: "LIFAI",
    title: "LIFAI | AI副業コミュニティ",
    description: "AI × LIFE × 副業。学びを収益に変えるオンラインサロン。",
    images: [
      {
        url: "/ogp2.png",
        width: 1200,
        height: 630,
        alt: "LIFAI",
      },
    ],
    locale: "ja_JP",
  },
  twitter: {
    card: "summary_large_image",
    title: "LIFAI | AI副業コミュニティ",
    description: "AI × LIFE × 副業。学びを収益に変えるオンラインサロン。",
    images: ["/ogp.png"],
  },

  // ✅ アイコン（PWA/タブ）
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icons/icon-192.png" }],
  },
};

export const viewport: Viewport = {
  themeColor: "#0b1022",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ja">
      <body>
        <ToastHost />
        {children}
      </body>
    </html>
  );
}
