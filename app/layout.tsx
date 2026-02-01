import "./globals.css";
import type { ReactNode } from "react";
import { ToastHost } from "@/components/Toast";

export const metadata = {
  title: "LIFAI UI",
  description: "LIFAI UI mock",
};

export const viewport = {
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
