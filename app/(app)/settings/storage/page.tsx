"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Plus,
  Star,
  Trash2,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  ExternalLink,
  Folder,
  Cloud,
  ShieldCheck,
} from "lucide-react";
import { useCurrentUser } from "@/lib/auth";
import {
  addStorageConnection,
  deleteStorageConnection,
  getDocuments,
  getProperties,
  getStorageConnections,
  updateStorageConnection,
} from "@/lib/store";
import {
  STORAGE_PROVIDER_COLOR,
  STORAGE_PROVIDER_LABEL,
  type Property,
  type PropertyDocument,
  type StorageConnection,
  type StorageProvider,
} from "@/lib/types";
import { useToast } from "@/components/Toast";
import { StorageConnectModal } from "@/components/StorageConnectModal";
import { StorageProviderIcon } from "@/components/StorageProviderIcon";
import { formatDateTime, relativeTime, formatBytes } from "@/lib/format";

const PROVIDERS: StorageProvider[] = [
  "gdrive",
  "dropbox",
  "onedrive",
  "box",
  "s3",
];

export default function StorageSettingsPage() {
  const { user, tenant } = useCurrentUser();
  const toast = useToast();
  const router = useRouter();
  const search = useSearchParams();

  // Surface OAuth callback results as toasts and then clean the URL.
  useEffect(() => {
    const connected = search.get("connected");
    const err = search.get("connect_error");
    if (connected === "gdrive") {
      toast.show("Google Drive に接続しました");
      router.replace("/settings/storage");
    } else if (err) {
      toast.show("接続に失敗しました: " + err, "error");
      router.replace("/settings/storage");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);
  const [conns, setConns] = useState<StorageConnection[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [docs, setDocs] = useState<PropertyDocument[]>([]);
  const [showModal, setShowModal] = useState<StorageProvider | null>(null);

  useEffect(() => {
    if (!tenant) return;
    const sync = () => {
      setConns(getStorageConnections(tenant.id));
      const ps = getProperties(tenant.id);
      setProperties(ps);
      const allDocs = ps.flatMap((p) => getDocuments(p.id));
      setDocs(allDocs);
    };
    sync();
    window.addEventListener("bukkenlink:dbchange", sync);
    return () => window.removeEventListener("bukkenlink:dbchange", sync);
  }, [tenant]);

  const docCountByConn = useMemo(() => {
    const m: Record<string, { count: number; bytes: number }> = {};
    docs.forEach((d) => {
      if (!d.storage_connection_id) return;
      if (!m[d.storage_connection_id]) m[d.storage_connection_id] = { count: 0, bytes: 0 };
      m[d.storage_connection_id].count += 1;
      m[d.storage_connection_id].bytes += d.file_size;
    });
    return m;
  }, [docs]);

  const onConnect = (
    provider: StorageProvider,
    data: {
      account_email: string;
      root_folder_id: string;
      root_folder_name: string;
      display_name: string;
    }
  ) => {
    if (!tenant) return;
    addStorageConnection({
      tenant_id: tenant.id,
      provider,
      display_name: data.display_name,
      account_email: data.account_email,
      root_folder_id: data.root_folder_id,
      root_folder_name: data.root_folder_name,
      status: "connected",
      is_default: conns.length === 0,
      mock_token_hint:
        provider === "s3"
          ? "AKIA****"
          : provider === "gdrive"
            ? "ya29.****"
            : provider === "dropbox"
              ? "sl.****"
              : "****",
    });
    setShowModal(null);
    toast.show(`${STORAGE_PROVIDER_LABEL[provider]}に接続しました`);
  };

  const setDefault = (id: string) => {
    updateStorageConnection(id, { is_default: true });
    toast.show("デフォルト接続を変更しました");
  };

  const reauth = (id: string) => {
    updateStorageConnection(id, {
      status: "connected",
      last_sync_at: new Date().toISOString(),
    });
    toast.show("再認証しました");
  };

  const onDelete = (c: StorageConnection) => {
    const usingCount = docCountByConn[c.id]?.count ?? 0;
    const msg = usingCount
      ? `「${c.display_name}」を切断します。\n${usingCount}件のファイルがこの接続を参照していますが、ローカルキャッシュは残ります。\nよろしいですか?`
      : `「${c.display_name}」を切断します。よろしいですか?`;
    if (!confirm(msg)) return;
    deleteStorageConnection(c.id);
    toast.show("接続を切断しました");
  };

  if (!tenant || !user) return null;

  const connectedCount = conns.filter((c) => c.status === "connected").length;
  const totalBytes = Object.values(docCountByConn).reduce(
    (acc, v) => acc + v.bytes,
    0
  );

  return (
    <div className="p-8 space-y-6 max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Cloud className="w-6 h-6 text-brand-600" />
          ストレージ接続
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          物件資料の保管先となるクラウドストレージを接続します。資料はあなたのストレージに保管され、BukkenLinkはメタデータと参照のみ保持します。
        </p>
      </div>

      <div className="card p-5 bg-gradient-to-r from-brand-50 to-emerald-50 border-brand-200">
        <div className="flex items-start gap-3">
          <ShieldCheck className="w-6 h-6 text-brand-700 mt-0.5 shrink-0" />
          <div className="text-sm">
            <div className="font-semibold text-gray-900 mb-1">
              データ主権ファースト
            </div>
            <p className="text-gray-700 leading-relaxed">
              資料ファイル本体は <strong>あなたのクラウドストレージにのみ保管</strong>{" "}
              されます。BukkenLink のサーバーには物件メタデータと
              <code className="text-xs bg-white/60 px-1 rounded">file_id</code>{" "}
              への参照しか残りません。漏洩リスクが心配な物件資料を、安心して登録いただけます。
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="card p-4">
          <div className="text-xs text-gray-500">接続中ストレージ</div>
          <div className="text-2xl font-bold text-gray-900 mt-1">
            {connectedCount}
            <span className="text-sm text-gray-500 ml-1">
              / {conns.length}
            </span>
          </div>
        </div>
        <div className="card p-4">
          <div className="text-xs text-gray-500">管理ファイル数</div>
          <div className="text-2xl font-bold text-gray-900 mt-1">
            {docs.length}
          </div>
        </div>
        <div className="card p-4">
          <div className="text-xs text-gray-500">合計サイズ</div>
          <div className="text-2xl font-bold text-gray-900 mt-1">
            {formatBytes(totalBytes)}
          </div>
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-gray-900">接続済みストレージ</h2>
        </div>
        {conns.length === 0 ? (
          <div className="card p-12 text-center">
            <Cloud className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <div className="text-gray-700 font-medium mb-1">
              まだストレージが接続されていません
            </div>
            <p className="text-sm text-gray-500">
              下のボタンから接続を開始してください
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {conns.map((c) => {
              const stat = docCountByConn[c.id];
              return (
                <div key={c.id} className="card p-5">
                  <div className="flex items-start gap-4">
                    <div className="shrink-0">
                      <StorageProviderIcon provider={c.provider} size={36} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <h3 className="font-semibold text-gray-900">
                          {c.display_name}
                        </h3>
                        <span
                          className={`badge ${STORAGE_PROVIDER_COLOR[c.provider]}`}
                        >
                          {STORAGE_PROVIDER_LABEL[c.provider]}
                        </span>
                        {c.is_default && (
                          <span className="badge bg-amber-100 text-amber-700 inline-flex items-center gap-0.5">
                            <Star className="w-3 h-3" />
                            デフォルト
                          </span>
                        )}
                        {c.status === "connected" ? (
                          <span className="badge bg-emerald-100 text-emerald-700 inline-flex items-center gap-0.5">
                            <CheckCircle2 className="w-3 h-3" />
                            接続中
                          </span>
                        ) : c.status === "expired" ? (
                          <span className="badge bg-amber-100 text-amber-700 inline-flex items-center gap-0.5">
                            <AlertCircle className="w-3 h-3" />
                            トークン失効
                          </span>
                        ) : (
                          <span className="badge bg-red-100 text-red-700 inline-flex items-center gap-0.5">
                            <AlertCircle className="w-3 h-3" />
                            エラー
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-gray-500 mb-2">
                        {c.account_email}
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                        <Field
                          icon={Folder}
                          label="保管先"
                          value={c.root_folder_name}
                          mono
                        />
                        <Field
                          label="認証"
                          value={
                            c.provider === "gdrive" && c.refresh_token
                              ? "OAuth (Bearer)"
                              : c.mock_token_hint
                          }
                          mono
                        />
                        <Field
                          label="ファイル数"
                          value={`${stat?.count ?? 0}件 (${formatBytes(stat?.bytes ?? 0)})`}
                        />
                        <Field
                          label="最終同期"
                          value={relativeTime(c.last_sync_at)}
                        />
                      </div>
                    </div>
                    <div className="flex flex-col gap-1">
                      {!c.is_default && c.status === "connected" && (
                        <button
                          onClick={() => setDefault(c.id)}
                          className="btn-ghost text-xs"
                          title="デフォルトに設定"
                        >
                          <Star className="w-4 h-4" />
                        </button>
                      )}
                      {c.status !== "connected" && (
                        <button
                          onClick={() => reauth(c.id)}
                          className="btn-ghost text-xs"
                          title="再認証"
                        >
                          <RefreshCw className="w-4 h-4" />
                        </button>
                      )}
                      <button
                        onClick={() => onDelete(c)}
                        className="btn-ghost text-xs text-red-600"
                        title="切断"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div>
        <h2 className="font-semibold text-gray-900 mb-3">新規接続</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {PROVIDERS.map((p) => {
            const isLive = p === "gdrive";
            const onClick = () => {
              if (isLive) {
                // Hand off to the OAuth start route; it will redirect to
                // Google\'s consent screen and then come back to
                // /settings/storage?connected=gdrive.
                window.location.href =
                  "/api/oauth/google/start?tenant_id=" +
                  encodeURIComponent(tenant.id);
              } else {
                setShowModal(p);
              }
            };
            return (
              <button
                key={p}
                onClick={onClick}
                className="card p-4 text-left hover:border-brand-400 hover:shadow transition-all relative"
              >
                {!isLive && (
                  <span className="absolute top-2 right-2 badge bg-amber-100 text-amber-700 text-[10px]">
                    準備中
                  </span>
                )}
                <div className="flex items-center gap-3 mb-2">
                  <StorageProviderIcon provider={p} size={28} />
                  <div>
                    <div className="font-medium text-gray-900">
                      {STORAGE_PROVIDER_LABEL[p]}
                    </div>
                    <div className="text-xs text-gray-500">
                      {p === "s3"
                        ? "AWS S3 / R2 / B2 等"
                        : isLive
                          ? "OAuth で1クリック接続"
                          : "(OAuth 連携は順次対応)"}
                    </div>
                  </div>
                </div>
                <div className="text-xs text-brand-600 inline-flex items-center gap-1">
                  {isLive ? "接続する" : "プレビュー"}
                  <ExternalLink className="w-3 h-3" />
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="card p-5 border-amber-200 bg-amber-50">
        <h3 className="font-semibold text-amber-900 mb-2 flex items-center gap-2">
          <AlertCircle className="w-5 h-5" />
          ベータ版についてのご案内
        </h3>
        <ul className="text-sm text-amber-800 space-y-1 list-disc pl-5">
          <li>
            外部ストレージ (Google Drive / Dropbox / OneDrive / Box / S3) との
            正式な OAuth 連携は順次対応中です
          </li>
          <li>
            ベータ版では、アップロードされたファイルは BukkenLink の保管領域
            (Supabase Storage) に暗号化して保存されます
          </li>
          <li>
            正式リリース時には、各プロバイダの公式 OAuth フロー (Drive Picker /
            Dropbox Chooser / OneDrive File Picker / STS) に切り替わり、
            ファイルはテナント様自身のストレージにのみ保管されるようになります
          </li>
        </ul>
      </div>

      <StorageConnectModal
        open={showModal !== null}
        provider={showModal ?? "gdrive"}
        defaultEmail={user.email}
        onClose={() => setShowModal(null)}
        onConnect={(data) => onConnect(showModal!, data)}
      />
    </div>
  );
}

function Field({
  icon: Icon,
  label,
  value,
  mono,
}: {
  icon?: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="min-w-0">
      <div className="text-gray-500 flex items-center gap-1">
        {Icon && <Icon className="w-3 h-3" />}
        {label}
      </div>
      <div
        className={`text-gray-900 truncate ${mono ? "font-mono text-[11px]" : ""}`}
      >
        {value}
      </div>
    </div>
  );
}
