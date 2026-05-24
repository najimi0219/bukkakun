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
  CreditCard,
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
import { buildTemplateVars } from "@/lib/emailTemplates";
import {
  INQUIRY_STATUS_COLOR,
  INQUIRY_STATUS_LABEL,
  INQUIRY_KIND_COLOR,
  INQUIRY_KIND_LABEL,
  VIEWING_METHOD_LABEL,
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
  const [cardSignedUrl, setCardSignedUrl] = useState<string | null>(null);
  const [cardDownloadUrl, setCardDownloadUrl] = useState<string | null>(null);
  const [tab, setTab] = useState<"detail" | "email" | "downloads">("detail");
  const [note, setNote] = useState("");
  const [emailSubject, setEmailSubject] = useState("");
  const [emailBody, setEmailBody] = useState("");
  const [templateId, setTemplateId] = useState("");

  useEffect(() => {
    if (!inquiryId) {
      setInquiry(null);
      return;
    }
    // 別の問い合わせを開いたら入力状態をリセット
    setTab("detail");
    setEmailSubject("");
    setEmailBody("");
    setTemplateId("");
    setNote("");
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

  // The business-card bytes are served by our proxy endpoint, which
  // (a) hides Drive credentials and (b) handles both storage providers
  // transparently. We just point <img src> + the download link at it.
  useEffect(() => {
    if (!inquiry?.business_card_url || !inquiry.id) {
      setCardSignedUrl(null);
      setCardDownloadUrl(null);
      return;
    }
    // Cache-bust per-inquiry so switching between inquiries doesn't show
    // the previous card.
    const q = "?inquiry_id=" + encodeURIComponent(inquiry.id);
    setCardSignedUrl("/api/business-card/view" + q);
    setCardDownloadUrl("/api/business-card/view" + q + "&download=1");
  }, [inquiry?.id, inquiry?.business_card_url]);

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
    setTemplateId(tplId);
    const vars = buildModalTemplateVars(inquiry, property);
    setEmailSubject(renderTemplate(tpl.subject, vars));
    setEmailBody(renderTemplate(tpl.body, vars));
  };

  // メールタブを開いたら問い合わせ種別に対応するテンプレを自動で適用する。
  useEffect(() => {
    if (tab !== "email" || !inquiry || !property) return;
    if (emailSubject || emailBody) return;
    const kindTpl = templates.find(
      (t) => t.kind === (inquiry.kind ?? "documents")
    );
    if (!kindTpl) return;
    const vars = buildModalTemplateVars(inquiry, property);
    setTemplateId(kindTpl.id);
    setEmailSubject(renderTemplate(kindTpl.subject, vars));
    setEmailBody(renderTemplate(kindTpl.body, vars));
  }, [tab, inquiry, property, templates, emailSubject, emailBody]);

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
    setTemplateId("");
    setTab("detail");
  };

  if (!inquiry) return null;

  return (
    <Modal open={!!inquiry} onClose={onClose} size="lg">
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="flex items-center gap-2 mb-2 flex-wrap">
          <span className={`badge ${INQUIRY_STATUS_COLOR[inquiry.status]}`}>
            {INQUIRY_STATUS_LABEL[inquiry.status]}
          </span>
          <span
            className={`badge ${
              INQUIRY_KIND_COLOR[(inquiry.kind ?? "documents") as keyof typeof INQUIRY_KIND_COLOR]
            }`}
          >
            {INQUIRY_KIND_LABEL[(inquiry.kind ?? "documents") as keyof typeof INQUIRY_KIND_LABEL]}
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
          <div className="flex items-center gap-2 flex-wrap">
            {inquiry.phone && (
              <a
                href={"tel:" + inquiry.phone.replace(/[^+\d]/g, "")}
                className="btn-secondary text-sm"
                title={"発信: " + inquiry.phone}
              >
                <Phone className="w-4 h-4" />
                電話する
              </a>
            )}
            {inquiry.email && (
              <a
                href={
                  "mailto:" +
                  inquiry.email +
                  "?subject=" +
                  encodeURIComponent("Re: " + (property?.title ?? "お問い合わせ") + " について")
                }
                className="btn-secondary text-sm"
                title={"メーラーを開く: " + inquiry.email}
              >
                <Mail className="w-4 h-4" />
                メーラー
              </a>
            )}
            <button
              type="button"
              onClick={() => setTab("email")}
              className="btn-primary text-sm"
              title="BukkenLink から直接メール送信"
            >
              <Send className="w-4 h-4" />
              アプリから返信
            </button>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-gray-900 mb-3">
              業者情報
            </h3>
            <dl className="grid sm:grid-cols-2 gap-3 text-sm">
              <Item icon={Building} label="会社名" value={inquiry.company_name} />
              {inquiry.license_number && (
                <Item
                  icon={FileText}
                  label="宅建免許番号"
                  value={inquiry.license_number}
                />
              )}
              <Item icon={User} label="担当者" value={inquiry.contact_name} />
              <Item icon={Phone} label="電話番号" value={inquiry.phone} />
              <Item icon={Mail} label="メール" value={inquiry.email} />
              <Item
                icon={Clock}
                label="有効期限"
                value={`${formatDateTime(inquiry.token_expires_at)} (DL: ${inquiry.download_count}/${inquiry.download_limit})`}
              />
            </dl>
            {inquiry.kind === "viewing" && (
              <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded space-y-1">
                <div className="text-xs text-amber-900 font-semibold mb-1">
                  内見希望
                </div>
                {inquiry.viewing_preferred_at && (
                  <div className="text-sm text-gray-800">
                    <span className="text-xs text-gray-500">希望日時: </span>
                    <span className="whitespace-pre-wrap">
                      {inquiry.viewing_preferred_at}
                    </span>
                  </div>
                )}
                {inquiry.viewing_method && (
                  <div className="text-sm text-gray-800">
                    <span className="text-xs text-gray-500">内見方法: </span>
                    {VIEWING_METHOD_LABEL[inquiry.viewing_method as keyof typeof VIEWING_METHOD_LABEL]}
                  </div>
                )}
              </div>
            )}

            {inquiry.kind === "offer" && inquiry.offer_document_url && (
              <div className="mt-4 p-3 bg-purple-50 border border-purple-200 rounded">
                <div className="text-xs text-purple-900 font-semibold mb-2">
                  添付された買付書類
                </div>
                <a
                  href={"/api/offer-document/view?inquiry_id=" + encodeURIComponent(inquiry.id)}
                  target="_blank"
                  rel="noreferrer"
                  className="btn-secondary inline-flex text-xs"
                >
                  <FileText className="w-3.5 h-3.5" />
                  買付書類を開く
                </a>
              </div>
            )}

            {inquiry.message && (
              <div className="mt-4">
                <div className="text-xs text-gray-500 mb-1">問い合わせ内容</div>
                <p className="text-sm text-gray-700 whitespace-pre-wrap p-3 bg-gray-50 rounded">
                  {inquiry.message}
                </p>
              </div>
            )}
            {inquiry.business_card_url && (
              <div className="mt-4">
                <div className="text-xs text-gray-500 mb-1 flex items-center gap-1">
                  <CreditCard className="w-3 h-3" />
                  添付された名刺
                </div>
                {cardSignedUrl ? (
                  <div className="space-y-2">
                    <a
                      href={cardSignedUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-block"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={cardSignedUrl}
                        alt="名刺"
                        className="rounded border border-gray-200 max-h-48 object-contain hover:opacity-90 transition"
                      />
                    </a>
                    {cardDownloadUrl && (
                      <div>
                        <a
                          href={cardDownloadUrl}
                          download
                          className="btn-secondary inline-flex text-xs"
                        >
                          <Download className="w-3.5 h-3.5" />
                          名刺画像をダウンロード
                        </a>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-gray-400">読み込み中...</p>
                )}
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
              value={templateId}
              onChange={(e) => applyTemplate(e.target.value)}
            >
              <option value="" disabled>
                テンプレートを選択...
              </option>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.kind
                    ? `${INQUIRY_KIND_LABEL[t.kind]}：${t.name}`
                    : t.name}
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

/**
 * テンプレ文面に差し込む変数を、問い合わせ・物件の情報から組み立てる。
 * 種別を問わず全変数を返すので、どのテンプレでもそのまま描画できる。
 */
function buildModalTemplateVars(
  inq: Inquiry,
  prop: Property
): Record<string, string> {
  const formUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/download/${inq.download_token}`
      : `/download/${inq.download_token}`;
  let methodDetails = "";
  const vm = inq.viewing_method;
  if (vm === "key_pickup" && prop.viewing_key_pickup_info) {
    methodDetails = `▼ 鍵のお預かり\n${prop.viewing_key_pickup_info}`;
  } else if (vm === "key_box" && prop.viewing_key_box_code) {
    methodDetails = `▼ キーボックス暗証番号\n${prop.viewing_key_box_code}`;
  } else if (vm === "attended") {
    methodDetails = "担当者が立ち会いのうえご案内いたします。";
  }
  const notes = prop.viewing_notes
    ? `▼ ご案内時の注意事項\n${prop.viewing_notes}`
    : "";
  return buildTemplateVars({
    companyName: inq.company_name,
    contactName: inq.contact_name,
    propertyTitle: prop.title,
    docUrl: formUrl,
    docExpiresAt: formatDateTime(inq.token_expires_at),
    address: prop.address,
    transport: prop.transport || "—",
    viewingPreferredAt: inq.viewing_preferred_at?.trim() || "未指定",
    viewingMethodLabel: vm
      ? VIEWING_METHOD_LABEL[vm as keyof typeof VIEWING_METHOD_LABEL]
      : "未指定",
    viewingInfo: [methodDetails, notes].filter(Boolean).join("\n\n"),
    question: inq.message?.trim() || "（記載なし）",
  });
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
