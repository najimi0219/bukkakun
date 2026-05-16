"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { CheckCircle2, Mail, Clock, ArrowRight } from "lucide-react";
import { getInquiry } from "@/lib/store";
import type { Inquiry } from "@/lib/types";
import { formatDateTime } from "@/lib/format";

function SuccessContent() {
  const params = useSearchParams();
  const inqId = params.get("inq");
  const [inquiry, setInquiry] = useState<Inquiry | null>(null);

  useEffect(() => {
    if (inqId) setInquiry(getInquiry(inqId) ?? null);
  }, [inqId]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4 py-10">
      <div className="card p-8 max-w-lg w-full text-center">
        <div className="w-16 h-16 mx-auto rounded-full bg-emerald-100 flex items-center justify-center mb-4">
          <CheckCircle2 className="w-9 h-9 text-emerald-600" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          送信が完了しました
        </h1>
        <p className="text-sm text-gray-600 mb-6 leading-relaxed">
          お問い合わせありがとうございます。<br />
          ご入力いただいたメールアドレス宛に<br />
          <strong>資料ダウンロードURL</strong>を送信しました。
        </p>

        {inquiry && (
          <div className="bg-gray-50 rounded-lg p-4 text-left text-sm space-y-2 mb-6">
            <div className="flex items-start gap-2">
              <Mail className="w-4 h-4 text-gray-400 mt-0.5" />
              <div>
                <div className="text-xs text-gray-500">送信先</div>
                <div className="text-gray-900">{inquiry.email}</div>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <Clock className="w-4 h-4 text-gray-400 mt-0.5" />
              <div>
                <div className="text-xs text-gray-500">DLリンク有効期限</div>
                <div className="text-gray-900">
                  {formatDateTime(inquiry.token_expires_at)}
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="text-xs text-gray-500 leading-relaxed">
          数分経ってもメールが届かない場合は、迷惑メールフォルダをご確認ください。<br />
          それでも届かない場合は元付業者へ直接お問い合わせください。
        </div>

        {inquiry && (
          <a
            href={`/download/${inquiry.download_token}`}
            className="btn-primary mt-6 w-full"
          >
            資料DLページをそのまま開く
            <ArrowRight className="w-4 h-4" />
          </a>
        )}
        <p className="text-xs text-gray-400 mt-2">
          ※ デモのためメール送信は実際には行われません
        </p>
      </div>
    </div>
  );
}

export default function SuccessPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">読み込み中...</div>}>
      <SuccessContent />
    </Suspense>
  );
}
