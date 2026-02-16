// app/reset/page.tsx
import { Suspense } from "react";
import ResetClient from "./reset-client";

export const dynamic = "force-dynamic"; // プリレンダー回避（重要）

export default function ResetPage() {
  return (
    <Suspense fallback={<div className="p-6">loading...</div>}>
      <ResetClient />
    </Suspense>
  );
}