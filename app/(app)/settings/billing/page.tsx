"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Check, CreditCard, Cloud, ArrowRight } from "lucide-react";
import { useCurrentUser } from "@/lib/auth";
import {
  getDocuments,
  getInquiries,
  getProperties,
  getStorageConnections,
  resetDB,
  updateTenant,
} from "@/lib/store";
import { useRouter } from "next/navigation";
import {
  STORAGE_PROVIDER_COLOR,
  STORAGE_PROVIDER_LABEL,
  type StorageConnection,
} from "@/lib/types";
import { StorageProviderIcon } from "@/components/StorageProviderIcon";
import { formatBytes } from "@/lib/format";
import {
  PLAN_LABEL,
  PLAN_LIMITS,
  type Inquiry,
  type Plan,
  type Property,
} from "@/lib/types";
import { useToast } from "@/components/Toast";

const PLANS: {
  plan: Plan;
  price: string;
  features: string[];
}[] = [
  {
    plan: "free",
    price: "¥0",
    features: ["物件3件まで", "月20問い合わせまで", "メール通知"],
  },
  {
    plan: "standard",
    price: "¥3,980/月",
    features: [
      "物件30件まで",
      "月300問い合わせまで",
      "Slack/LINE/Chatwork通知",
      "メールテンプレート",
      "CSVエクスポート",
    ],
  },
  {
    plan: "pro",
    price: "¥9,800/月",
    features: [
      "物件無制限",
      "問い合わせ無制限",
      "チームメンバー追加可",
      "カスタムドメイン",
      "優先サポート",
    ],
  },
];

export default function BillingPage() {
  const { tenant } = useCurrentUser();
  const toast = useToast();
  const router = useRouter();
  const [props, setProps] = useState<Property[]>([]);
  const [inquiries, setInquiries] = useState<Inquiry[]>([]);
  const [conns, setConns] = useState<StorageConnection[]>([]);
  const [storageUsage, setStorageUsage] = useState<
    Record<string, { count: number; bytes: number }>
  >({});
  const [bukkenlinkBytes, setBukkenlinkBytes] = useState(0);
  const [bukkenlinkCount, setBukkenlinkCount] = useState(0);

  useEffect(() => {
    if (!tenant) return;
    const sync = () => {
      const ps = getProperties(tenant.id);
      setProps(ps);
      setInquiries(getInquiries(tenant.id));
      setConns(getStorageConnections(tenant.id));
      const usage: Record<string, { count: number; bytes: number }> = {};
      let bukLBytes = 0;
      let bukLCount = 0;
      ps.forEach((p) => {
        getDocuments(p.id).forEach((d) => {
          if (d.storage_connection_id) {
            if (!usage[d.storage_connection_id]) {
              usage[d.storage_connection_id] = { count: 0, bytes: 0 };
            }
            usage[d.storage_connection_id].count += 1;
            usage[d.storage_connection_id].bytes += d.file_size;
          } else {
            bukLBytes += d.file_size;
            bukLCount += 1;
          }
        });
      });
      setStorageUsage(usage);
      setBukkenlinkBytes(bukLBytes);
      setBukkenlinkCount(bukLCount);
    };
    sync();
    window.addEventListener("bukkenlink:dbchange", sync);
    return () => window.removeEventListener("bukkenlink:dbchange", sync);
  }, [tenant]);

  const onSelectPlan = (plan: Plan) => {
    if (!tenant) return;
    if (tenant.plan === plan) return;
    if (plan === "free") {
      if (
        !confirm(
          "Freeプランへダウングレードします。物件・問い合わせの制限超過分は使用できなくなります。よろしいですか?"
        )
      )
        return;
      updateTenant(tenant.id, { plan });
      toast.show("Freeプランに変更しました");
    } else {
      if (
        !confirm(
          `${PLAN_LABEL[plan]}プランへ変更します。\n本番環境ではStripe Checkoutが起動します。デモ環境では即時に変更されます。`
        )
      )
        return;
      updateTenant(tenant.id, { plan });
      toast.show(`${PLAN_LABEL[plan]}プランに変更しました`);
    }
  };

  if (!tenant) return null;

  const limits = PLAN_LIMITS[tenant.plan];
  const thisMonth = new Date().toISOString().slice(0, 7);
  const inqCountThisMonth = inquiries.filter((i) =>
    i.created_at.startsWith(thisMonth)
  ).length;

  return (
    <div className="p-8 space-y-6 max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">プラン・請求</h1>
        <p className="text-sm text-gray-500 mt-1">
          現在のプラン:
          <span className="ml-2 badge bg-brand-50 text-brand-700">
            {PLAN_LABEL[tenant.plan]}
          </span>
        </p>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <div className="card p-5">
          <div className="text-xs text-gray-500 mb-1">物件数</div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold text-gray-900">
              {props.length}
            </span>
            <span className="text-sm text-gray-500">
              / {limits.properties === Infinity ? "無制限" : limits.properties}
            </span>
          </div>
          <Progress
            value={
              limits.properties === Infinity
                ? 0
                : Math.min(100, (props.length / limits.properties) * 100)
            }
          />
        </div>
        <div className="card p-5">
          <div className="text-xs text-gray-500 mb-1">今月の問い合わせ</div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold text-gray-900">
              {inqCountThisMonth}
            </span>
            <span className="text-sm text-gray-500">
              / {limits.inquiries === Infinity ? "無制限" : limits.inquiries}
            </span>
          </div>
          <Progress
            value={
              limits.inquiries === Infinity
                ? 0
                : Math.min(100, (inqCountThisMonth / limits.inquiries) * 100)
            }
          />
        </div>
      </div>

      <div className="card p-6">
        <h2 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
          <Cloud className="w-5 h-5 text-brand-600" />
          ストレージ利用状況
        </h2>
        {conns.length === 0 && bukkenlinkCount === 0 ? (
          <div className="text-sm text-gray-500">
            まだファイルがありません
          </div>
        ) : (
          <div className="space-y-2">
            {conns.map((c) => {
              const u = storageUsage[c.id] ?? { count: 0, bytes: 0 };
              return (
                <div
                  key={c.id}
                  className="flex items-center gap-3 p-3 bg-gray-50 rounded"
                >
                  <StorageProviderIcon provider={c.provider} size={20} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-900 truncate">
                      {c.display_name}
                    </div>
                    <div className="text-xs text-gray-500">
                      {STORAGE_PROVIDER_LABEL[c.provider]} · あなたの契約容量を消費
                    </div>
                  </div>
                  <div className="text-sm text-right">
                    <div className="font-medium text-gray-900">
                      {formatBytes(u.bytes)}
                    </div>
                    <div className="text-xs text-gray-500">{u.count}件</div>
                  </div>
                </div>
              );
            })}
            {bukkenlinkCount > 0 && (
              <div className="flex items-center gap-3 p-3 bg-amber-50 border border-amber-200 rounded">
                <Cloud className="w-5 h-5 text-amber-600" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-gray-900">
                    BukkenLink ホスト (Free プラン枠)
                  </div>
                  <div className="text-xs text-amber-700">
                    クラウドストレージに移行することで、無制限&安全になります
                  </div>
                </div>
                <div className="text-sm text-right">
                  <div className="font-medium text-gray-900">
                    {formatBytes(bukkenlinkBytes)}
                  </div>
                  <div className="text-xs text-gray-500">
                    {bukkenlinkCount}件
                  </div>
                </div>
              </div>
            )}
            <Link
              href="/settings/storage"
              className="block text-sm text-brand-600 hover:underline pt-1"
            >
              ストレージを管理 <ArrowRight className="w-3 h-3 inline" />
            </Link>
          </div>
        )}
      </div>

      <div className="card p-6">
        <h2 className="font-semibold text-gray-900 mb-1 flex items-center gap-2">
          <CreditCard className="w-5 h-5 text-brand-600" />
          支払い方法
        </h2>
        <p className="text-sm text-gray-500">
          {tenant.stripe_customer_id
            ? "Stripeで登録済み (デモモード)"
            : "未登録"}
        </p>
      </div>

      <div>
        <h2 className="font-semibold text-gray-900 mb-3">プラン変更</h2>
        <div className="grid md:grid-cols-3 gap-4">
          {PLANS.map((p) => (
            <div
              key={p.plan}
              className={`card p-5 relative ${
                p.plan === tenant.plan ? "ring-2 ring-brand-500" : ""
              }`}
            >
              {p.plan === tenant.plan && (
                <div className="absolute -top-3 left-5 bg-brand-600 text-white text-xs font-medium px-2 py-0.5 rounded">
                  現在のプラン
                </div>
              )}
              <div className="text-sm font-medium text-gray-500">
                {PLAN_LABEL[p.plan]}
              </div>
              <div className="mt-2 mb-4 text-2xl font-bold text-gray-900">
                {p.price}
              </div>
              <ul className="space-y-2 text-sm text-gray-600 mb-4">
                {p.features.map((f) => (
                  <li key={f} className="flex items-start gap-2">
                    <Check className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
              <button
                onClick={() => onSelectPlan(p.plan)}
                disabled={p.plan === tenant.plan}
                className={
                  p.plan === tenant.plan ? "btn-secondary w-full" : "btn-primary w-full"
                }
              >
                {p.plan === tenant.plan ? "ご利用中" : "このプランに変更"}
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="card p-6">
        <h2 className="font-semibold text-gray-900 mb-3">請求履歴</h2>
        <div className="text-sm text-gray-500">
          請求履歴はありません(デモ環境)
        </div>
      </div>

      <div className="card p-6 border-red-200">
        <h2 className="font-semibold text-red-700 mb-2">デモデータをリセット</h2>
        <p className="text-sm text-gray-600 mb-3">
          ローカルストレージのデモデータを初期状態に戻します。すべてのテナント・物件・問い合わせが初期化されます。
        </p>
        <button
          onClick={() => {
            if (!confirm("すべてのデモデータをリセットします。よろしいですか?")) return;
            resetDB();
            toast.show("デモデータをリセットしました");
            router.push("/login");
          }}
          className="btn-danger"
        >
          デモデータをリセット
        </button>
      </div>
    </div>
  );
}

function Progress({ value }: { value: number }) {
  return (
    <div className="mt-3 w-full bg-gray-200 rounded-full h-1.5">
      <div
        className="bg-brand-600 h-1.5 rounded-full"
        style={{ width: `${value}%` }}
      />
    </div>
  );
}
