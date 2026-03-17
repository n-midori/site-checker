"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function Home() {
  const router = useRouter();
  useEffect(() => { router.replace("/projects"); }, [router]);
  return (
    <div style={{ fontFamily: "sans-serif", display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", color: "#555" }}>
      読み込み中...
    </div>
  );
}
