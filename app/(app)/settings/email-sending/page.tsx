"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Mail,
  Send,
  AtSign,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Globe,
  Server,
  Copy,
  RefreshCw,
  ShieldCheck,
  X,
} from "lucide-react";
import { useCurrentUser } from "@/lib/auth";
import {
  getEmailSendSettings,
  saveEmailSendSettings,
  uid,
} from "@/lib/store";
import {
  DNS_PROVIDER_API_AUTOMATABLE,
  DNS_PROVIDER_LABEL,
  EMAIL_SEND_MODE_LABEL,
  MAIL_PROVIDER_LABEL,
  type DomainVerificationStatus,
  type EmailSendMode,
  type EmailSendSettings,
  type VerificationDnsRecord,
} from "@/lib/types";
import { useToast } from "@/components/Toast";
import {
  buildResendDnsRecords,
  detectDomain,
  mergeSpfWithResend,
  type DnsDetectionResult,
} from "@/lib/dnsDetect";
import { formatDateTime } from "@/lib/format";

const RELAY_FROM_EMAIL = "no-reply@bukkenlink.com";

export default function EmailSendingPage() {
  const { tenant, user } = useCurrentUser();
  const toast = useToast();
  const [settings, setSettings] = useState<EmailSendSettings | null>(null);
  const [mode, setMode] = useState<EmailSendMode>("relay_with_cc");
  const [fromDisplayName, setFromDisplayName] = useState("");
  const [replyTo, setReplyTo] = useState("");
  const [ccEmail, setCcEmail] = useState("");
  const [ccEmails, setCcEmails] = useState<string[]>([]);
  const [customDomain, setCustomDomain] = useState("");
  const [detection, setDetection] = useState<DnsDetectionResult | null>(null);
  const [detecting, setDetecting] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [dnsRecords, setDnsRecords] = useState<VerificationDnsRecord[] | null>(null);
  const [verificationStatus, setVerificationStatus] =
    useState<DomainVerificationStatus>("not_started");
  const [verifyLastCheckedAt, setVerifyLastCheckedAt] = useState<string | null>(null);
  const [verifyError, setVerifyError] = useState<string | null>(null);

  // Load existing settings
  useEffect(() => {
    if (!tenant) return;
    const sync = () => {
      const s = getEmailSendSettings(tenant.id);
      if (!s) {
        setSettings({
          id: uid(),
          tenant_id: tenant.id,
          mode: "relay_with_cc",
          from_display_name: tenant.name,
          from_email: null,
          reply_to_email: user?.email ?? "",
          cc_emails: user?.email ? [user.email] : [],
          custom_domain: null,
          detected_dns_provider: null,
          detected_mail_provider: null,
          detected_existing_spf: null,
          verification_status: "not_started",
          verification_last_checked_at: null,
          verification_dns_records: null,
          verification_error: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
        setMode("relay_with_cc");
        setFromDisplayName(tenant.name);
        setReplyTo(user?.email ?? "");
        setCcEmails(user?.email ? [user.email] : []);
        return;
      }
      setSettings(s);
      setMode(s.mode);
      setFromDisplayName(s.from_display_name ?? tenant.name);
      setReplyTo(s.reply_to_email);
      setCcEmails(s.cc_emails);
      setCustomDomain(s.custom_domain ?? "");
      setDnsRecords(s.verification_dns_records);
      setVerificationStatus(s.verification_status);
      setVerifyLastCheckedAt(s.verification_last_checked_at);
      setVerifyError(s.verification_error);
      if (s.detected_dns_provider) {
        setDetection({
          domain: s.custom_domain ?? "",
          ns: [],
          mx: [],
          txt: [],
          existingSpf: s.detected_existing_spf,
          dnsProvider: s.detected_dns_provider,
          mailProvider: s.detected_mail_provider ?? "unknown",
          apiAutomatable: DNS_PROVIDER_API_AUTOMATABLE[s.detected_dns_provider],
          resendInSpf:
            (s.detected_existing_spf ?? "").toLowerCase().includes("_spf.resend.com"),
        });
      }
    };
    sync();
    window.addEventListener("bukkenlink:dbchange", sync);
    return () => window.removeEventListener("bukkenlink:dbchange", sync);
  }, [tenant, user]);

  const addCcEmail = () => {
    if (!ccEmail || !/^.+@.+\..+$/.test(ccEmail)) {
      toast.show("正しいメールアドレスを入力", "error");
      return;
    }
    if (ccEmails.includes(ccEmail)) {
      toast.show("既に追加されています", "error");
      return;
    }
    setCcEmails([...ccEmails, ccEmail]);
    setCcEmail("");
  };

  const removeCc = (e: string) => {
    setCcEmails(ccEmails.filter((x) => x !== e));
  };

  // ↓ Auto-detect DNS configuration for the entered domain.
  const runDetection = async () => {
    if (!customDomain.trim()) {
      toast.show("ドメインを入力してください", "error");
      return;
    }
    setDetecting(true);
    setVerifyError(null);
    try {
      const result = await detectDomain(customDomain);
      setDetection(result);
      setDnsRecords(buildResendDnsRecords(result.domain));
      setVerificationStatus("pending");
      toast.show(
        DNS_PROVIDER_LABEL[result.dnsProvider] + " で管理されています"
      );
    } catch (err: any) {
      toast.show("ドメインの判定に失敗: " + err.message, "error");
      setDetection(null);
    } finally {
      setDetecting(false);
    }
  };

  // ↓ "Verify" button — simulate Resend's verification call.
  const runVerification = async () => {
    if (!detection) return;
    setVerifying(true);
    setVerifyError(null);
    try {
      // Re-fetch the live SPF and check whether _spf.resend.com is in it.
      const fresh = await detectDomain(detection.domain);
      const now = new Date().toISOString();
      if (fresh.resendInSpf) {
        setVerificationStatus("verified");
        setVerifyLastCheckedAt(now);
        toast.show("ドメイン認証に成功しました(SPF 確認済み)");
      } else {
        setVerificationStatus("failed");
        setVerifyLastCheckedAt(now);
        setVerifyError(
          "SPF レコードに include:_spf.resend.com が見つかりません。" +
            "DNS の伝播待ち(最大 1 時間)、または追加し忘れの可能性があります。"
        );
        toast.show("認証失敗:DNS レコードを再確認してください", "error");
      }
    } catch (err: any) {
      setVerificationStatus("failed");
      setVerifyError(err.message);
      toast.show("認証エラー: " + err.message, "error");
    } finally {
      setVerifying(false);
    }
  };

  const onSave = () => {
    if (!settings || !tenant) return;
    if (!replyTo || !/^.+@.+\..+$/.test(replyTo)) {
      toast.show("正しい Reply-To アドレスを入力", "error");
      return;
    }
    if (mode === "custom_domain") {
      if (!detection || verificationStatus !== "verified") {
        toast.show(
          "自社ドメイン送信を有効にするにはドメイン認証(Verify)が必要です",
          "error"
        );
        return;
      }
    }
    const next: EmailSendSettings = {
      ...settings,
      mode,
      from_display_name: fromDisplayName,
      from_email:
        mode === "custom_domain" && detection
          ? "no-reply@" + detection.domain
          : null,
      reply_to_email: replyTo,
      cc_emails: ccEmails,
      custom_domain: mode === "custom_domain" ? detection?.domain ?? null : null,
      detected_dns_provider: detection?.dnsProvider ?? null,
      detected_mail_provider: detection?.mailProvider ?? null,
      detected_existing_spf: detection?.existingSpf ?? null,
      verification_status: mode === "custom_domain" ? verificationStatus : "not_started",
      verification_last_checked_at: verifyLastCheckedAt,
      verification_dns_records: mode === "custom_domain" ? dnsRecords : null,
      verification_error: verifyError,
      updated_at: new Date().toISOString(),
    };
    saveEmailSendSettings(next);
    toast.show("メール送信設定を保存しました");
  };

  const copyValue = async (v: string) => {
    await navigator.clipboard.writeText(v);
    toast.show("コピーしました");
  };

  const previewFrom = useMemo(() => {
    if (mode === "relay_with_cc") {
      return (
        (fromDisplayName || tenant?.name || "BukkenLink") +
        " <" +
        RELAY_FROM_EMAIL +
        ">"
      );
    }
    return (
      (fromDisplayName || tenant?.name || "BukkenLink") +
      " <no-reply@" +
      (detection?.domain ?? customDomain ?? "your-domain.com") +
      ">"
    );
  }, [mode, fromDisplayName, tenant, detection, customDomain]);

  const apiAutomatable = detection ? DNS_PROVIDER_API_AUTOMATABLE[detection.dnsProvider] : false;

  if (!tenant) return null;

  return (
    <div className="p-8 space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Mail className="w-6 h-6 text-brand-600" />
          メール送信設定
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          業者(客付)への自動返信メールをどう送信するかを設定します
        </p>
      </div>

      {/* Mode selector */}
      <div className="space-y-3">
        <h2 className="font-semibold text-gray-900">送信モード</h2>

        <label
          className={
            "card p-5 flex items-start gap-3 cursor-pointer transition " +
            (mode === "relay_with_cc"
              ? "ring-2 ring-brand-500 bg-brand-50/30"
              : "hover:border-gray-300")
          }
        >
          <input
            type="radio"
            name="mode"
            checked={mode === "relay_with_cc"}
            onChange={() => setMode("relay_with_cc")}
            className="mt-1"
          />
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <Send className="w-4 h-4 text-brand-600" />
              <span className="font-semibold text-gray-900">
                ① BukkenLink から代理送信(Cc にテナント)
              </span>
              <span className="badge bg-emerald-100 text-emerald-700">
                設定不要
              </span>
            </div>
            <p className="text-sm text-gray-600">
              <code className="font-mono text-xs">{RELAY_FROM_EMAIL}</code>{" "}
              から業者宛に送信し、Cc 欄にテナント担当者を入れます。テナント側の DNS 設定は一切不要で、すぐ使えます。
            </p>
          </div>
        </label>

        <label
          className={
            "card p-5 flex items-start gap-3 cursor-pointer transition " +
            (mode === "custom_domain"
              ? "ring-2 ring-brand-500 bg-brand-50/30"
              : "hover:border-gray-300")
          }
        >
          <input
            type="radio"
            name="mode"
            checked={mode === "custom_domain"}
            onChange={() => setMode("custom_domain")}
            className="mt-1"
          />
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <AtSign className="w-4 h-4 text-brand-600" />
              <span className="font-semibold text-gray-900">
                ② テナント自社ドメインから直接送信
              </span>
              <span className="badge bg-purple-100 text-purple-700">
                Pro 推奨
              </span>
            </div>
            <p className="text-sm text-gray-600">
              <code className="font-mono text-xs">no-reply@najimi-llc.com</code>{" "}
              のように御社のドメインから送信します。DNS レコードの追加が必要ですが、業者からは「御社からのメール」として届きます。
            </p>
          </div>
        </label>
      </div>

      {/* Common: display name + Reply-To */}
      <div className="card p-6 space-y-4">
        <h2 className="font-semibold text-gray-900">共通設定</h2>
        <div>
          <label className="label">送信者表示名(From 名)</label>
          <input
            className="input"
            value={fromDisplayName}
            onChange={(e) => setFromDisplayName(e.target.value)}
            placeholder="なじみ合同会社"
          />
          <p className="text-xs text-gray-500 mt-1">
            業者の受信箱で「○○から届きました」と表示される名前
          </p>
        </div>
        <div>
          <label className="label">
            返信先(Reply-To)アドレス <span className="text-red-500">*</span>
          </label>
          <input
            className="input"
            value={replyTo}
            onChange={(e) => setReplyTo(e.target.value)}
            placeholder="info@najimi-llc.com"
          />
          <p className="text-xs text-gray-500 mt-1">
            業者が「返信」ボタンを押した時にここに届きます
          </p>
        </div>
      </div>

      {/* Mode 1: Cc list */}
      {mode === "relay_with_cc" && (
        <div className="card p-6 space-y-4">
          <h2 className="font-semibold text-gray-900">Cc(BukkenLink からの送信時に追加)</h2>
          <div className="flex flex-wrap gap-2">
            {ccEmails.map((e) => (
              <span
                key={e}
                className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-brand-50 text-brand-700 text-sm"
              >
                {e}
                <button
                  onClick={() => removeCc(e)}
                  className="text-brand-500 hover:text-brand-800"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
            {ccEmails.length === 0 && (
              <span className="text-sm text-gray-500">未設定</span>
            )}
          </div>
          <div className="flex gap-2">
            <input
              type="email"
              className="input flex-1"
              placeholder="info@najimi-llc.com"
              value={ccEmail}
              onChange={(e) => setCcEmail(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addCcEmail())}
            />
            <button onClick={addCcEmail} className="btn-secondary">追加</button>
          </div>
          <p className="text-xs text-gray-500">
            業者宛に送られた自動返信メールが Cc されます。業務メールアドレスを入れておくと、社内で「いつ・誰に・何を送ったか」が分かります。
          </p>
        </div>
      )}

      {/* Mode 2: Domain detection + verification */}
      {mode === "custom_domain" && (
        <>
          <div className="card p-6 space-y-4">
            <h2 className="font-semibold text-gray-900">送信ドメイン</h2>
            <div>
              <label className="label">送信元ドメイン</label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">
                    no-reply@
                  </span>
                  <input
                    className="input pl-20"
                    placeholder="najimi-llc.com"
                    value={customDomain}
                    onChange={(e) => {
                      setCustomDomain(e.target.value);
                      setDetection(null);
                      setVerificationStatus("not_started");
                    }}
                  />
                </div>
                <button
                  onClick={runDetection}
                  disabled={detecting || !customDomain}
                  className="btn-primary"
                >
                  {detecting ? "判定中…" : "ドメインを判定"}
                </button>
              </div>
            </div>

            {detection && (
              <div className="grid sm:grid-cols-2 gap-3 pt-2 border-t border-gray-100">
                <DetectedField
                  icon={Globe}
                  label="DNS 管理"
                  value={DNS_PROVIDER_LABEL[detection.dnsProvider]}
                  meta={apiAutomatable ? "API自動化対応" : "手動設定が必要"}
                  status={apiAutomatable ? "ok" : "warn"}
                />
                <DetectedField
                  icon={Server}
                  label="メールサーバ"
                  value={MAIL_PROVIDER_LABEL[detection.mailProvider]}
                  meta={detection.mx.length ? detection.mx[0] : "MX レコード無し"}
                />
                <DetectedField
                  icon={ShieldCheck}
                  label="既存 SPF レコード"
                  value={detection.existingSpf ?? "(無し)"}
                  meta={
                    detection.resendInSpf
                      ? "_spf.resend.com 含む ✓"
                      : detection.existingSpf
                        ? "Resend を追記してマージ"
                        : "新規追加"
                  }
                  mono
                />
                <DetectedField
                  icon={Send}
                  label="自動化可否"
                  value={
                    apiAutomatable
                      ? DNS_PROVIDER_LABEL[detection.dnsProvider] + " API で自動設定可能"
                      : "テナント手動設定"
                  }
                  status={apiAutomatable ? "ok" : "warn"}
                />
              </div>
            )}
          </div>

          {/* Auto setup vs manual instructions */}
          {detection && (
            <div className="card p-6 space-y-4">
              <h2 className="font-semibold text-gray-900 flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-brand-600" />
                必要な DNS レコード
              </h2>

              {apiAutomatable ? (
                <div className="p-4 rounded bg-emerald-50 border border-emerald-200 flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 mt-0.5 shrink-0" />
                  <div className="flex-1 text-sm text-emerald-900">
                    <strong>
                      {DNS_PROVIDER_LABEL[detection.dnsProvider]} はAPI接続に対応しています。
                    </strong>
                    <br />
                    下のボタンから OAuth 連携すると、DNS レコードを自動で書き込めます(本番実装時)。
                    <div className="mt-3">
                      <button
                        className="btn-primary text-sm py-1.5"
                        onClick={() =>
                          toast.show(
                            "本番では " +
                              DNS_PROVIDER_LABEL[detection.dnsProvider] +
                              " の OAuth 画面が開きます",
                            "info"
                          )
                        }
                      >
                        {DNS_PROVIDER_LABEL[detection.dnsProvider]} に接続して自動設定
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-4 rounded bg-amber-50 border border-amber-200 flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5 shrink-0" />
                  <div className="flex-1 text-sm text-amber-900">
                    <strong>
                      {DNS_PROVIDER_LABEL[detection.dnsProvider]} は公開APIが提供されていません。
                    </strong>
                    <br />
                    下記のレコードを{DNS_PROVIDER_LABEL[detection.dnsProvider]}のコントロールパネルから手動で追加してください。
                  </div>
                </div>
              )}

              {dnsRecords?.map((r, idx) => {
                const isMergeable =
                  r.purpose === "spf" && detection.existingSpf && !detection.resendInSpf;
                const mergedValue = isMergeable
                  ? mergeSpfWithResend(detection.existingSpf)
                  : r.value;
                return (
                  <div key={idx} className="border border-gray-200 rounded">
                    <div className="px-4 py-2 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
                      <div className="text-xs">
                        <span className="font-mono font-bold text-gray-700">
                          {r.type}
                        </span>
                        <span className="ml-2 text-gray-500">
                          {r.purpose === "spf" && "SPF (送信ポリシー)"}
                          {r.purpose === "dkim" && "DKIM (電子署名)"}
                          {r.purpose === "return_path" && "Return-Path (バウンス処理)"}
                        </span>
                      </div>
                      {isMergeable && (
                        <span className="badge bg-blue-100 text-blue-700">
                          既存とマージ
                        </span>
                      )}
                    </div>
                    <div className="p-4 space-y-2 text-sm">
                      <Row
                        label="ホスト名"
                        value={r.host}
                        onCopy={() => copyValue(r.host)}
                      />
                      <Row
                        label={isMergeable ? "値(マージ後)" : "値"}
                        value={mergedValue}
                        onCopy={() => copyValue(mergedValue)}
                      />
                      {r.priority != null && (
                        <Row label="優先度" value={String(r.priority)} />
                      )}
                      {r.note && (
                        <p className="text-xs text-gray-500 pt-1">{r.note}</p>
                      )}
                      {isMergeable && (
                        <div className="text-xs text-gray-600 bg-blue-50 border border-blue-200 rounded p-2 mt-2">
                          <strong>現状の SPF:</strong>{" "}
                          <code className="font-mono">{detection.existingSpf}</code>
                          <br />
                          <strong>追加するのは</strong>{" "}
                          <code className="font-mono">include:_spf.resend.com</code>{" "}
                          の部分だけ。複数 SPF レコードを作ると逆に壊れるので、必ず既存を編集してください。
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}

              {/* Verify */}
              <div className="pt-2 border-t border-gray-100 flex items-center justify-between flex-wrap gap-3">
                <div className="text-sm">
                  {verificationStatus === "verified" && (
                    <span className="text-emerald-700 inline-flex items-center gap-1">
                      <CheckCircle2 className="w-4 h-4" />
                      認証済み(
                      {verifyLastCheckedAt
                        ? formatDateTime(verifyLastCheckedAt)
                        : "—"}
                      )
                    </span>
                  )}
                  {verificationStatus === "pending" && (
                    <span className="text-gray-600 inline-flex items-center gap-1">
                      <AlertCircle className="w-4 h-4" />
                      DNS 設定後、下のボタンで確認
                    </span>
                  )}
                  {verificationStatus === "failed" && (
                    <span className="text-red-700 inline-flex items-center gap-1">
                      <AlertCircle className="w-4 h-4" />
                      認証に失敗
                    </span>
                  )}
                </div>
                <button
                  onClick={runVerification}
                  disabled={verifying}
                  className="btn-primary"
                >
                  <RefreshCw className={"w-4 h-4 " + (verifying ? "animate-spin" : "")} />
                  {verifying ? "確認中…" : "DNS 反映を確認(Verify)"}
                </button>
              </div>

              {verifyError && (
                <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded p-3">
                  {verifyError}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* Preview */}
      <div className="card p-6">
        <h2 className="font-semibold text-gray-900 mb-3">送信プレビュー</h2>
        <div className="font-mono text-xs bg-gray-900 text-gray-100 rounded p-4 space-y-1">
          <div>
            <span className="text-gray-400">From:</span> {previewFrom}
          </div>
          <div>
            <span className="text-gray-400">To:</span> [業者のメールアドレス]
          </div>
          {mode === "relay_with_cc" && ccEmails.length > 0 && (
            <div>
              <span className="text-gray-400">Cc:</span> {ccEmails.join(", ")}
            </div>
          )}
          <div>
            <span className="text-gray-400">Reply-To:</span>{" "}
            {replyTo || "(未設定)"}
          </div>
          <div>
            <span className="text-gray-400">Subject:</span> 【物件名】資料ダウンロードのご案内
          </div>
        </div>
        <p className="text-xs text-gray-500 mt-2">
          現在の設定は{" "}
          <strong>{EMAIL_SEND_MODE_LABEL[mode]}</strong>
        </p>
      </div>

      <div className="flex justify-end">
        <button onClick={onSave} className="btn-primary">
          保存
        </button>
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  onCopy,
}: {
  label: string;
  value: string;
  onCopy?: () => void;
}) {
  return (
    <div className="flex items-start gap-2">
      <div className="text-xs text-gray-500 w-20 shrink-0 pt-1.5">{label}</div>
      <div className="flex-1 min-w-0">
        <code className="block bg-gray-50 border border-gray-200 rounded px-2 py-1.5 text-xs break-all font-mono">
          {value}
        </code>
      </div>
      {onCopy && (
        <button
          onClick={onCopy}
          className="text-gray-400 hover:text-gray-700 p-1.5"
          title="コピー"
        >
          <Copy className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}

function DetectedField({
  icon: Icon,
  label,
  value,
  meta,
  status,
  mono,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  meta?: string;
  status?: "ok" | "warn";
  mono?: boolean;
}) {
  return (
    <div className="flex items-start gap-2">
      <Icon className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" />
      <div className="min-w-0 flex-1">
        <div className="text-xs text-gray-500">{label}</div>
        <div
          className={
            "text-sm text-gray-900 break-words " + (mono ? "font-mono text-xs" : "")
          }
        >
          {value}
        </div>
        {meta && (
          <div
            className={
              "text-xs mt-0.5 " +
              (status === "warn"
                ? "text-amber-700"
                : status === "ok"
                  ? "text-emerald-700"
                  : "text-gray-500")
            }
          >
            {meta}
          </div>
        )}
      </div>
    </div>
  );
}
