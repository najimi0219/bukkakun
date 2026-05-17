"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  Pencil,
  ExternalLink,
  Copy,
  Download,
  FileText,
  Building2,
  MapPin,
  JapaneseYen,
  Train,
  Calendar,
  Hash,
  Users as UsersIcon,
  RefreshCw,
  CheckCircle2,
} from "lucide-react";
import { useCurrentUser } from "@/lib/auth";
import {
  getDocuments,
  getInquiries,
  getProperty,
  getUser,
  updateProperty,
} from "@/lib/store";
import {
  PROPERTY_TYPE_LABEL,
  STORAGE_PROVIDER_LABEL,
  AVAILABILITY_STATUS_LABEL,
  AVAILABILITY_STATUS_COLOR,
  type AvailabilityStatus,
  type Property,
  type PropertyDocument,
  type Inquiry,
  INQUIRY_STATUS_COLOR,
  INQUIRY_STATUS_LABEL,
} from "@/lib/types";
import { formatYen, formatBytes, relativeTime } from "@/lib/format";
import { QrCodeImage, qrCodeDataUrl } from "@/components/QrCodeImage";
import { StorageProviderIcon } from "@/components/StorageProviderIcon";
import { useToast } from "@/components/Toast";
import { getSupabase, PROPERTY_DOCS_BUCKET } from "@/lib/supabase";

export default function PropertyDetailPage() {
  const params = useParams<{ id: string }>();
  const { tenant } = useCurrentUser();
  const toast = useToast();
  const [property, setProperty] = useState<Property | null>(null);
  const [docs, setDocs] = useState<PropertyDocument[]>([]);
  const [inquiries, setInquiries] = useState<Inquiry[]>([]);

  useEffect(() => {
    const sync = () => {
      const p = getProperty(params.id);
      setProperty(p ?? null);
      if (p) {
        setDocs(getDocuments(p.id));
        setInquiries(
          getInquiries(p.tenant_id).filter((i) => i.property_id === p.id)
        );
      }
    };
    sync();
    window.addEventListener("bukkenlink:dbchange", sync);
    return () => window.removeEventListener("bukkenlink:dbchange", sync);
  }, [params.id]);

  const formUrl = useMemo(() => {
    if (!property) return "";
    if (typeof window === "undefined") return "/form/" + property.form_token;
    return window.location.origin + "/form/" + property.form_token;
  }, [property]);

  const assignees = useMemo(() => {
    if (!property) return [];
    return property.assignee_ids
      .map((id) => getUser(id))
      .filter((u): u is NonNullable<typeof u> => !!u);
  }, [property]);

  const copyUrl = async () => {
    await navigator.clipboard.writeText(formUrl);
    toast.show("フォームURLをコピーしました");
  };

  const downloadQr = async () => {
    const dataUrl = await qrCodeDataUrl(formUrl, 800);
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = "qr-" + (property?.title ?? "property") + ".png";
    a.click();
  };

  const openDocument = async (d: PropertyDocument) => {
    const supabase = getSupabase();
    const { data, error } = await supabase.storage
      .from(PROPERTY_DOCS_BUCKET)
      .createSignedUrl(d.external_file_id, 300);
    if (error || !data?.signedUrl) {
      toast.show(
        "ファイルを開けません: " + (error?.message ?? "URLを取得できませんでした"),
        "error"
      );
      return;
    }
    window.open(data.signedUrl, "_blank", "noreferrer");
  };

  if (!tenant || !property) return null;

  return (
    <div className="p-8 max-w-6xl space-y-6">
      <div>
        <Link
          href="/properties"
          className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-2"
        >
          <ArrowLeft className="w-4 h-4" />
          物件一覧へ戻る
        </Link>
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <span
                className={
                  "badge " +
                  (property.status === "published"
                    ? "bg-emerald-100 text-emerald-700"
                    : "bg-gray-100 text-gray-600")
                }
              >
                {property.status === "published" ? "公開中" : "下書き"}
              </span>
              <span
                className={
                  "badge " +
                  AVAILABILITY_STATUS_COLOR[
                    (property.availability_status ?? "available") as AvailabilityStatus
                  ]
                }
              >
                販売状況: {
                  AVAILABILITY_STATUS_LABEL[
                    (property.availability_status ?? "available") as AvailabilityStatus
                  ]
                }
              </span>
              <span className="badge bg-gray-100 text-gray-700">
                {PROPERTY_TYPE_LABEL[property.property_type]}
              </span>
              {property.reins_id && (
                <span className="badge bg-brand-50 text-brand-700">
                  {property.reins_id}
                </span>
              )}
            </div>
            <h1 className="text-2xl font-bold text-gray-900">{property.title}</h1>
            <p className="text-sm text-gray-500 mt-1">{property.address}</p>
          </div>
          <Link
            href={"/properties/" + property.id + "/edit"}
            className="btn-secondary"
          >
            <Pencil className="w-4 h-4" />
            編集
          </Link>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="card p-6">
            <h2 className="font-semibold text-gray-900 mb-4">物件情報</h2>
            <div className="grid sm:grid-cols-2 gap-4 text-sm">
              <Field icon={JapaneseYen} label="価格" value={formatYen(property.price)} />
              <Field icon={Building2} label="種別" value={PROPERTY_TYPE_LABEL[property.property_type]} />
              <Field icon={MapPin} label="所在地" value={property.address} />
              {property.land_area && (
                <Field icon={MapPin} label="土地面積" value={property.land_area + " ㎡"} />
              )}
              {property.building_area && (
                <Field icon={Building2} label="建物面積" value={property.building_area + " ㎡"} />
              )}
              {property.built_year_month && (
                <Field icon={Calendar} label="築年月" value={property.built_year_month} />
              )}
              {property.transport && (
                <Field icon={Train} label="交通" value={property.transport} />
              )}
              {property.reins_id && (
                <Field icon={Hash} label="レインズ番号" value={property.reins_id} />
              )}
            </div>
            {property.description && (
              <div className="mt-4 pt-4 border-t border-gray-100">
                <div className="text-xs text-gray-500 mb-1">物件概要</div>
                <p className="text-sm text-gray-700 whitespace-pre-wrap">
                  {property.description}
                </p>
              </div>
            )}
            {assignees.length > 0 && (
              <div className="mt-4 pt-4 border-t border-gray-100">
                <div className="text-xs text-gray-500 mb-2 flex items-center gap-1">
                  <UsersIcon className="w-3 h-3" />
                  営業担当
                </div>
                <div className="flex flex-wrap gap-2">
                  {assignees.map((u) => (
                    <span key={u.id} className="badge bg-brand-50 text-brand-700">
                      {u.name}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="card p-6">
            <div className="flex items-start justify-between gap-3 mb-3">
              <div>
                <h2 className="font-semibold text-gray-900 mb-1">
                  販売状況の更新
                </h2>
                <p className="text-xs text-gray-500">
                  公開フォームには「{formatDateTime(property.availability_updated_at ?? property.created_at)} 時点で{AVAILABILITY_STATUS_LABEL[(property.availability_status ?? "available") as AvailabilityStatus]}」と表示されます。
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  updateProperty(property.id, {
                    availability_updated_at: new Date().toISOString(),
                  });
                  toast.show("最終確認日時を更新しました");
                }}
                className="btn-secondary text-sm shrink-0"
                title="状況に変更が無くても「今この時点で同じ状況」と上書き"
              >
                <RefreshCw className="w-4 h-4" />
                情報更新
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {(["available", "reserved", "negotiating", "closed"] as AvailabilityStatus[]).map((s) => {
                const cur = (property.availability_status ?? "available") as AvailabilityStatus;
                const isCurrent = cur === s;
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => {
                      if (isCurrent) return;
                      updateProperty(property.id, {
                        availability_status: s,
                        availability_updated_at: new Date().toISOString(),
                      });
                      toast.show(
                        "販売状況を「" + AVAILABILITY_STATUS_LABEL[s] + "」に更新しました"
                      );
                    }}
                    className={
                      "px-3 py-1.5 rounded border text-sm " +
                      (isCurrent
                        ? "border-brand-500 bg-brand-50 text-brand-700 ring-2 ring-brand-200 cursor-default"
                        : "border-gray-200 bg-white text-gray-700 hover:border-gray-300 cursor-pointer")
                    }
                  >
                    {isCurrent && <CheckCircle2 className="w-3.5 h-3.5 inline mr-1" />}
                    {AVAILABILITY_STATUS_LABEL[s]}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="card p-6">
            <h2 className="font-semibold text-gray-900 mb-4">
              物件資料 ({docs.length}件)
            </h2>
            {docs.length === 0 ? (
              <div className="text-sm text-gray-500 py-4 text-center border border-dashed border-gray-300 rounded">
                まだ資料がアップロードされていません
              </div>
            ) : (
              <ul className="divide-y divide-gray-100">
                {docs.map((d) => (
                  <li key={d.id} className="flex items-center gap-3 py-3">
                    <FileText className="w-5 h-5 text-gray-400 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-gray-900 truncate">
                        {d.file_name}
                      </div>
                      <div className="text-xs text-gray-500 flex items-center gap-2 mt-0.5">
                        <span>{formatBytes(d.file_size)}</span>
                        <span className="text-gray-300">·</span>
                        <span className="inline-flex items-center gap-1">
                          <StorageProviderIcon provider={d.storage_provider} size={12} />
                          {STORAGE_PROVIDER_LABEL[d.storage_provider]}
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      className="text-xs text-brand-600 hover:underline shrink-0 px-2"
                      onClick={() => openDocument(d)}
                    >
                      開く
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="card p-6">
            <h2 className="font-semibold text-gray-900 mb-4">
              この物件の問い合わせ ({inquiries.length}件)
            </h2>
            {inquiries.length === 0 ? (
              <div className="text-sm text-gray-500 py-4 text-center border border-dashed border-gray-300 rounded">
                まだ問い合わせがありません
              </div>
            ) : (
              <ul className="divide-y divide-gray-100">
                {inquiries.map((i) => (
                  <li key={i.id} className="py-3 flex items-start gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-sm text-gray-900">
                          {i.company_name}
                        </span>
                        <span className={"badge " + INQUIRY_STATUS_COLOR[i.status]}>
                          {INQUIRY_STATUS_LABEL[i.status]}
                        </span>
                      </div>
                      <div className="text-xs text-gray-500">
                        {i.contact_name} ・ {i.email}
                      </div>
                    </div>
                    <div className="text-xs text-gray-500 shrink-0">
                      {relativeTime(i.created_at)}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div className="space-y-6">
          <div className="card p-6">
            <h2 className="font-semibold text-gray-900 mb-4">
              フォームURL / QRコード
            </h2>
            <div className="mb-4 p-4 bg-white border border-gray-200 rounded mx-auto max-w-[220px]">
              <QrCodeImage text={formUrl} size={200} />
            </div>
            <div className="flex items-center gap-1 mb-3">
              <input
                readOnly
                value={formUrl}
                className="input text-xs font-mono"
              />
              <button onClick={copyUrl} className="btn-secondary p-2" title="コピー">
                <Copy className="w-4 h-4" />
              </button>
            </div>
            <div className="flex flex-col gap-2">
              <button onClick={downloadQr} className="btn-secondary">
                <Download className="w-4 h-4" />
                QRコードをダウンロード
              </button>
              <a
                href={"/form/" + property.form_token}
                target="_blank"
                rel="noreferrer"
                className="btn-secondary"
              >
                <ExternalLink className="w-4 h-4" />
                フォームを表示
              </a>
            </div>
            <p className="text-xs text-gray-500 mt-3 leading-relaxed">
              QRコードをレインズの物件資料に貼付してください。他業者がスマホで読み取り、フォームから問い合わせ&資料DLが可能になります。
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-2">
      <Icon className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" />
      <div className="min-w-0">
        <div className="text-xs text-gray-500">{label}</div>
        <div className="text-sm text-gray-900 break-words">{value}</div>
      </div>
    </div>
  );
}
