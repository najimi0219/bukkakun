import Link from "next/link";
import { CheckCircle2 } from "lucide-react";

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<string, string> = {
  available: "公開中",
  reserved: "申込あり",
  negotiating: "商談中",
  closed: "終了",
};

/**
 * /properties/[id]/verified?status=...&at=...
 *
 * 確認メールのリンクをクリックした後の着地ページ。
 * 管理画面と違い、認証も Supabase ロードも不要 — URL のクエリだけで
 * 結果を提示する軽量ページ。
 */
export default async function VerifiedLandingPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; at?: string }>;
}) {
  const sp = await searchParams;
  const status = sp.status ?? "available";
  const label = STATUS_LABEL[status] ?? status;
  const at = sp.at ? new Date(sp.at) : null;
  const atText = at
    ? at.toLocaleString("ja-JP", { hour12: false })
    : "今";

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="card p-8 max-w-md w-full text-center">
        <div className="w-16 h-16 mx-auto rounded-full bg-emerald-100 flex items-center justify-center mb-4">
          <CheckCircle2 className="w-9 h-9 text-emerald-600" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          更新しました
        </h1>
        <p className="text-sm text-gray-600 leading-relaxed">
          物件の販売状況を
          <strong className="mx-1">「{label}」</strong>
          に更新しました。
          <br />
          (最終確認: {atText})
        </p>
        <p className="text-xs text-gray-400 mt-4">
          ご対応ありがとうございました。
        </p>
        <div className="mt-6">
          <Link href="/" className="text-sm text-brand-600 hover:underline">
            BukkenLink トップへ
          </Link>
        </div>
      </div>
    </div>
  );
}
