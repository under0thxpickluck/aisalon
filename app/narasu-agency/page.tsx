// app/narasu-agency/page.tsx
"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { setGatePassed } from "@/lib/narasu-agency/storage";

export default function NarasuGatePage() {
  const router = useRouter();

  useEffect(() => {
    setGatePassed();
    router.replace("/narasu-agency/terms");
  }, [router]);

  return null;
}
