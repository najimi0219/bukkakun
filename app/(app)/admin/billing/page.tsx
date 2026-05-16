"use client";

import { useEffect, useState } from "react";
import { ShieldCheck, AlertTriangle } from "lucide-react";
import { loadDB } from "@/lib/store";
import { PLAN_LABEL, type Tenant } from "@/lib/types";
import { formatDate } from "@/lib/format";

export default function AdminBillingPage() {
  const [tenants, setTenants] = useState<Tenant[]>([]);

  useEffect(() => {
    const sync = () => setTenants(loadDB().tenants);
    sync();
    window.addEventListener("bukkenlink:dbchange", sync);
    return () => window.removeEventListener("bukkenlink:dbchange", sync);
  }, []);

  const paying = tenants.filter((t) => t.plan !== "free");
  const mrr = paying.reduce(
    (acc, t) => acc + (t.plan === "standard" ? 3980 : 9800),
    0
  );

  return (
    <div className="p-8 space-y-6 max-w-6xl">
      <div className="flex items-center gap-2">
        <ShieldCheck className="w-6 h-6 text-purple-600" />
        <div>
          <h1 className="text-2xl font-bold text-gray-900">課金管理</h1>
          <p className="text-sm text-gray-500">Stripe ダッシュボード連携</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="card p-5">
          <div className="text-xs text-gray-500 mb-1">MRR (月次経常収益)</div>
          <div className="text-3xl font-bold text-gray-900">
            ¥{mrr.toLocaleString()}
          </div>
        </div>
        <div className="card p-5">
          <div className="text-xs text-gray-500 mb-1">有料テナント</div>
          <div className="text-3xl font-bold text-gray-900">
            {paying.length}
            <span className="text-base text-gray-500 ml-1">
              / {tenants.length}
            </span>
          </div>
        </div>
      </div>

      <div className="card p-6">
        <h2 className="font-semibold text-gray-900 mb-4">プラン変更履歴</h2>
        <ul className="divide-y divide-gray-100">
          {tenants.slice(0, 5).map((t) => (
            <li key={t.id} className="py-3 flex items-center justify-between">
              <div>
                <div className="font-medium text-gray-900">{t.name}</div>
                <div className="text-xs text-gray-500">
                  {formatDate(t.created_at)} に登録
                </div>
              </div>
              <span
                className={`badge ${
                  t.plan === "pro"
                    ? "bg-purple-100 text-purple-700"
                    : t.plan === "standard"
                      ? "bg-brand-100 text-brand-700"
                      : "bg-gray-100 text-gray-600"
                }`}
              >
                {PLAN_LABEL[t.plan]}
              </span>
            </li>
          ))}
        </ul>
      </div>

      <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-3 text-sm text-amber-800">
        <AlertTriangle className="w-5 h-5 mt-0.5 shrink-0" />
        <div>
          ベータ期間中は課金が発生しないため、上記の MRR / 有料テナント数は予測値として参照してください。Stripe 連携は正式リリース時に対応予定です。
        </div>
      </div>
    </div>
  );
}
