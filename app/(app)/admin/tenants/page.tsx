"use client";

import { useEffect, useState } from "react";
import { Building, ShieldCheck } from "lucide-react";
import { loadDB } from "@/lib/store";
import {
  PLAN_LABEL,
  type Inquiry,
  type Property,
  type Tenant,
} from "@/lib/types";
import { formatDate } from "@/lib/format";

export default function AdminTenantsPage() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [props, setProps] = useState<Property[]>([]);
  const [inq, setInq] = useState<Inquiry[]>([]);

  useEffect(() => {
    const sync = () => {
      const db = loadDB();
      setTenants(db.tenants);
      setProps(db.properties);
      setInq(db.inquiries);
    };
    sync();
    window.addEventListener("bukkenlink:dbchange", sync);
    return () => window.removeEventListener("bukkenlink:dbchange", sync);
  }, []);

  return (
    <div className="p-8 space-y-6 max-w-6xl">
      <div className="flex items-center gap-2">
        <ShieldCheck className="w-6 h-6 text-purple-600" />
        <div>
          <h1 className="text-2xl font-bold text-gray-900">テナント一覧</h1>
          <p className="text-sm text-gray-500">スーパー管理者専用</p>
        </div>
      </div>

      <div className="card overflow-hidden">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr className="text-left text-xs font-semibold text-gray-500 uppercase">
              <th className="px-4 py-3">会社名</th>
              <th className="px-4 py-3">プラン</th>
              <th className="px-4 py-3">物件数</th>
              <th className="px-4 py-3">問い合わせ数</th>
              <th className="px-4 py-3">登録日</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {tenants.map((t) => {
              const propsCount = props.filter((p) => p.tenant_id === t.id).length;
              const inqCount = inq.filter((i) => i.tenant_id === t.id).length;
              return (
                <tr key={t.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Building className="w-4 h-4 text-gray-400" />
                      <div>
                        <div className="font-medium text-gray-900">
                          {t.name}
                        </div>
                        <div className="text-xs text-gray-500">
                          {t.license_number}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
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
                  </td>
                  <td className="px-4 py-3 text-gray-600">{propsCount}</td>
                  <td className="px-4 py-3 text-gray-600">{inqCount}</td>
                  <td className="px-4 py-3 text-gray-600">
                    {formatDate(t.created_at)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
