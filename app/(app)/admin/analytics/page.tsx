"use client";

import { useEffect, useMemo, useState } from "react";
import { ShieldCheck } from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { loadDB } from "@/lib/store";
import type { Inquiry, Tenant } from "@/lib/types";

export default function AdminAnalyticsPage() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [inq, setInq] = useState<Inquiry[]>([]);

  useEffect(() => {
    const sync = () => {
      const db = loadDB();
      setTenants(db.tenants);
      setInq(db.inquiries);
    };
    sync();
    window.addEventListener("bukkenlink:dbchange", sync);
    return () => window.removeEventListener("bukkenlink:dbchange", sync);
  }, []);

  const mrr = useMemo(() => {
    return tenants.reduce(
      (acc, t) =>
        acc + (t.plan === "standard" ? 3980 : t.plan === "pro" ? 9800 : 0),
      0
    );
  }, [tenants]);

  const chartData = useMemo(() => {
    const buckets: Record<string, number> = {};
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now);
      d.setMonth(d.getMonth() - i);
      const key = `${d.getFullYear()}/${d.getMonth() + 1}`;
      buckets[key] = 0;
    }
    inq.forEach((i) => {
      const d = new Date(i.created_at);
      const key = `${d.getFullYear()}/${d.getMonth() + 1}`;
      if (key in buckets) buckets[key] += 1;
    });
    return Object.entries(buckets).map(([name, count]) => ({ name, count }));
  }, [inq]);

  const activeUsers = tenants.length;

  return (
    <div className="p-8 space-y-6 max-w-6xl">
      <div className="flex items-center gap-2">
        <ShieldCheck className="w-6 h-6 text-purple-600" />
        <div>
          <h1 className="text-2xl font-bold text-gray-900">統計・分析</h1>
          <p className="text-sm text-gray-500">サービス全体のKPI</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="card p-5">
          <div className="text-xs text-gray-500 mb-1">全体MRR</div>
          <div className="text-3xl font-bold text-gray-900">
            ¥{mrr.toLocaleString()}
          </div>
        </div>
        <div className="card p-5">
          <div className="text-xs text-gray-500 mb-1">アクティブテナント</div>
          <div className="text-3xl font-bold text-gray-900">
            {activeUsers}
          </div>
        </div>
      </div>

      <div className="card p-6">
        <h2 className="font-semibold text-gray-900 mb-4">
          全テナント問い合わせ推移 (月次)
        </h2>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
              <Tooltip />
              <Line
                type="monotone"
                dataKey="count"
                stroke="#1f5cf2"
                strokeWidth={2}
                dot={{ fill: "#1f5cf2" }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
