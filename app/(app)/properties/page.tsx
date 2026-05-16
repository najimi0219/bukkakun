"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Plus, Search, QrCode, ExternalLink, Pencil, Trash2 } from "lucide-react";
import { useCurrentUser } from "@/lib/auth";
import { deleteProperty, getProperties } from "@/lib/store";
import {
  PROPERTY_TYPE_LABEL,
  type Property,
  type PropertyType,
} from "@/lib/types";
import { formatYen, formatDate } from "@/lib/format";
import { useToast } from "@/components/Toast";

export default function PropertiesPage() {
  const { tenant } = useCurrentUser();
  const toast = useToast();
  const [items, setItems] = useState<Property[]>([]);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<PropertyType | "all">("all");
  const [statusFilter, setStatusFilter] = useState<
    "all" | "published" | "draft"
  >("all");

  useEffect(() => {
    if (!tenant) return;
    const sync = () => setItems(getProperties(tenant.id));
    sync();
    window.addEventListener("bukkenlink:dbchange", sync);
    return () => window.removeEventListener("bukkenlink:dbchange", sync);
  }, [tenant]);

  const filtered = useMemo(() => {
    return items.filter((p) => {
      if (typeFilter !== "all" && p.property_type !== typeFilter) return false;
      if (statusFilter !== "all" && p.status !== statusFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        return (
          p.title.toLowerCase().includes(q) ||
          p.address.toLowerCase().includes(q) ||
          (p.reins_id ?? "").toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [items, search, typeFilter, statusFilter]);

  const handleDelete = (p: Property) => {
    if (!confirm(`「${p.title}」を削除します。よろしいですか?`)) return;
    deleteProperty(p.id);
    toast.show("物件を削除しました");
  };

  if (!tenant) return null;

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">物件管理</h1>
          <p className="text-sm text-gray-500 mt-1">
            登録物件 {items.length}件 / 公開中 {items.filter((p) => p.status === "published").length}件
          </p>
        </div>
        <Link href="/properties/new" className="btn-primary">
          <Plus className="w-4 h-4" />
          物件を追加
        </Link>
      </div>

      <div className="card p-4 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            className="input pl-9"
            placeholder="物件名・住所・レインズ番号で検索"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select
          className="input w-auto"
          value={typeFilter}
          onChange={(e) =>
            setTypeFilter(e.target.value as PropertyType | "all")
          }
        >
          <option value="all">全種別</option>
          {Object.entries(PROPERTY_TYPE_LABEL).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
        <select
          className="input w-auto"
          value={statusFilter}
          onChange={(e) =>
            setStatusFilter(e.target.value as "all" | "published" | "draft")
          }
        >
          <option value="all">全ステータス</option>
          <option value="published">公開</option>
          <option value="draft">下書き</option>
        </select>
      </div>

      <div className="card overflow-hidden">
        {filtered.length === 0 ? (
          <div className="p-12 text-center text-gray-500">
            物件がありません。「物件を追加」から登録してください。
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr className="text-left text-xs font-semibold text-gray-500 uppercase">
                  <th className="px-4 py-3">物件名</th>
                  <th className="px-4 py-3">種別</th>
                  <th className="px-4 py-3">所在地</th>
                  <th className="px-4 py-3">価格</th>
                  <th className="px-4 py-3">登録日</th>
                  <th className="px-4 py-3">ステータス</th>
                  <th className="px-4 py-3 text-right">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map((p) => (
                  <tr key={p.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <Link
                        href={`/properties/${p.id}`}
                        className="text-gray-900 hover:text-brand-600 font-medium"
                      >
                        {p.title}
                      </Link>
                      {p.reins_id && (
                        <div className="text-xs text-gray-500 mt-0.5">
                          {p.reins_id}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {PROPERTY_TYPE_LABEL[p.property_type]}
                    </td>
                    <td className="px-4 py-3 text-gray-600">{p.address}</td>
                    <td className="px-4 py-3 text-gray-900 font-medium">
                      {formatYen(p.price)}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {formatDate(p.created_at)}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`badge ${
                          p.status === "published"
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-gray-100 text-gray-600"
                        }`}
                      >
                        {p.status === "published" ? "公開" : "下書き"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <Link
                          href={`/properties/${p.id}`}
                          className="p-1.5 text-gray-500 hover:text-brand-600 rounded"
                          title="QR/詳細"
                        >
                          <QrCode className="w-4 h-4" />
                        </Link>
                        <a
                          href={`/form/${p.form_token}`}
                          target="_blank"
                          rel="noreferrer"
                          className="p-1.5 text-gray-500 hover:text-brand-600 rounded"
                          title="フォームを開く"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </a>
                        <Link
                          href={`/properties/${p.id}/edit`}
                          className="p-1.5 text-gray-500 hover:text-brand-600 rounded"
                          title="編集"
                        >
                          <Pencil className="w-4 h-4" />
                        </Link>
                        <button
                          onClick={() => handleDelete(p)}
                          className="p-1.5 text-gray-500 hover:text-red-600 rounded"
                          title="削除"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
