"use client";

import { useEffect, useState } from "react";
import { Mail, Send, Bell, MessageCircle } from "lucide-react";
import { useCurrentUser } from "@/lib/auth";
import { getSentEmails } from "@/lib/store";
import { EMAIL_SEND_MODE_LABEL, type SentEmail } from "@/lib/types";
import { formatDateTime } from "@/lib/format";

export default function InboxPage() {
  const { tenant } = useCurrentUser();
  const [emails, setEmails] = useState<SentEmail[]>([]);
  const [selected, setSelected] = useState<SentEmail | null>(null);

  useEffect(() => {
    if (!tenant) return;
    const sync = () => setEmails(getSentEmails(tenant.id));
    sync();
    window.addEventListener("bukkenlink:dbchange", sync);
    return () => window.removeEventListener("bukkenlink:dbchange", sync);
  }, [tenant]);

  if (!tenant) return null;

  return (
    <div className="p-8 space-y-6 max-w-6xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">送信メール (デモ)</h1>
        <p className="text-sm text-gray-500 mt-1">
          実際には送信されないモックメールの履歴を確認できます
        </p>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <div className="card overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-200 bg-gray-50 text-sm font-semibold">
            送信履歴 ({emails.length}件)
          </div>
          <ul className="divide-y divide-gray-100 max-h-[60vh] overflow-y-auto">
            {emails.length === 0 ? (
              <li className="p-8 text-center text-gray-500 text-sm">
                まだ送信メールがありません
              </li>
            ) : (
              emails.map((e) => (
                <li
                  key={e.id}
                  onClick={() => setSelected(e)}
                  className={
                    "p-4 cursor-pointer hover:bg-gray-50 " +
                    (selected?.id === e.id ? "bg-brand-50" : "")
                  }
                >
                  <div className="flex items-center gap-2 mb-1">
                    <KindBadge kind={e.kind} />
                    <span className="text-xs text-gray-500">
                      {formatDateTime(e.sent_at)}
                    </span>
                  </div>
                  <div className="text-sm font-medium text-gray-900 truncate">
                    {e.subject}
                  </div>
                  <div className="text-xs text-gray-500 truncate">
                    To: {e.to}
                  </div>
                </li>
              ))
            )}
          </ul>
        </div>

        <div className="card overflow-hidden">
          {selected ? (
            <>
              <div className="px-6 py-4 border-b border-gray-200">
                <div className="flex items-center gap-2 mb-2">
                  <KindBadge kind={selected.kind} />
                  {selected.send_mode && (
                    <span className="badge bg-gray-100 text-gray-700 text-[10px]">
                      {EMAIL_SEND_MODE_LABEL[selected.send_mode]}
                    </span>
                  )}
                </div>
                <h2 className="text-lg font-semibold text-gray-900">
                  {selected.subject}
                </h2>
                <div className="mt-3 space-y-1 text-xs font-mono bg-gray-50 border border-gray-200 rounded p-3">
                  {selected.from_email && (
                    <div>
                      <span className="text-gray-500">From: </span>
                      {selected.from_display_name
                        ? selected.from_display_name + " <" + selected.from_email + ">"
                        : selected.from_email}
                    </div>
                  )}
                  <div>
                    <span className="text-gray-500">To: </span>
                    {selected.to}
                  </div>
                  {selected.cc && selected.cc.length > 0 && (
                    <div>
                      <span className="text-gray-500">Cc: </span>
                      {selected.cc.join(", ")}
                    </div>
                  )}
                  {selected.reply_to && (
                    <div>
                      <span className="text-gray-500">Reply-To: </span>
                      {selected.reply_to}
                    </div>
                  )}
                  <div>
                    <span className="text-gray-500">Date: </span>
                    {formatDateTime(selected.sent_at)}
                  </div>
                </div>
              </div>
              <div className="p-6">
                <pre className="text-sm text-gray-700 whitespace-pre-wrap font-sans">
                  {selected.body}
                </pre>
              </div>
            </>
          ) : (
            <div className="p-8 text-center text-gray-500 text-sm">
              <Mail className="w-12 h-12 text-gray-300 mx-auto mb-2" />
              左側のリストからメールを選択してください
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function KindBadge({ kind }: { kind: SentEmail["kind"] }) {
  if (kind === "auto_reply")
    return (
      <span className="badge bg-blue-100 text-blue-700 inline-flex items-center gap-1">
        <Send className="w-3 h-3" />
        自動返信
      </span>
    );
  if (kind === "notification")
    return (
      <span className="badge bg-amber-100 text-amber-700 inline-flex items-center gap-1">
        <Bell className="w-3 h-3" />
        通知
      </span>
    );
  return (
    <span className="badge bg-emerald-100 text-emerald-700 inline-flex items-center gap-1">
      <MessageCircle className="w-3 h-3" />
      手動送信
    </span>
  );
}
