"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowRight, Loader2, LogIn } from "lucide-react";
import { setLocalSession } from "@/lib/session";
import { useToast } from "@/components/Toast";

/**
 * /login — email-only "log back in" for the beta scaffold.
 *
 * No passwords: the tenant typed this email at /signup, so entering it
 * again re-attaches this browser to the same tenant. Lets a user who
 * logged out (or switched device/browser) get back into their account.
 */
export default function LoginPage() {
  const toast = useToast();
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    if (!email.trim()) {
      toast.show("メールアドレスを入力してください", "error");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const json = (await res.json()) as {
        ok?: boolean;
        tenant_id?: string;
        user_id?: string;
        company_name?: string;
        error?: string;
      };
      if (!res.ok || !json.ok || !json.tenant_id || !json.user_id) {
        toast.show(json.error ?? "ログインに失敗しました", "error");
        return;
      }
      setLocalSession(json.tenant_id, json.user_id);
      toast.show(
        json.company_name
          ? `${json.company_name} としてログインしました`
          : "ログインしました"
      );
      window.location.href = "/dashboard";
    } catch (err) {
      toast.show(
        "通信エラー: " + (err instanceof Error ? err.message : String(err)),
        "error"
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-brand-50 via-white to-emerald-50 px-4 py-10">
      <div className="w-full max-w-md card p-8">
        <Link href="/" className="flex items-center gap-2 mb-6">
          <div className="w-8 h-8 rounded bg-brand-600 text-white flex items-center justify-center font-bold">
            B
          </div>
          <span className="font-bold text-gray-900">BukkenLink</span>
        </Link>

        <h1 className="text-2xl font-bold text-gray-900 mb-2">ログイン</h1>
        <p className="text-sm text-gray-500 mb-6">
          登録済みのメールアドレスを入力してください。
          <br />
          (パスワードは不要です)
        </p>

        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="label">
              メールアドレス <span className="text-red-500">*</span>
            </label>
            <input
              type="email"
              className="input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="info@example.com"
              autoFocus
              required
            />
            <p className="text-xs text-gray-500 mt-1">
              サインアップ時に登録したメールアドレスです。
            </p>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="btn-primary w-full text-base py-2.5"
          >
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                確認中...
              </>
            ) : (
              <>
                <LogIn className="w-4 h-4" />
                ログイン
              </>
            )}
          </button>
        </form>

        <div className="mt-6 pt-5 border-t border-gray-200 text-center">
          <p className="text-sm text-gray-500">アカウントをお持ちでないですか?</p>
          <Link
            href="/signup"
            className="inline-flex items-center gap-1 text-sm font-medium text-brand-600 hover:underline mt-1"
          >
            無料で始める
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>
    </div>
  );
}
