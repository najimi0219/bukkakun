"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/dashboard");
  }, [router]);
  return (
    <div className="min-h-screen flex items-center justify-center text-gray-500">
      認証バイパス中: ダッシュボードへリダイレクト中...
    </div>
  );
}
