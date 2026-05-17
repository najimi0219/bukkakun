"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowRight, Loader2, Sparkles } from "lucide-react";
import { setLocalSession } from "@/lib/session";
import { useToast } from "@/components/Toast";

export default function SignupPage() {
  const toast = useToast();
  const [companyName, setCompanyName] = useState("");
  const [contactName, setContactName] = useState("");
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    if (!companyName.trim() || !contactName.trim() || !email.trim()) {
      toast.show("会社名・担当者名・メールアドレスは必須です", "error");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/signup-tenant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          company_name: companyName,
          contact_name: contactName,
          email,
        }),
      });
      const json = (await res.json()) as {
        ok?: boolean;
        tenant_id?: string;
        user_id?: string;
        error?: string;
      };
      if (!res.ok || !json.ok || !json.tenant_id || !json.user_id) {
        toast.show(json.error ?? "サインアップに失敗しました", "error");
        return;
      }
      setLocalSession(json.tenant_id, json.user_id);
      toast.show(`${companyName} のアカウントを作成しました`);
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

        <div className="mb-5 p-3 rounded bg-emerald-50 border border-emerald-200 flex items-start gap-2">
          <Sparkles className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
          <div className="text-xs text-emerald-800 leading-relaxed">
            ベータ版・無料公開中。すべての機能を費用なしでお試しいただけます。
          </div>
        </div>

        <h1 className="text-2xl font-bold text-gray-900 mb-2">無料で始める</h1>
        <p className="text-sm text-gray-500 mb-6">
          会社情報を入力するだけで、すぐに専用の管理画面が使えます。
          <br />
          (パスワード設定は不要)
        </p>

        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="label">
              会社名 <span className="text-red-500">*</span>
            </label>
            <input
              className="input"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder="株式会社○○不動産"
              autoFocus
              required
            />
          </div>
          <div>
            <label className="label">
              担当者名 <span className="text-red-500">*</span>
            </label>
            <input
              className="input"
              value={contactName}
              onChange={(e) => setContactName(e.target.value)}
              placeholder="山田 太郎"
              required
            />
          </div>
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
              required
            />
            <p className="text-xs text-gray-500 mt-1">
              問い合わせ通知の宛先 / 自動返信メールの Reply-To に設定されます
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
                作成中...
              </>
            ) : (
              <>
                アカウントを作成
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>

          <p className="text-xs text-gray-500 text-center mt-2">
            <Link href="/privacy" target="_blank" className="underline hover:text-gray-700">
              プライバシーポリシー
            </Link>{" "}
            に同意の上ご利用ください。
          </p>
        </form>
      </div>
    </div>
  );
}
