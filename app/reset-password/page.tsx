"use client";

import Link from "next/link";
import { useState } from "react";
import { useToast } from "@/components/Toast";

export default function ResetPasswordPage() {
  const toast = useToast();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSent(true);
    toast.show("パスワード再設定用のリンクを送信しました");
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-brand-50 to-white px-4">
      <div className="w-full max-w-md card p-8">
        <Link href="/" className="flex items-center gap-2 mb-6">
          <div className="w-8 h-8 rounded bg-brand-600 text-white flex items-center justify-center font-bold">
            B
          </div>
          <span className="font-bold text-gray-900">BukkenLink</span>
        </Link>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          パスワード再設定
        </h1>
        <p className="text-sm text-gray-500 mb-6">
          ご登録のメールアドレスに再設定リンクを送信します
        </p>

        {sent ? (
          <div className="space-y-4">
            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-md text-sm text-emerald-800">
              <strong>{email}</strong> 宛に再設定リンクを送信しました。
              <br />
              メールをご確認ください。
            </div>
            <Link href="/login" className="btn-secondary w-full">
              ログインに戻る
            </Link>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <label className="label">メールアドレス</label>
              <input
                type="email"
                className="input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoFocus
              />
            </div>
            <button type="submit" className="btn-primary w-full">
              再設定リンクを送信
            </button>
            <Link
              href="/login"
              className="block text-center text-sm text-gray-600 hover:underline"
            >
              ログインに戻る
            </Link>
          </form>
        )}
      </div>
    </div>
  );
}
