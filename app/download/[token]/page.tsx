"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import {
  FileText,
  Download,
  Clock,
  AlertCircle,
  CheckCircle2,
  Building2,
  ShieldCheck,
} from "lucide-react";
import {
  addDownloadLog,
  getDocuments,
  getInquiryByToken,
  getProperty,
  getTenant,
  initStore,
} from "@/lib/store";
import { getSupabase, PROPERTY_DOCS_BUCKET } from "@/lib/supabase";
import {
  STORAGE_PROVIDER_LABEL,
  type Inquiry,
  type Property,
  type PropertyDocument,
  type Tenant,
} from "@/lib/types";
import { formatDateTime, formatBytes } from "@/lib/format";
import { StorageProviderIcon } from "@/components/StorageProviderIcon";

export default function DownloadPage() {
  const params = useParams<{ token: string }>();
  const [inquiry, setInquiry] = useState<Inquiry | null>(null);
  const [property, setProperty] = useState<Property | null>(null);
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [docs, setDocs] = useState<PropertyDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const sync = () => {
      if (cancelled) return;
      const inq = getInquiryByToken(params.token);
      if (inq) {
        setInquiry(inq);
        const p = getProperty(inq.property_id);
        setProperty(p ?? null);
        if (p) {
          setTenant(getTenant(p.tenant_id) ?? null);
          setDocs(getDocuments(p.id));
        }
      }
      setLoading(false);
    };
    void initStore().then(() => sync());
    window.addEventListener("bukkenlink:dbchange", sync);
    return () => {
      cancelled = true;
      window.removeEventListener("bukkenlink:dbchange", sync);
    };
  }, [params.token]);

  const expired = inquiry
    ? new Date(inquiry.token_expires_at).getTime() < Date.now()
    : false;
  const limitReached = inquiry
    ? inquiry.download_count >= inquiry.download_limit
    : false;

  const onDownload = async (doc: PropertyDocument) => {
    if (!inquiry || expired || limitReached) return;
    setDownloading(doc.id);
    try {
      const supabase = getSupabase();
      const { data, error } = await supabase.storage
        .from(PROPERTY_DOCS_BUCKET)
        .createSignedUrl(doc.external_file_id, 60, {
          download: doc.file_name,
        });
      if (error || !data?.signedUrl) {
        alert(
          "この資料はデモ用のプレースホルダーで、実ファイルがありません。\n" +
            "物件編集画面から実ファイルをアップロードするとダウンロードできます。\n\n" +
            "(" + (error?.message ?? "no signed url") + ")"
        );
        return;
      }
      addDownloadLog({
        inquiry_id: inquiry.id,
        document_id: doc.id,
        ip_address: "203.0.113." + Math.floor(Math.random() * 200),
        user_agent: typeof navigator !== "undefined" ? navigator.userAgent : "",
      });
      const a = document.createElement("a");
      a.href = data.signedUrl;
      a.download = doc.file_name;
      a.click();
    } finally {
      setDownloading(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-500">
        読み込み中...
      </div>
    );
  }

  if (!inquiry || !property || !tenant) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="card p-8 max-w-md text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h1 className="text-xl font-bold text-gray-900 mb-2">無効なURLです</h1>
          <p className="text-sm text-gray-500">
            ダウンロードURLが正しくないか、無効化されている可能性があります。
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center gap-3">
          {tenant.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={tenant.logo_url}
              alt={tenant.name}
              className="h-8 max-w-[160px] object-contain"
            />
          ) : (
            <div className="w-8 h-8 rounded bg-brand-600 text-white flex items-center justify-center font-bold">
              {tenant.name.charAt(0)}
            </div>
          )}
          <div>
            <div className="font-semibold text-gray-900 text-sm">{tenant.name}</div>
            <div className="text-xs text-gray-500">{tenant.license_number}</div>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        <div>
          <div className="text-xs text-gray-500 mb-1 flex items-center gap-1">
            <Building2 className="w-3 h-3" />
            資料ダウンロード
          </div>
          <h1 className="text-2xl font-bold text-gray-900">{property.title}</h1>
          <p className="text-sm text-gray-500 mt-1">{property.address}</p>
        </div>

        {expired && (
          <div className="card p-4 border-red-200 bg-red-50 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 mt-0.5" />
            <div className="text-sm text-red-800">
              <strong>有効期限が切れています。</strong>
              <br />
              元付業者に新しいダウンロードURLの発行を依頼してください。
            </div>
          </div>
        )}

        {!expired && limitReached && (
          <div className="card p-4 border-amber-200 bg-amber-50 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5" />
            <div className="text-sm text-amber-800">
              <strong>ダウンロード回数の上限に達しました。</strong>
              <br />
              元付業者にお問い合わせください。
            </div>
          </div>
        )}

        {!expired && !limitReached && (
          <div className="card p-4 border-emerald-200 bg-emerald-50 flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 mt-0.5" />
            <div className="text-sm text-emerald-800">
              ダウンロード可能です。下記から必要な資料を取得してください。
            </div>
          </div>
        )}

        {docs.length > 0 && docs.some((d) => d.storage_provider !== "bukkenlink") && (
          <div className="card p-4 border-emerald-200 bg-emerald-50/40 flex items-start gap-3 text-sm">
            <ShieldCheck className="w-5 h-5 text-emerald-600 mt-0.5 shrink-0" />
            <div className="text-gray-700">
              この資料は <strong>{tenant.name}</strong> のクラウドストレージから直接配信されます。
              ダウンロードボタンを押すと、短命の署名付きURLが発行され安全に転送されます。
            </div>
          </div>
        )}

        <div className="card divide-y divide-gray-100">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="font-semibold text-gray-900">資料一覧</h2>
            <div className="grid sm:grid-cols-3 gap-3 mt-3 text-sm">
              <div>
                <div className="text-xs text-gray-500">ダウンロード回数</div>
                <div className="text-gray-900 font-medium">
                  {inquiry.download_count} / {inquiry.download_limit} 回
                </div>
              </div>
              <div>
                <div className="text-xs text-gray-500 flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  有効期限
                </div>
                <div className="text-gray-900 font-medium">
                  {formatDateTime(inquiry.token_expires_at)}
                </div>
              </div>
              <div>
                <div className="text-xs text-gray-500">受付番号</div>
                <div className="text-gray-900 font-mono text-xs">
                  {inquiry.id.slice(0, 16)}
                </div>
              </div>
            </div>
          </div>

          {docs.length === 0 ? (
            <div className="p-8 text-center text-gray-500 text-sm">
              ダウンロード可能な資料がありません
            </div>
          ) : (
            docs.map((d) => (
              <div
                key={d.id}
                className="flex items-center gap-4 px-6 py-4 hover:bg-gray-50"
              >
                <div className="w-10 h-10 rounded bg-red-50 text-red-600 flex items-center justify-center shrink-0">
                  <FileText className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-gray-900 truncate">
                    {d.file_name}
                  </div>
                  <div className="text-xs text-gray-500 flex items-center gap-2 mt-0.5">
                    <span>{formatBytes(d.file_size)}</span>
                    <span className="text-gray-300">·</span>
                    <span className="inline-flex items-center gap-1">
                      <StorageProviderIcon
                        provider={d.storage_provider}
                        size={12}
                      />
                      {STORAGE_PROVIDER_LABEL[d.storage_provider]} から配信
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => onDownload(d)}
                  disabled={expired || limitReached || downloading === d.id}
                  className="btn-primary min-w-[110px] justify-center"
                >
                  {downloading === d.id ? (
                    <>
                      <span className="inline-block w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      取得中…
                    </>
                  ) : (
                    <>
                      <Download className="w-4 h-4" />
                      DL
                    </>
                  )}
                </button>
              </div>
            ))
          )}
        </div>

        <div className="text-xs text-gray-500 leading-relaxed">
          ※ ダウンロードはアクセスログ(IP・日時・User Agent)が記録されます。
          資料の二次配布・転載は固くお断りいたします。
        </div>

        <footer className="text-center text-xs text-gray-400 py-4">
          Powered by BukkenLink
        </footer>
      </main>
    </div>
  );
}
