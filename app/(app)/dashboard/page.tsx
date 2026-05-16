"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  Building2,
  Inbox,
  AlertCircle,
  TrendingUp,
  Calendar,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { useCurrentUser } from "@/lib/auth";
import { getInquiries, getProperties } from "@/lib/store";
import {
  INQUIRY_STATUS_COLOR,
  INQUIRY_STATUS_LABEL,
  type Inquiry,
  type Property,
} from "@/lib/types";
import { formatDateTime, relativeTime } from "@/lib/format";

type Period = "daily" | "weekly" | "monthly";

export default function DashboardPage() {
  const { user, tenant } = useCurrentUser();
  const [inquiries, setInquiries] = useState<Inquiry[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [period, setPeriod] = useState<Period>("daily");

  useEffect(() => {
    if (!tenant) return;
    const sync = () => {
      setInquiries(getInquiries(tenant.id));
      setProperties(getProperties(tenant.id));
    };
    sync();
    window.addEventListener("bukkenlink:dbchange", sync);
    return () => window.removeEventListener("bukkenlink:dbchange", sync);
  }, [tenant]);

  const stats = useMemo(() => {
    const now = new Date();
    const today = now.toISOString().slice(0, 10);
    const todayCount = inquiries.filter((i) =>
      i.created_at.startsWith(today)
    ).length;
    const newCount = inquiries.filter((i) => i.status === "new").length;
    const inProgressCount = inquiries.filter(
      (i) => i.status === "in_progress" || i.status === "negotiating"
    ).length;
    const closedCount = inquiries.filter((i) => i.status === "closed").length;
    return { todayCount, newCount, inProgressCount, closedCount };
  }, [inquiries]);

  const chartData = useMemo(() => {
    const buckets: Record<string, number> = {};
    const now = new Date();
    if (period === "daily") {
      for (let i = 13; i >= 0; i--) {
        const d = new Date(now);
        d.setDate(d.getDate() - i);
        const key = `${d.getMonth() + 1}/${d.getDate()}`;
        buckets[key] = 0;
      }
      inquiries.forEach((i) => {
        const d = new Date(i.created_at);
        const diff = (now.getTime() - d.getTime()) / 86400000;
        if (diff <= 14) {
          const key = `${d.getMonth() + 1}/${d.getDate()}`;
          if (key in buckets) buckets[key] += 1;
        }
      });
    } else if (period === "weekly") {
      for (let i = 7; i >= 0; i--) {
        const d = new Date(now);
        d.setDate(d.getDate() - i * 7);
        const key = `${d.getMonth() + 1}/${d.getDate()}週`;
        buckets[key] = 0;
      }
      inquiries.forEach((i) => {
        const d = new Date(i.created_at);
        const diff = (now.getTime() - d.getTime()) / 86400000 / 7;
        if (diff <= 8) {
          const wk = Math.floor(diff);
          const ref = new Date(now);
          ref.setDate(ref.getDate() - wk * 7);
          const key = `${ref.getMonth() + 1}/${ref.getDate()}週`;
          if (key in buckets) buckets[key] += 1;
        }
      });
    } else {
      for (let i = 5; i >= 0; i--) {
        const d = new Date(now);
        d.setMonth(d.getMonth() - i);
        const key = `${d.getFullYear()}/${d.getMonth() + 1}`;
        buckets[key] = 0;
      }
      inquiries.forEach((i) => {
        const d = new Date(i.created_at);
        const key = `${d.getFullYear()}/${d.getMonth() + 1}`;
        if (key in buckets) buckets[key] += 1;
      });
    }
    return Object.entries(buckets).map(([name, count]) => ({ name, count }));
  }, [inquiries, period]);

  const ranking = useMemo(() => {
    const counts: Record<string, number> = {};
    inquiries.forEach((i) => {
      counts[i.property_id] = (counts[i.property_id] ?? 0) + 1;
    });
    return Object.entries(counts)
      .map(([pid, count]) => ({
        property: properties.find((p) => p.id === pid),
        count,
      }))
      .filter((x) => x.property)
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }, [inquiries, properties]);

  const recent = inquiries.slice(0, 5);

  if (!user || !tenant) return null;

  return (
    <div className="p-8 space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">ダッシュボード</h1>
        <p className="text-sm text-gray-500 mt-1">
          {user.name} さん、こんにちは。
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          icon={AlertCircle}
          label="未対応"
          value={stats.newCount}
          color="text-red-600 bg-red-100"
        />
        <StatCard
          icon={TrendingUp}
          label="対応中・商談中"
          value={stats.inProgressCount}
          color="text-blue-600 bg-blue-100"
        />
        <StatCard
          icon={Calendar}
          label="本日の問い合わせ"
          value={stats.todayCount}
          color="text-amber-600 bg-amber-100"
        />
        <StatCard
          icon={Building2}
          label="公開中の物件"
          value={properties.filter((p) => p.status === "published").length}
          color="text-emerald-600 bg-emerald-100"
        />
      </div>

      {/* Chart */}
      <div className="card p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-gray-900">問い合わせ推移</h2>
          <div className="inline-flex rounded-md border border-gray-300 overflow-hidden text-sm">
            {(["daily", "weekly", "monthly"] as Period[]).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-3 py-1.5 ${
                  period === p
                    ? "bg-brand-600 text-white"
                    : "bg-white hover:bg-gray-50"
                }`}
              >
                {p === "daily" ? "日次" : p === "weekly" ? "週次" : "月次"}
              </button>
            ))}
          </div>
        </div>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="count" fill="#1f5cf2" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Ranking */}
        <div className="card p-6">
          <h2 className="font-semibold text-gray-900 mb-4">
            物件別 問い合わせランキング
          </h2>
          {ranking.length === 0 ? (
            <p className="text-sm text-gray-500">まだ問い合わせがありません</p>
          ) : (
            <ul className="space-y-3">
              {ranking.map((r, i) => (
                <li
                  key={r.property!.id}
                  className="flex items-center justify-between"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`w-7 h-7 rounded flex items-center justify-center text-xs font-bold ${
                        i === 0
                          ? "bg-yellow-100 text-yellow-700"
                          : i === 1
                            ? "bg-gray-200 text-gray-700"
                            : i === 2
                              ? "bg-orange-100 text-orange-700"
                              : "bg-gray-100 text-gray-600"
                      }`}
                    >
                      {i + 1}
                    </div>
                    <Link
                      href={`/properties/${r.property!.id}`}
                      className="text-sm text-gray-900 hover:text-brand-600 truncate"
                    >
                      {r.property!.title}
                    </Link>
                  </div>
                  <span className="badge bg-brand-50 text-brand-700">
                    {r.count}件
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Recent inquiries */}
        <div className="card p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-900">最近の問い合わせ</h2>
            <Link
              href="/inquiries"
              className="text-sm text-brand-600 hover:underline"
            >
              すべて表示 →
            </Link>
          </div>
          {recent.length === 0 ? (
            <p className="text-sm text-gray-500">まだ問い合わせがありません</p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {recent.map((i) => {
                const prop = properties.find((p) => p.id === i.property_id);
                return (
                  <li key={i.id} className="py-3 flex items-start gap-3">
                    <Inbox className="w-4 h-4 text-gray-400 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-sm text-gray-900 truncate">
                          {i.company_name}
                        </span>
                        <span
                          className={`badge ${INQUIRY_STATUS_COLOR[i.status]}`}
                        >
                          {INQUIRY_STATUS_LABEL[i.status]}
                        </span>
                      </div>
                      <div className="text-xs text-gray-500 truncate">
                        {prop?.title ?? "(物件不明)"} ・ {i.contact_name}
                      </div>
                    </div>
                    <div className="text-xs text-gray-500 shrink-0">
                      {relativeTime(i.created_at)}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div className="card p-5">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-xs text-gray-500 mb-1">{label}</div>
          <div className="text-3xl font-bold text-gray-900">{value}</div>
        </div>
        <div
          className={`w-10 h-10 rounded-lg flex items-center justify-center ${color}`}
        >
          <Icon className="w-5 h-5" />
        </div>
      </div>
    </div>
  );
}
