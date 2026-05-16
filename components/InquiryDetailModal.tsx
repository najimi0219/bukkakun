"use client";

import { useEffect, useState } from "react";
import {
  Send,
  Building,
  User,
  Phone,
  Mail,
  FileText,
  Clock,
  Download,
  MessageSquare,
} from "lucide-react";
import { Modal } from "@/components/Modal";
import { useToast } from "@/components/Toast";
import {
  addInquiryLog,
  getDownloadLogs,
  getEmailSendSettings,
  getEmailTemplates,
  getInquiry,
  getInquiryLogs,
  getProperty,
  getTenant,
  getUser,
  recordSentEmail,
  renderTemplate,
  updateInquiry,
} from "@/lib/store";
import {
  INQUIRY_STATUS_COLOR,
  INQUIRY_STATUS_LABEL,
  type DownloadLog,
  type EmailTemplate,
  type Inquiry,
  type InquiryLog,
  type InquiryStatus,
  type Property,
  type User as UserType,
} from "@/lib/types";
import { formatDateTime, relativeTime } from "@/lib/format";

interface Props {
  inquiryId: string | null;
  currentUserId: string;
  tenantName: string;
  onClose: () => void;
}

export function InquiryDetailModal({
  inquiryId,
  currentUserId,
  tenantName,
  onClose,
}: Props) {
  const toast = useToast();
  const [inquiry, setInquiry] = useState<Inquiry | null>(null);
  const [property, setProperty] = useState<Property | null>(null);
  const [logs, setLogs] = useState<InquiryLog[]>([]);
  const [downloads, setDownloads] = useState<DownloadLog[]>([]);
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [tab, setTab] = useState<"detail" | "email" | "downloads">("detail");
  const [note, setNote] = useState("");
  const [emailSubject, setEmailSubject] = useState("");
  const [emailBody, setEmailBody] = useState("");

  useEffect(() => {
    if (!inquiryId) {
      setInquiry(null);
      return;
    }
    const sync = () => {
      const i = getInquiry(inquiryId);
      if (!i) return;
      setInquiry(i);
      setProperty(getProperty(i.property_id) ?? null);
      setLogs(getInquiryLogs(inquiryId));
      setDownloads(getDownloadLogs(inquiryId));
      setTemplates(getEmailTemplates(i.tenant_id));
    };
    sync();
    window.addEventListener("bukkenlink:dbchange", sync);
    return () => window.removeEventListener("bukkenlink:dbchange", sync);
  }, [inquiryId]);

  const changeStatus = (next: InquiryStatus) => {
    if (!inquiry) return;
    if (next === inquiry.status) return;
    const prev = inquiry.status;
    updateInquiry(inquiry.id, { status: next });
    addInquiryLog({
      inquiry_id: inquiry.id,
      user_id: currentUserId,
      action_type: "status_change",
      content: `${INQUIRY_STATUS_LABEL[prev]} → ${INQUIRY_STATUS_LABEL[next]}`,
    });
    toast.show("ステータスを変更しました");
  };

  const addNote = () => {
    if (!inquiry || !note.trim()) return;
    addInquiryLog({
      inquiry_id: inquiry.id,
      user_id: currentUserId,
      action_type: "note",
      content: note.trim(),
    });
    setNote("");
    toast.show("メモを追加しました");
  };

  const applyTemplate = (tplId: string) => {
    const tpl = templates.find((t) => t.id === tplId);
    if (!tpl || !inquiry || !property) return;
    const formUrl =
      typeof window !== "undefined"
        ? `${window.location.origin}/download/${inquiry.download_token}`
        : `/download/${inquiry.download_token}`;
    const vars: Record<string, string> = {
      会社名: inquiry.company_name,
      担当者名: inquiry.contact_name,
      物件名: property.title,
      資料URL: formUrl,
      有効期限: formatDateTime(inquiry.token_expires_at),
    };
    setEmailSubject(renderTemplate(tpl.subject, vars));
    setEmailBody(renderTemplate(tpl.body, vars));
  };

  const sendEmail = () => {
    if (!inquiry) return;
    if (!emailSubject || !emailBody) {
      toast.show("件名と本文を入力してください", "error");
      return;
    }
    // Pull tenant's email_send_settings so the manual mail uses the same From /
    // Reply-To as auto-replies. Falls back to safe defaults if not configured.
    const sendCfg = getEmailSendSettings(inquiry.tenant_id);
    const tenant = getTenant(inquiry.tenant_id);
    const fromDisplayName = sendCfg?.from_display_name ?? tenant?.name ?? tenantName;
    const replyTo = sendCfg?.reply_to_email ?? null;
    const mode = sendCfg?.mode ?? "relay_with_cc";
    // custom_domain mode honors the tenant's verified From; otherwise the API
    // route falls back to RESEND_DEFAULT_FROM.
    const fromEmail =
      mode === "custom_domain" && sendCfg?.from_email ? sendCfg.from_email : null;
    const cc = mode === "relay_with_cc" ? sendCfg?.cc_emails ?? [] : [];

    recordSentEmail({
      tenant_id: inquiry.tenant_id,
      to: inquiry.email,
      subject: emailSubject,
      body: emailBody,
      kind: "manual",
      from_email: fromEmail,
      from_display_name: fromDisplayName,
      reply_to: replyTo,
      cc: cc.length > 0 ? cc : null,
      send_mode: mode,
    });
    addInquiryLog({
      inquiry_id: inquiry.id,
      user_id: currentUserId,
      action_type: "email_sent",
      content: `件名:${emailSubject}`,
    });
    toast.show("メールを送信しました");
    setEmailSubject("");
    setEmailBody("");
    setTab("detail");
  };

  if (!inquiry) return null;

  return (
    <Modal open={!!inquiry} onClose={onClose} size="lg">
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="flex items-center gap-2 mb-2">
          <span className={`badge ${INQUIRY_STATUS_COLOR[inquiry.status]}`}>
            {INQUIRY_STATUS_LABEL[inquiry.status]}
          </span>
          <span className="text-xs text-gray-500">
            受信:{formatDateTime(inquiry.created_at)}
          </span>
        </div>
        <h2 className="text-lg font-semibold text-gray-900">
          {inquiry.company_name} からの問い合わせ
        </h2>
        <p className="text-sm text-gray-500 mt-1">
          物件:{property?.title ?? "(物件不明)"}
        </p>
      </div>

      <div className="px-6 py-3 border-b border-gray-200 flex items-center gap-2">
        <span className="text-xs text-gray-500 mr-1">ステータス変更:</span>
        {(
          ["new", "in_progress", "negotiating", "closed", "rejected"] as InquiryStatus[]
        ).map((s) => (
          <button
            key={s}
            onClick={() => changeStatus(s)}
            className={`text-xs px-2 py-1 rounded border ${
              s === inquiry.status
                ? "bg-brand-600 border-brand-600 text-white"
                : "bg-white border-gray-300 text-gray-700 hover:bg-gray-50"
            }`}
          >
            {INQUIRY_STATUS_LABEL[s]}
          </button>
        ))}
      </div>

      <div className="border-b border-gray-200">
        <div className="flex">
          {(
            [
              { k: "detail", label: "詳細・対応履歴" },
              { k: "email", label: "メール送信" },
              { k: "downloads", label: `DLログ (${downloads.length})` },
            ] as const
          ).map((t) => (
            <button
              key={t.k}
              onClick={() => setTab(t.k)}
              className={`px-4 py-3 text-sm font-medium border-b-2 ${
                tab === t.k
                  ? "border-brand-600 text-brand-700"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {tab === "detail" && (
        <div className="p-6 space-y-6 max-h-[60vh] overflow-y-auto">
          <div>
            <h3 className="text-sm font-semibold text-gray-900 mb-3">
              業者情報
            </h3>
            <dl className="grid sm:grid-cols-2 gap-3 text-sm">
              <Item icon={Building} label="会社名" value={inquiry.company_name} />
              <Item
                icon={FileText}
                label="宅建免許番号"
                value={inquiry.license_number}
              />
              <Item icon={User} label="担当者" value={inquiry.contact_name} />
              <Item icon={Phone} label="電話番号" value={inquiry.phone} />
              <Item icon={Mail} label="メール" value={inquiry.email} />
              <Item
                icon={Clock}
                label="有効期限"
                value={`${formatDateTime(inquiry.token_expires_at)} (DL: ${inquiry.download_count}/${inquiry.download_limit})`}
              />
            </dl>
            {inquiry.message && (
              <div className="mt-4">
                <div className="text-xs text-gray-500 mb-1">問い合わせ内容</div>
                <p className="text-sm text-gray-700 whitespace-pre-wrap p-3 bg-gray-50 rounded">
                  {inquiry.message}
                </p>
              </div>
            )}
          </div>

          <div>
            <h3 className="text-sm font-semibold text-gray-900 mb-3">
              対応履歴
            </h3>
            {logs.length === 0 ? (
              <p className="text-sm text-gray-500">履歴はまだありません</p>
            ) : (
              <ol className="space-y-3 border-l-2 border-gray-200 pl-4">
                {logs.map((log) => {
                  const u = log.user_id ? getUser(log.user_id) : null;
                  return (
                    <li key={log.id} className="relative">
                      <div className="absolute -left-[1.45rem] top-1.5 w-3 h-3 rounded-full bg-brand-500 ring-4 ring-white" />
                      <div className="text-xs text-gray-500">
                        {formatDateTime(log.created_at)} ・{" "}
                        {u?.name ?? "システム"} ・{" "}
                        {log.action_type === "status_change"
                          ? "ステータス変更"
                          : log.action_type === "email_sent"
                            ? "メール送信"
                            : "メモ"}
                      </div>
                      <div className="text-sm text-gray-900 mt-0.5 whitespace-pre-wrap">
                        {log.content}
                      </div>
                    </li>
                  );
                })}
              </ol>
            )}
          </div>

          <div>
            <h3 className="text-sm font-semibold text-gray-900 mb-2">
              <MessageSquare className="w-4 h-4 inline mr-1" />
              メモを追加
            </h3>
            <textarea
              className="input min-h-[80px]"
              placeholder="対応内容や次のアクションをメモしてください"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
            <div className="flex justify-end mt-2">
              <button onClick={addNote} className="btn-primary">
                メモを追加
              </button>
            </div>
          </div>
        </div>
      )}

      {tab === "email" && (
        <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
          <div>
            <label className="label">テンプレートから選択</label>
            <select
              className="input"
              onChange={(e) => applyTemplate(e.target.value)}
              defaultValue=""
            >
              <option value="" disabled>
                テンプレートを選択...
              </option>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                  {t.is_default ? " (デフォルト)" : ""}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">宛先</label>
            <input
              readOnly
              className="input bg-gray-50"
              value={inquiry.email}
            />
          </div>
          <div>
            <label className="label">件名</label>
            <input
              className="input"
              value={emailSubject}
              onChange={(e) => setEmailSubject(e.target.value)}
            />
          </div>
          <div>
            <label className="label">本文</label>
            <textarea
              className="input min-h-[240px] font-mono text-xs"
              value={emailBody}
              onChange={(e) => setEmailBody(e.target.value)}
            />
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={() => setTab("detail")} className="btn-secondary">
              キャンセル
            </button>
            <button onClick={sendEmail} className="btn-primary">
              <Send className="w-4 h-4" />
              送信
            </button>
          </div>
        </div>
      )}

      {tab === "downloads" && (
        <div className="p-6 max-h-[60vh] overflow-y-auto">
          {downloads.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-8">
              まだダウンロードされていません
            </p>
          ) : (
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50">
                <tr className="text-left text-xs text-gray-500 uppercase">
                  <th className="px-3 py-2">日時</th>
                  <th className="px-3 py-2">資料</th>
                  <th className="px-3 py-2">IP</th>
                  <th className="px-3 py-2">User Agent</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {downloads.map((d) => (
                  <tr key={d.id}>
                    <td className="px-3 py-2 text-gray-900">
                      {formatDateTime(d.downloaded_at)}
                    </td>
                    <td className="px-3 py-2 text-gray-600">
                      {d.document_id.slice(0, 12)}...
                    </td>
                    <td className="px-3 py-2 text-gray-600 font-mono text-xs">
                      {d.ip_address}
                    </td>
                    <td className="px-3 py-2 text-gray-600 text-xs truncate max-w-[200px]">
                      {d.user_agent}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </Modal>
  );
}

function Item({
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
        <dt className="text-xs text-gray-500">{label}</dt>
        <dd className="text-sm text-gray-900 break-words">{value}</dd>
      </div>
    </div>
  );
}
