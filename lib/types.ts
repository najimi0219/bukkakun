// BukkenLink shared types (mirrors spec section 5)

export type Plan = "free" | "standard" | "pro";
export type UserRole = "admin" | "sales" | "viewer";
export type PropertyType = "land" | "house" | "mansion" | "income" | "business";
export type PropertyStatus = "published" | "draft";
export type InquiryStatus =
  | "new"
  | "in_progress"
  | "negotiating"
  | "closed"
  | "rejected";
export type InquiryActionType = "status_change" | "note" | "email_sent";
export type NotificationTiming = "immediate" | "daily";
export type StorageProvider =
  | "bukkenlink"
  | "gdrive"
  | "dropbox"
  | "onedrive"
  | "box"
  | "s3";
export type StorageStatus = "connected" | "expired" | "error";
export type EmailSendMode = "relay_with_cc" | "custom_domain";
export type DomainVerificationStatus =
  | "not_started"
  | "pending"
  | "verified"
  | "failed";
export type DnsProvider =
  | "cloudflare"
  | "onamae"
  | "muumuu"
  | "xserver"
  | "sakura"
  | "google_domains"
  | "route53"
  | "value_domain"
  | "azure_dns"
  | "unknown";
export type MailProvider =
  | "google_workspace"
  | "microsoft365"
  | "ix"
  | "sakura"
  | "self_hosted"
  | "unknown";

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  license_number: string;
  logo_url: string | null;
  plan: Plan;
  stripe_customer_id: string | null;
  address?: string;
  phone?: string | null;
  business_card_url?: string | null;
  created_at: string;
}

export interface User {
  id: string;
  tenant_id: string;
  email: string;
  password?: string | null;
  name: string;
  role: UserRole;
  created_at: string;
}

export interface Property {
  id: string;
  tenant_id: string;
  title: string;
  property_type: PropertyType;
  address: string;
  price: number;
  land_area: number | null;
  building_area: number | null;
  built_year_month: string | null;
  transport: string;
  description: string;
  reins_id: string | null;
  status: PropertyStatus;
  form_token: string;
  assignee_ids: string[];
  // 公開フォームでの住所表示制御 + 内見対応設定 (kind=viewing用)
  show_address?: boolean;
  viewing_available?: boolean;
  viewing_methods?: ViewingMethod[];
  viewing_key_pickup_info?: string | null;
  viewing_key_box_code?: string | null;
  viewing_notes?: string | null;
  // 販売状況 (Phase A)
  availability_status?: AvailabilityStatus;
  availability_updated_at?: string;
  verification_frequency_days?: number;
  verification_email_enabled?: boolean;
  verification_last_emailed_at?: string | null;
  created_at: string;
}

export interface PropertyDocument {
  id: string;
  property_id: string;
  storage_connection_id: string | null;
  storage_provider: StorageProvider;
  external_file_id: string;
  external_view_url: string;
  file_data: string;
  file_name: string;
  file_size: number;
  mime_type: string;
  created_at: string;
}

export interface StorageConnection {
  id: string;
  tenant_id: string;
  provider: StorageProvider;
  display_name: string;
  account_email: string;
  root_folder_id: string;
  root_folder_name: string;
  status: StorageStatus;
  is_default: boolean;
  mock_token_hint: string;
  // Real OAuth fields (populated by /api/oauth/{provider}/callback).
  // mock_token_hint stays for legacy/mock providers still in the UI.
  access_token?: string | null;
  refresh_token?: string | null;
  token_expires_at?: string | null;
  scope?: string | null;
  created_at: string;
  last_sync_at: string;
}

export type InquiryKind =
  | "location"
  | "documents"
  | "viewing"
  | "other"
  | "offer";

export const INQUIRY_KIND_LABEL: Record<InquiryKind, string> = {
  location: "所在確認",
  documents: "資料請求",
  viewing: "案内希望",
  other: "その他の質問",
  offer: "買付送付",
};

export const INQUIRY_KIND_COLOR: Record<InquiryKind, string> = {
  location: "bg-sky-100 text-sky-700",
  documents: "bg-emerald-100 text-emerald-700",
  viewing: "bg-amber-100 text-amber-700",
  other: "bg-gray-100 text-gray-700",
  offer: "bg-purple-100 text-purple-700",
};

export type ViewingMethod = "key_pickup" | "key_box" | "attended";

export const VIEWING_METHOD_LABEL: Record<ViewingMethod, string> = {
  key_pickup: "鍵取り",
  key_box: "キーボックス",
  attended: "立会い",
};

// 物件の販売状況 (公開/申込あり/商談中/終了)
export type AvailabilityStatus =
  | "available"
  | "reserved"
  | "negotiating"
  | "closed";

export const AVAILABILITY_STATUS_LABEL: Record<AvailabilityStatus, string> = {
  available: "公開中",
  reserved: "申込あり",
  negotiating: "商談中",
  closed: "終了",
};

export const AVAILABILITY_STATUS_COLOR: Record<AvailabilityStatus, string> = {
  available: "bg-emerald-100 text-emerald-700",
  reserved: "bg-amber-100 text-amber-700",
  negotiating: "bg-sky-100 text-sky-700",
  closed: "bg-gray-100 text-gray-600",
};

export interface Inquiry {
  id: string;
  tenant_id: string;
  property_id: string;
  company_name: string;
  license_number: string;
  contact_name: string;
  phone: string;
  email: string;
  message: string;
  status: InquiryStatus;
  download_token: string;
  token_expires_at: string;
  download_count: number;
  download_limit: number;
  ip_address: string;
  user_agent: string;
  business_card_url?: string | null;
  business_card_provider?: string | null;
  // 問い合わせ種別 (5種) + 種別固有フィールド
  kind?: InquiryKind;
  viewing_preferred_at?: string | null;
  viewing_method?: ViewingMethod | null;
  offer_document_url?: string | null;
  offer_document_provider?: string | null;
  created_at: string;
}

export interface InquiryLog {
  id: string;
  inquiry_id: string;
  user_id: string | null;
  action_type: InquiryActionType;
  content: string;
  created_at: string;
}

export interface DownloadLog {
  id: string;
  inquiry_id: string;
  document_id: string;
  ip_address: string;
  user_agent: string;
  downloaded_at: string;
}

export interface EmailTemplate {
  id: string;
  tenant_id: string;
  name: string;
  subject: string;
  body: string;
  is_default: boolean;
  // 問い合わせ種別ごとの自動返信テンプレ。null/未設定 は手動返信用のカスタムテンプレ。
  kind?: InquiryKind | null;
}

export interface NotificationSettings {
  id: string;
  tenant_id: string;
  email_recipients: string[];
  slack_webhook: string;
  line_token: string;
  chatwork_token: string;
  timing: NotificationTiming;
}

export interface Session {
  user_id: string;
  tenant_id: string;
  loggedInAt: string;
}

export interface SentEmail {
  id: string;
  tenant_id: string;
  to: string;
  subject: string;
  body: string;
  sent_at: string;
  kind: "auto_reply" | "manual" | "notification";
  from_email?: string | null;
  from_display_name?: string | null;
  reply_to?: string | null;
  cc?: string[] | null;
  send_mode?: EmailSendMode | null;
}

export interface VerificationDnsRecord {
  type: "TXT" | "CNAME" | "MX";
  host: string;
  value: string;
  priority?: number;
  purpose: "spf" | "dkim" | "return_path" | "delegation";
  note?: string;
}

export interface EmailSendSettings {
  id: string;
  tenant_id: string;
  mode: EmailSendMode;
  from_display_name: string | null;
  from_email: string | null;
  reply_to_email: string;
  cc_emails: string[];
  custom_domain: string | null;
  detected_dns_provider: DnsProvider | null;
  detected_mail_provider: MailProvider | null;
  detected_existing_spf: string | null;
  verification_status: DomainVerificationStatus;
  verification_last_checked_at: string | null;
  verification_dns_records: VerificationDnsRecord[] | null;
  verification_error: string | null;
  created_at: string;
  updated_at: string;
}

export interface DB {
  tenants: Tenant[];
  users: User[];
  properties: Property[];
  property_documents: PropertyDocument[];
  storage_connections: StorageConnection[];
  inquiries: Inquiry[];
  inquiry_logs: InquiryLog[];
  download_logs: DownloadLog[];
  email_templates: EmailTemplate[];
  notification_settings: NotificationSettings[];
  email_send_settings: EmailSendSettings[];
  sent_emails: SentEmail[];
  session: Session | null;
}

export const PROPERTY_TYPE_LABEL: Record<PropertyType, string> = {
  land: "土地",
  house: "戸建",
  mansion: "マンション",
  income: "収益",
  business: "事業用",
};

export const INQUIRY_STATUS_LABEL: Record<InquiryStatus, string> = {
  new: "未対応",
  in_progress: "対応中",
  negotiating: "商談中",
  closed: "成約",
  rejected: "却下",
};

export const INQUIRY_STATUS_COLOR: Record<InquiryStatus, string> = {
  new: "bg-red-100 text-red-700",
  in_progress: "bg-amber-100 text-amber-700",
  negotiating: "bg-blue-100 text-blue-700",
  closed: "bg-emerald-100 text-emerald-700",
  rejected: "bg-gray-100 text-gray-600",
};

export const ROLE_LABEL: Record<UserRole, string> = {
  admin: "管理者",
  sales: "営業担当",
  viewer: "閲覧のみ",
};

export const PLAN_LABEL: Record<Plan, string> = {
  free: "Free",
  standard: "Standard",
  pro: "Pro",
};

export const PLAN_LIMITS: Record<Plan, { properties: number; inquiries: number }> = {
  free: { properties: 3, inquiries: 20 },
  standard: { properties: 30, inquiries: 300 },
  pro: { properties: Infinity, inquiries: Infinity },
};

export const STORAGE_PROVIDER_LABEL: Record<StorageProvider, string> = {
  bukkenlink: "BukkenLink ホスト",
  gdrive: "Google Drive",
  dropbox: "Dropbox",
  onedrive: "OneDrive",
  box: "Box",
  s3: "S3 互換ストレージ",
};

export const STORAGE_PROVIDER_COLOR: Record<StorageProvider, string> = {
  bukkenlink: "bg-gray-100 text-gray-700",
  gdrive: "bg-emerald-50 text-emerald-700",
  dropbox: "bg-blue-50 text-blue-700",
  onedrive: "bg-sky-50 text-sky-700",
  box: "bg-indigo-50 text-indigo-700",
  s3: "bg-amber-50 text-amber-700",
};

export const DNS_PROVIDER_LABEL: Record<DnsProvider, string> = {
  cloudflare: "Cloudflare",
  onamae: "お名前.com",
  muumuu: "ムームードメイン",
  xserver: "Xserver",
  sakura: "さくらインターネット",
  google_domains: "Google Domains / Cloud DNS",
  route53: "AWS Route 53",
  value_domain: "バリュードメイン",
  azure_dns: "Azure DNS",
  unknown: "不明",
};

export const MAIL_PROVIDER_LABEL: Record<MailProvider, string> = {
  google_workspace: "Google Workspace",
  microsoft365: "Microsoft 365",
  ix: "iX (DMS)",
  sakura: "さくらのメール",
  self_hosted: "自社サーバ",
  unknown: "不明 / 未設定",
};

// Which DNS providers support full automation via API + OAuth.
export const DNS_PROVIDER_API_AUTOMATABLE: Record<DnsProvider, boolean> = {
  cloudflare: true,
  google_domains: true,
  route53: true,
  azure_dns: true,
  onamae: false,
  muumuu: false,
  xserver: false,
  sakura: false,
  value_domain: false,
  unknown: false,
};

export const EMAIL_SEND_MODE_LABEL: Record<EmailSendMode, string> = {
  relay_with_cc: "BukkenLink から代理送信 (Cc にテナント)",
  custom_domain: "テナント自社ドメインから直接送信",
};
