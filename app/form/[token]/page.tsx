"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  Building2,
  MapPin,
  Train,
  Calendar,
  JapaneseYen,
  Upload,
  X,
  Camera,
  Image as ImageIcon,
} from "lucide-react";
import { compressImage } from "@/lib/imageCompress";
import {
  createInquiry,
  getDefaultTemplate,
  getEmailSendSettings,
  getNotificationSettings,
  getPropertyByToken,
  getTenant,
  initStore,
  recordSentEmail,
  resolveTenantIdFromToken,
  renderTemplate,
} from "@/lib/store";
import {
  PROPERTY_TYPE_LABEL,
  type Property,
  type Tenant,
} from "@/lib/types";
import { formatYen, formatDateTime } from "@/lib/format";
import { useToast } from "@/components/Toast";

const RELAY_FROM_EMAIL = "no-reply@bukkenlink.com";

export default function FormPage() {
  const params = useParams<{ token: string }>();
  const router = useRouter();
  const toast = useToast();
  const [property, setProperty] = useState<Property | null>(null);
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [loading, setLoading] = useState(true);

  const [companyName, setCompanyName] = useState("");
  const [contactName, setContactName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // 名刺画像: 任意。ファイル選択 / D&D / スマホは撮影もOK。
  const [cardFile, setCardFile] = useState<File | null>(null);
  const [cardPreview, setCardPreview] = useState<string | null>(null);
  const [isCardDragOver, setIsCardDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const pickCard = (file: File | undefined | null) => {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.show("名刺画像は5MB以下にしてください", "error");
      return;
    }
    if (!file.type.startsWith("image/")) {
      toast.show("画像ファイルを選択してください", "error");
      return;
    }
    setCardFile(file);
    setCardPreview(URL.createObjectURL(file));
  };

  const removeCard = () => {
    setCardFile(null);
    if (cardPreview) URL.revokeObjectURL(cardPreview);
    setCardPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (cameraInputRef.current) cameraInputRef.current.value = "";
  };

  useEffect(() => {
    let cancelled = false;
    // Public form: figure out which tenant owns this token first, then load
    // the store under that tenant. Otherwise the cache would be populated
    // for whatever tenant happens to be in this browser's localStorage
    // (typically wrong / not the property's owner).
    void resolveTenantIdFromToken(params.token, "form")
      .then((tenantId) => {
        if (cancelled) return null;
        if (!tenantId) {
          setLoading(false);
          return null;
        }
        return initStore(tenantId);
      })
      .then(() => {
        if (cancelled) return;
        const p = getPropertyByToken(params.token);
        if (p) {
          setProperty(p);
          setTenant(getTenant(p.tenant_id) ?? null);
        }
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [params.token]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!property || !tenant) return;
    if (!agreed) {
      toast.show("個人情報の取り扱いに同意してください", "error");
      return;
    }
    if (!/^.+@.+\..+$/.test(email)) {
      toast.show("正しいメールアドレスを入力してください", "error");
      return;
    }
    setSubmitting(true);

    // Pull the real client IP from the edge. If the network call fails for
    // any reason (offline, blocked) we still want the inquiry to go through
    // — just record an empty string and move on.
    let clientIp = "";
    try {
      const res = await fetch("/api/client-ip", { cache: "no-store" });
      if (res.ok) {
        const json = (await res.json()) as { ip?: string };
        clientIp = json.ip ?? "";
      }
    } catch {
      /* ignore — best-effort */
    }

    // Upload business card to the tenant-scoped storage path first (if any).
    // The card is logically the *tenant\'s* data, not the operator\'s — so we
    // path-scope it per tenant. The bucket is private; the tenant admin views
    // it via signed URL from /inquiries.
    let cardPath: string | null = null;
    let cardProvider: string | null = null;
    if (cardFile) {
      try {
        // Compress on the client first (typically 8–10× smaller). Falls
        // back to the original file if the browser can\'t decode it.
        const optimized = await compressImage(cardFile, {
          maxDim: 1600,
          quality: 0.8,
        });
        // Hand off to the server endpoint, which routes to the tenant\'s
        // Google Drive when connected, otherwise falls back to the
        // Supabase business-cards bucket. We pass form_token (NOT
        // tenant_id) so the server can verify the inquirer actually came
        // through this property\'s form.
        const fd = new FormData();
        fd.append("file", optimized, optimized.name);
        fd.append("form_token", params.token);
        const res = await fetch("/api/upload/business-card", {
          method: "POST",
          body: fd,
        });
        const json = (await res.json()) as {
          ok?: boolean;
          provider?: string;
          path?: string;
          error?: string;
        };
        if (!res.ok || !json.ok || !json.path) {
          toast.show(
            "名刺画像のアップロードに失敗しました: " +
              (json.error ?? "unknown"),
            "error"
          );
          setSubmitting(false);
          return;
        }
        cardPath = json.path;
        cardProvider = json.provider ?? "bukkenlink";
      } catch (err) {
        toast.show(
          "名刺画像の送信に失敗しました: " +
            (err instanceof Error ? err.message : String(err)),
          "error"
        );
        setSubmitting(false);
        return;
      }
    }

    const tokenExpires = new Date();
    tokenExpires.setDate(tokenExpires.getDate() + 7);
    const inquiry = createInquiry({
      tenant_id: tenant.id,
      property_id: property.id,
      company_name: companyName,
      // 宅建業免許番号 はフォームから削除した。空文字で保存して後方互換を保つ。
      license_number: "",
      contact_name: contactName,
      phone,
      email,
      message,
      status: "new",
      token_expires_at: tokenExpires.toISOString(),
      download_limit: 10,
      ip_address: clientIp,
      user_agent: typeof navigator !== "undefined" ? navigator.userAgent : "",
      business_card_url: cardPath,
      business_card_provider: cardProvider,
    });

    const sendCfg = getEmailSendSettings(tenant.id);
    const tpl = getDefaultTemplate(tenant.id);
    if (tpl) {
      const dlUrl = window.location.origin + "/download/" + inquiry.download_token;
      const vars: Record<string, string> = {
        会社名: companyName,
        担当者名: contactName,
        物件名: property.title,
        資料URL: dlUrl,
        有効期限: formatDateTime(inquiry.token_expires_at),
      };

      const fromDisplayName = sendCfg?.from_display_name ?? tenant.name;
      const replyTo = sendCfg?.reply_to_email ?? null;
      const mode = sendCfg?.mode ?? "relay_with_cc";
      const fromEmail =
        mode === "custom_domain" && sendCfg?.from_email
          ? sendCfg.from_email
          : RELAY_FROM_EMAIL;
      const cc = mode === "relay_with_cc" ? sendCfg?.cc_emails ?? [] : [];

      recordSentEmail({
        tenant_id: tenant.id,
        to: email,
        subject: renderTemplate(tpl.subject, vars),
        body: renderTemplate(tpl.body, vars),
        kind: "auto_reply",
        from_email: fromEmail,
        from_display_name: fromDisplayName,
        reply_to: replyTo,
        cc: cc.length > 0 ? cc : null,
        send_mode: mode,
      });
    }

    const notif = getNotificationSettings(tenant.id);
    if (notif) {
      notif.email_recipients.forEach((to) => {
        recordSentEmail({
          tenant_id: tenant.id,
          to,
          subject: "【BukkenLink】新着問い合わせ:" + property.title,
          body:
            companyName +
            " の " +
            contactName +
            " 様から「" +
            property.title +
            "」へ問い合わせがありました。\n管理画面でご確認ください。",
          kind: "notification",
          from_email: RELAY_FROM_EMAIL,
          from_display_name: "BukkenLink",
          reply_to: null,
          cc: null,
          send_mode: "relay_with_cc",
        });
      });
    }

    setTimeout(() => {
      router.push("/form/" + params.token + "/success?dl=" + inquiry.download_token);
    }, 400);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-500">
        読み込み中...
      </div>
    );
  }

  if (!property || !tenant || property.status !== "published") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="card p-8 max-w-md text-center">
          <h1 className="text-xl font-bold text-gray-900 mb-2">フォームが見つかりません</h1>
          <p className="text-sm text-gray-500">
            URLが正しくないか、物件が現在公開されていない可能性があります。
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center gap-3">
          {tenant.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={tenant.logo_url}
              alt={tenant.name}
              className="h-8 max-w-[160px] object-contain"
            />
          ) : (
            <div className="w-8 h-8 rounded bg-brand-600 text-white flex items-center justify-center font-bold">
              {tenant.name.charAt(0)}
            </div>
          )}
          <div>
            <div className="font-semibold text-gray-900 text-sm">{tenant.name}</div>
            <div className="text-xs text-gray-500">{tenant.license_number}</div>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        <div className="card p-6">
          <div className="flex items-center gap-2 mb-2">
            <span className="badge bg-brand-50 text-brand-700">
              {PROPERTY_TYPE_LABEL[property.property_type]}
            </span>
            {property.reins_id && (
              <span className="text-xs text-gray-500 font-mono">{property.reins_id}</span>
            )}
          </div>
          <h1 className="text-xl font-bold text-gray-900 mb-3">{property.title}</h1>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <Field icon={JapaneseYen} label="価格" value={formatYen(property.price)} />
            <Field icon={MapPin} label="所在地" value={property.address} />
            {property.land_area && (
              <Field icon={MapPin} label="土地" value={property.land_area + " ㎡"} />
            )}
            {property.building_area && (
              <Field icon={Building2} label="建物" value={property.building_area + " ㎡"} />
            )}
            {property.built_year_month && (
              <Field icon={Calendar} label="築年月" value={property.built_year_month} />
            )}
            {property.transport && (
              <Field icon={Train} label="交通" value={property.transport} />
            )}
          </div>
        </div>

        <div className="card p-6">
          <h2 className="font-semibold text-gray-900 mb-1">お問い合わせフォーム</h2>
          <p className="text-xs text-gray-500 mb-6">
            送信後、ご記入いただいたメールアドレスに資料DLリンクをお送りします。
          </p>
          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <label className="label">
                会社名 <span className="text-red-500">*</span>
              </label>
              <input
                className="input"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                required
              />
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="label">
                  担当者名 <span className="text-red-500">*</span>
                </label>
                <input
                  className="input"
                  value={contactName}
                  onChange={(e) => setContactName(e.target.value)}
                  required
                />
              </div>
              <div>
                <label className="label">
                  電話番号 <span className="text-red-500">*</span>
                </label>
                <input
                  className="input"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  required
                />
              </div>
            </div>
            <div>
              <label className="label">
                メールアドレス <span className="text-red-500">*</span>
              </label>
              <input
                type="email"
                className="input"
                placeholder="example@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
              <p className="text-xs text-gray-500 mt-1">
                このアドレスに資料DLリンクをお送りします
              </p>
            </div>
            <div>
              <label className="label">問い合わせ内容(任意)</label>
              <textarea
                className="input min-h-[100px]"
                placeholder="ご質問・ご要望があればご記入ください"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
              />
            </div>

            <div>
              <label className="label">名刺画像(任意)</label>
              {cardPreview ? (
                <div className="relative inline-block">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={cardPreview}
                    alt="名刺プレビュー"
                    className="rounded border border-gray-200 max-h-44 object-contain"
                  />
                  <button
                    type="button"
                    onClick={removeCard}
                    className="absolute -top-2 -right-2 bg-white border border-gray-300 rounded-full p-1 shadow hover:bg-gray-50"
                    aria-label="削除"
                  >
                    <X className="w-3.5 h-3.5 text-gray-600" />
                  </button>
                </div>
              ) : (
                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    setIsCardDragOver(true);
                  }}
                  onDragLeave={() => setIsCardDragOver(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setIsCardDragOver(false);
                    pickCard(e.dataTransfer.files?.[0]);
                  }}
                  className={
                    "rounded border-2 border-dashed p-4 text-center text-sm transition " +
                    (isCardDragOver
                      ? "border-brand-500 bg-brand-50"
                      : "border-gray-300 hover:border-gray-400 bg-gray-50")
                  }
                >
                  <ImageIcon className="w-8 h-8 mx-auto text-gray-400 mb-2" />
                  <div className="text-gray-600 mb-3">
                    ドラッグ&ドロップ または
                  </div>
                  <div className="flex gap-2 justify-center flex-wrap">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="btn-secondary text-xs"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      ファイル選択
                    </button>
                    <button
                      type="button"
                      onClick={() => cameraInputRef.current?.click()}
                      className="btn-secondary text-xs sm:hidden"
                    >
                      <Camera className="w-3.5 h-3.5" />
                      撮影
                    </button>
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => pickCard(e.target.files?.[0])}
                  />
                  <input
                    ref={cameraInputRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    onChange={(e) => pickCard(e.target.files?.[0])}
                  />
                </div>
              )}
              <p className="text-xs text-gray-500 mt-1">
                5MB以下のJPG / PNG / WEBP / HEIC。スマホは撮影もできます。
              </p>
            </div>

            <label className="flex items-start gap-3 p-3 rounded bg-gray-50 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={agreed}
                onChange={(e) => setAgreed(e.target.checked)}
                className="mt-0.5"
              />
              <div>
                <span className="text-red-500">*</span>{" "}
                <Link
                  href="/privacy"
                  target="_blank"
                  rel="noreferrer"
                  className="text-brand-600 hover:underline"
                >
                  個人情報の取り扱い
                </Link>
                に同意します
              </div>
            </label>

            <button
              type="submit"
              disabled={submitting}
              className="btn-primary w-full text-base py-3"
            >
              {submitting ? "送信中..." : "資料を取得する"}
            </button>
          </form>
        </div>

        <footer className="text-center text-xs text-gray-400 py-4">
          Powered by BukkenLink
        </footer>
      </main>
    </div>
  );
}

function Field({
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
        <div className="text-xs text-gray-500">{label}</div>
        <div className="text-sm text-gray-900 break-words">{value}</div>
      </div>
    </div>
  );
}
