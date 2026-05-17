import Link from "next/link";
import { AlertCircle } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function VerifyErrorPage({
  searchParams,
}: {
  searchParams: Promise<{ m?: string }>;
}) {
  const sp = await searchParams;
  const message = sp.m ?? "リンクが無効です";

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="card p-8 max-w-md w-full text-center">
        <div className="w-16 h-16 mx-auto rounded-full bg-red-100 flex items-center justify-center mb-4">
          <AlertCircle className="w-9 h-9 text-red-600" />
        </div>
        <h1 className="text-xl font-bold text-gray-900 mb-2">
          リンクを処理できませんでした
        </h1>
        <p className="text-sm text-gray-600 leading-relaxed break-words">
          {message}
        </p>
        <p className="text-xs text-gray-400 mt-4">
          リンクが古い・破損している可能性があります。BukkenLink
          にログインして直接更新してください。
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
