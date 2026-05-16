"use client";

import { useEffect, useMemo, useState } from "react";
import {
  LayoutGrid,
  Table as TableIcon,
  Download,
  Search,
} from "lucide-react";
import { useCurrentUser } from "@/lib/auth";
import {
  addInquiryLog,
  getInquiries,
  getProperties,
  getUsers,
  updateInquiry,
} from "@/lib/store";
import {
  INQUIRY_STATUS_COLOR,
  INQUIRY_STATUS_LABEL,
  type Inquiry,
  type InquiryStatus,
  type Property,
  type User,
} from "@/lib/types";
import { formatDateTime, relativeTime } from "@/lib/format";
import { useToast } from "@/components/Toast";
import { InquiryDetailModal } from "@/components/InquiryDetailModal";

const COLUMNS: InquiryStatus[] = [
  "new",
  "in_progress",
  "negotiating",
  "closed",
  "rejected",
];

export default function InquiriesPage() {
  const { user, tenant } = useCurrentUser();
  const toast = useToast();
  const [view, setView] = useState<"kanban" | "table">("kanban");
  const [items, setItems] = useState<Inquiry[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [search, setSearch] = useState("");
  const [propFilter, setPropFilter] = useState<string>("all");
  const [assigneeFilter, setAssigneeFilter] = useState<string>("all");
  const [periodFilter, setPeriodFilter] = useState<"all" | "today" | "7d" | "30d">("all");
  const [detailId, setDetailId] = useState<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<InquiryStatus | null>(null);

  useEffect(() => {
    if (!tenant) return;
    const sync = () => {
      setItems(getInquiries(tenant.id));
      setProperties(getProperties(tenant.id));
      setUsers(getUsers(tenant.id));
    };
    sync();
    window.addEventListener("bukkenlink:dbchange", sync);
    return () => window.removeEventListener("bukkenlink:dbchange", sync);
  }, [tenant]);

  const filtered = useMemo(() => {
    return items.filter((i) => {
      if (propFilter !== "all" && i.property_id !== propFilter) return false;
      if (assigneeFilter !== "all") {
        const prop = properties.find((p) => p.id === i.property_id);
        if (!prop || !prop.assignee_ids.includes(assigneeFilter)) return false;
      }
      if (periodFilter !== "all") {
        const ageMs = Date.now() - new Date(i.created_at).getTime();
        const days = ageMs / 86400000;
        if (periodFilter === "today" && days > 1) return false;
        if (periodFilter === "7d" && days > 7) return false;
        if (periodFilter === "30d" && days > 30) return false;
      }
      if (search) {
        const q = search.toLowerCase();
        return (
          i.company_name.toLowerCase().includes(q) ||
          i.contact_name.toLowerCase().includes(q) ||
          i.email.toLowerCase().includes(q) ||
          (properties.find((p) => p.id === i.property_id)?.title ?? "")
            .toLowerCase()
            .includes(q)
        );
      }
      return true;
    });
  }, [items, properties, search, propFilter, assigneeFilter, periodFilter]);

  const exportCsv = () => {
    const header = [
      "受信日時",
      "ステータス",
      "会社名",
      "宅建免許番号",
      "担当者",
      "電話",
      "メール",
      "物件名",
      "問い合わせ内容",
    ];
    const rows = filtered.map((i) => {
      const prop = properties.find((p) => p.id === i.property_id);
      return [
        formatDateTime(i.created_at),
        INQUIRY_STATUS_LABEL[i.status],
        i.company_name,
        i.license_number,
        i.contact_name,
        i.phone,
        i.email,
        prop?.title ?? "",
        i.message.replace(/[\r\n]+/g, " "),
      ];
    });
    const csv = [header, ...rows]
      .map((r) =>
        r
          .map((c) => `"${String(c).replace(/"/g, '""')}"`)
          .join(",")
      )
      .join("\n");
    const blob = new Blob(["﻿" + csv], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `inquiries-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.show("CSVをダウンロードしました");
  };

  const handleDrop = (status: InquiryStatus) => {
    if (!draggingId || !user) return;
    const inquiry = items.find((i) => i.id === draggingId);
    if (!inquiry || inquiry.status === status) {
      setDraggingId(null);
      setDropTarget(null);
      return;
    }
    updateInquiry(draggingId, { status });
    addInquiryLog({
      inquiry_id: draggingId,
      user_id: user.id,
      action_type: "status_change",
      content: `${INQUIRY_STATUS_LABEL[inquiry.status]} → ${INQUIRY_STATUS_LABEL[status]}`,
    });
    toast.show("ステータスを変更しました");
    setDraggingId(null);
    setDropTarget(null);
  };

  if (!tenant || !user) return null;

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">問い合わせ管理</h1>
          <p className="text-sm text-gray-500 mt-1">
            合計 {items.length}件 / 表示中 {filtered.length}件
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-md border border-gray-300 overflow-hidden">
            <button
              onClick={() => setView("kanban")}
              className={`px-3 py-2 text-sm flex items-center gap-1 ${
                view === "kanban"
                  ? "bg-brand-600 text-white"
                  : "bg-white text-gray-700 hover:bg-gray-50"
              }`}
            >
              <LayoutGrid className="w-4 h-4" />
              カンバン
            </button>
            <button
              onClick={() => setView("table")}
              className={`px-3 py-2 text-sm flex items-center gap-1 border-l border-gray-300 ${
                view === "table"
                  ? "bg-brand-600 text-white"
                  : "bg-white text-gray-700 hover:bg-gray-50"
              }`}
            >
              <TableIcon className="w-4 h-4" />
              一覧
            </button>
          </div>
          <button onClick={exportCsv} className="btn-secondary">
            <Download className="w-4 h-4" />
            CSV
          </button>
        </div>
      </div>

      <div className="card p-4 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            className="input pl-9"
            placeholder="会社名・担当者・物件名で検索"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select
          className="input w-auto"
          value={propFilter}
          onChange={(e) => setPropFilter(e.target.value)}
        >
          <option value="all">全物件</option>
          {properties.map((p) => (
            <option key={p.id} value={p.id}>
              {p.title}
            </option>
          ))}
        </select>
        <select
          className="input w-auto"
          value={assigneeFilter}
          onChange={(e) => setAssigneeFilter(e.target.value)}
        >
          <option value="all">全担当者</option>
          {users.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name}
            </option>
          ))}
        </select>
        <select
          className="input w-auto"
          value={periodFilter}
          onChange={(e) =>
            setPeriodFilter(e.target.value as "all" | "today" | "7d" | "30d")
          }
        >
          <option value="all">全期間</option>
          <option value="today">本日</option>
          <option value="7d">過去7日</option>
          <option value="30d">過去30日</option>
        </select>
      </div>

      {view === "kanban" ? (
        <div className="overflow-x-auto">
          <div className="grid grid-cols-5 gap-4 min-w-[1100px]">
            {COLUMNS.map((status) => {
              const cards = filtered.filter((i) => i.status === status);
              return (
                <div
                  key={status}
                  className={`kanban-col rounded-lg bg-gray-50 border border-gray-200 p-3 transition-colors ${
                    dropTarget === status ? "drop-target" : ""
                  }`}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDropTarget(status);
                  }}
                  onDragLeave={() => setDropTarget(null)}
                  onDrop={() => handleDrop(status)}
                >
                  <div className="flex items-center justify-between mb-3 px-1">
                    <div className="flex items-center gap-2">
                      <span
                        className={`w-2 h-2 rounded-full ${
                          status === "new"
                            ? "bg-red-500"
                            : status === "in_progress"
                              ? "bg-amber-500"
                              : status === "negotiating"
                                ? "bg-blue-500"
                                : status === "closed"
                                  ? "bg-emerald-500"
                                  : "bg-gray-400"
                        }`}
                      />
                      <span className="text-sm font-semibold text-gray-700">
                        {INQUIRY_STATUS_LABEL[status]}
                      </span>
                    </div>
                    <span className="text-xs text-gray-500">
                      {cards.length}
                    </span>
                  </div>
                  <div className="space-y-2 min-h-[200px]">
                    {cards.map((i) => {
                      const prop = properties.find(
                        (p) => p.id === i.property_id
                      );
                      return (
                        <div
                          key={i.id}
                          draggable
                          onDragStart={() => setDraggingId(i.id)}
                          onDragEnd={() => {
                            setDraggingId(null);
                            setDropTarget(null);
                          }}
                          onClick={() => setDetailId(i.id)}
                          className={`kanban-card bg-white rounded-md border border-gray-200 p-3 shadow-sm cursor-pointer hover:border-brand-400 transition-colors ${
                            draggingId === i.id ? "dragging" : ""
                          }`}
                        >
                          <div className="text-sm font-medium text-gray-900 truncate">
                            {i.company_name}
                          </div>
                          <div className="text-xs text-gray-500 truncate mt-0.5">
                            {i.contact_name}
                          </div>
                          <div className="text-xs text-gray-500 truncate mt-1">
                            {prop?.title ?? "(物件不明)"}
                          </div>
                          <div className="text-xs text-gray-400 mt-2">
                            {relativeTime(i.created_at)}
                          </div>
                        </div>
                      );
                    })}
                    {cards.length === 0 && (
                      <div className="text-xs text-gray-400 text-center py-6">
                        ここにドロップ
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr className="text-left text-xs font-semibold text-gray-500 uppercase">
                  <th className="px-4 py-3">受信日時</th>
                  <th className="px-4 py-3">会社名</th>
                  <th className="px-4 py-3">担当者</th>
                  <th className="px-4 py-3">物件</th>
                  <th className="px-4 py-3">ステータス</th>
                  <th className="px-4 py-3">DL</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map((i) => {
                  const prop = properties.find((p) => p.id === i.property_id);
                  return (
                    <tr
                      key={i.id}
                      onClick={() => setDetailId(i.id)}
                      className="hover:bg-gray-50 cursor-pointer"
                    >
                      <td className="px-4 py-3 text-gray-600">
                        {formatDateTime(i.created_at)}
                      </td>
                      <td className="px-4 py-3 text-gray-900 font-medium">
                        {i.company_name}
                      </td>
                      <td className="px-4 py-3 text-gray-600">
                        {i.contact_name}
                      </td>
                      <td className="px-4 py-3 text-gray-600 truncate max-w-[200px]">
                        {prop?.title ?? "-"}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`badge ${INQUIRY_STATUS_COLOR[i.status]}`}
                        >
                          {INQUIRY_STATUS_LABEL[i.status]}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-600">
                        {i.download_count}/{i.download_limit}
                      </td>
                    </tr>
                  );
                })}
                {filtered.length === 0 && (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-4 py-12 text-center text-gray-500"
                    >
                      該当する問い合わせがありません
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <InquiryDetailModal
        inquiryId={detailId}
        currentUserId={user.id}
        tenantName={tenant.name}
        onClose={() => setDetailId(null)}
      />
    </div>
  );
}
