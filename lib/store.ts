"use client";

/**
 * BukkenLink data store
 * Backed by Supabase, exposed through a sync, cache-first API so the UI
 * components keep working without per-call await.
 */

import { getSupabase } from "./supabase";
import { getCurrentTenantId } from "./session";
import type {
  DB,
  Tenant,
  User,
  Property,
  PropertyDocument,
  StorageConnection,
  Inquiry,
  InquiryLog,
  DownloadLog,
  EmailTemplate,
  EmailSendSettings,
  NotificationSettings,
  Session,
  SentEmail,
} from "./types";

let cache: DB | null = null;
let initPromise: Promise<DB> | null = null;
// The tenant_id `cache` currently belongs to. We compare against this when
// initStore is called with an explicit override (used by public form/DL
// pages) so we know whether to invalidate and re-fetch.
let cachedTenantId: string | null = null;

const sb = () => getSupabase();

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

function notifyChange(): void {
  if (!isBrowser()) return;
  window.dispatchEvent(new CustomEvent("bukkenlink:dbchange"));
}

function emptyDB(): DB {
  return {
    tenants: [],
    users: [],
    properties: [],
    property_documents: [],
    storage_connections: [],
    inquiries: [],
    inquiry_logs: [],
    download_logs: [],
    email_templates: [],
    notification_settings: [],
    email_send_settings: [],
    sent_emails: [],
    session: null,
  };
}

/**
 * Generate a v4 UUID compatible with Postgres `uuid` columns. Falls back to
 * Node's `crypto.randomUUID` when running on the server (Next.js Route
 * Handlers etc.) and to a manually constructed v4 UUID when neither is
 * available (very old environments). The non-`randomUUID` fallback is
 * deliberately RFC-4122 compliant — earlier versions returned a "uuid-..."
 * string which violated the `uuid` column constraint and broke inserts.
 */
export function uid(): string {
  // Browser & modern Node both expose globalThis.crypto.randomUUID.
  if (typeof globalThis !== "undefined" && globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }
  // Fallback: build a v4 UUID by hand from random bytes.
  const bytes = new Uint8Array(16);
  if (typeof globalThis !== "undefined" && globalThis.crypto?.getRandomValues) {
    globalThis.crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < 16; i += 1) bytes[i] = Math.floor(Math.random() * 256);
  }
  bytes[6] = (bytes[6] & 0x0f) | 0x40; // version 4
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // variant 10
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  return (
    hex.slice(0, 8) +
    "-" +
    hex.slice(8, 12) +
    "-" +
    hex.slice(12, 16) +
    "-" +
    hex.slice(16, 20) +
    "-" +
    hex.slice(20, 32)
  );
}

export function isStoreReady(): boolean {
  return !!cache;
}

export async function initStore(tenantIdOverride?: string): Promise<DB> {
  const target = tenantIdOverride ?? getCurrentTenantId();
  // If we already have a hydrated cache AND it's for the same tenant, reuse.
  if (cache && cachedTenantId === target) return cache;
  // If a load is in flight for the same tenant, wait on it.
  if (initPromise && cachedTenantId === target) return initPromise;
  // Otherwise switch tenants: drop cache and start a fresh fetch.
  cache = null;
  cachedTenantId = target;
  initPromise = fetchAll(target).then((db) => {
    cache = db;
    notifyChange();
    return db;
  });
  return initPromise;
}

/**
 * Public-form / public-download pages don't know in advance which tenant
 * owns the token in the URL. Hit Supabase directly (no cache, no tenant
 * filter) to figure it out so we can hydrate the store under that tenant.
 */
export async function resolveTenantIdFromToken(
  token: string,
  kind: "form" | "download"
): Promise<string | null> {
  if (!token) return null;
  const c = sb();
  if (kind === "form") {
    const { data } = await c
      .from("properties")
      .select("tenant_id")
      .eq("form_token", token)
      .maybeSingle();
    return (data?.tenant_id as string | undefined) ?? null;
  }
  const { data } = await c
    .from("inquiries")
    .select("tenant_id")
    .eq("download_token", token)
    .maybeSingle();
  return (data?.tenant_id as string | undefined) ?? null;
}

async function fetchAll(tenantId: string): Promise<DB> {
  const c = sb();

  const [
    tenantsRes,
    usersRes,
    propertiesRes,
    assigneesRes,
    storageConnsRes,
    docsRes,
    inquiriesRes,
    logsRes,
    dlLogsRes,
    templatesRes,
    notifRes,
    emailSendRes,
    sentEmailsRes,
  ] = await Promise.all([
    c.from("tenants").select("*").eq("id", tenantId),
    c.from("users").select("*").eq("tenant_id", tenantId),
    c.from("properties").select("*").eq("tenant_id", tenantId),
    c.from("property_assignees").select("*"),
    c.from("storage_connections").select("*").eq("tenant_id", tenantId),
    c.from("property_documents").select("*"),
    c.from("inquiries").select("*").eq("tenant_id", tenantId),
    c.from("inquiry_logs").select("*"),
    c.from("download_logs").select("*"),
    c.from("email_templates").select("*").eq("tenant_id", tenantId),
    c.from("notification_settings").select("*").eq("tenant_id", tenantId),
    c.from("email_send_settings").select("*").eq("tenant_id", tenantId),
    c.from("sent_emails").select("*").eq("tenant_id", tenantId),
  ]);

  const errors = [
    tenantsRes.error,
    usersRes.error,
    propertiesRes.error,
    assigneesRes.error,
    storageConnsRes.error,
    docsRes.error,
    inquiriesRes.error,
    logsRes.error,
    dlLogsRes.error,
    templatesRes.error,
    notifRes.error,
    emailSendRes.error,
    sentEmailsRes.error,
  ].filter(Boolean);
  if (errors.length) {
    console.error("[BukkenLink] fetchAll error", errors);
    if (errors.some((e) => e?.message?.includes("relation") || e?.code === "PGRST301")) {
      console.warn("[BukkenLink] Falling back to empty store. Did you run `supabase start`?");
      return emptyDB();
    }
  }

  const assigneesByProperty: Record<string, string[]> = {};
  (assigneesRes.data ?? []).forEach((a: any) => {
    if (!assigneesByProperty[a.property_id]) assigneesByProperty[a.property_id] = [];
    assigneesByProperty[a.property_id].push(a.user_id);
  });

  const properties: Property[] = (propertiesRes.data ?? []).map((p: any) => ({
    id: p.id,
    tenant_id: p.tenant_id,
    title: p.title,
    property_type: p.property_type,
    address: p.address,
    price: Number(p.price),
    land_area: p.land_area != null ? Number(p.land_area) : null,
    building_area: p.building_area != null ? Number(p.building_area) : null,
    built_year_month: p.built_year_month,
    transport: p.transport ?? "",
    description: p.description ?? "",
    reins_id: p.reins_id,
    status: p.status,
    form_token: p.form_token,
    assignee_ids: assigneesByProperty[p.id] ?? [],
    created_at: p.created_at,
  }));

  const property_documents: PropertyDocument[] = (docsRes.data ?? []).map((d: any) => ({
    id: d.id,
    property_id: d.property_id,
    storage_connection_id: d.storage_connection_id,
    storage_provider: d.storage_provider,
    external_file_id: d.external_file_id,
    external_view_url: d.external_view_url ?? "",
    file_data: "",
    file_name: d.file_name,
    file_size: Number(d.file_size),
    mime_type: d.mime_type,
    created_at: d.created_at,
  }));

  const inquiries: Inquiry[] = (inquiriesRes.data ?? []).map((i: any) => ({
    id: i.id,
    tenant_id: i.tenant_id,
    property_id: i.property_id,
    company_name: i.company_name,
    license_number: i.license_number,
    contact_name: i.contact_name,
    phone: i.phone,
    email: i.email,
    message: i.message ?? "",
    status: i.status,
    download_token: i.download_token,
    token_expires_at: i.token_expires_at,
    download_count: i.download_count,
    download_limit: i.download_limit,
    ip_address: i.ip_address ?? "",
    user_agent: i.user_agent ?? "",
    created_at: i.created_at,
  }));

  const sent_emails: SentEmail[] = (sentEmailsRes.data ?? []).map((e: any) => ({
    id: e.id,
    tenant_id: e.tenant_id,
    to: e.to_address,
    subject: e.subject,
    body: e.body,
    kind: e.kind,
    sent_at: e.sent_at,
    from_email: e.from_email ?? null,
    from_display_name: e.from_display_name ?? null,
    reply_to: e.reply_to ?? null,
    cc: e.cc ?? null,
    send_mode: e.send_mode ?? null,
  }));

  const email_send_settings: EmailSendSettings[] = (emailSendRes.data ?? []).map(
    (e: any) => ({
      id: e.id,
      tenant_id: e.tenant_id,
      mode: e.mode,
      from_display_name: e.from_display_name,
      from_email: e.from_email,
      reply_to_email: e.reply_to_email,
      cc_emails: e.cc_emails ?? [],
      custom_domain: e.custom_domain,
      detected_dns_provider: e.detected_dns_provider,
      detected_mail_provider: e.detected_mail_provider,
      detected_existing_spf: e.detected_existing_spf,
      verification_status: e.verification_status,
      verification_last_checked_at: e.verification_last_checked_at,
      verification_dns_records: e.verification_dns_records,
      verification_error: e.verification_error,
      created_at: e.created_at,
      updated_at: e.updated_at,
    })
  );

  return {
    tenants: tenantsRes.data ?? [],
    users: usersRes.data ?? [],
    properties,
    property_documents,
    storage_connections: storageConnsRes.data ?? [],
    inquiries,
    inquiry_logs: logsRes.data ?? [],
    download_logs: (dlLogsRes.data ?? []).map((d: any) => ({
      id: d.id,
      inquiry_id: d.inquiry_id,
      document_id: d.document_id,
      ip_address: d.ip_address ?? "",
      user_agent: d.user_agent ?? "",
      downloaded_at: d.downloaded_at,
    })),
    email_templates: templatesRes.data ?? [],
    notification_settings: notifRes.data ?? [],
    email_send_settings,
    sent_emails,
    session: null,
  };
}

export function loadDB(): DB {
  if (cache) return cache;
  return emptyDB();
}

export function saveDB(_db: DB): void {
  notifyChange();
}

export function resetDB(): void {
  cache = null;
  initPromise = null;
  void initStore();
}

export function mutate(updater: (db: DB) => DB | void): DB {
  if (!cache) cache = emptyDB();
  const next = updater(cache);
  if (next) cache = next;
  notifyChange();
  return cache;
}

function fireAndForget<T>(p: PromiseLike<T>, label: string): void {
  Promise.resolve(p).then(
    (res: any) => {
      if (res?.error) {
        console.error("[BukkenLink] " + label + " failed", res.error);
      }
    },
    (err) => {
      console.error("[BukkenLink] " + label + " threw", err);
    }
  );
}

// Tenants
export function getTenant(id: string): Tenant | undefined {
  return loadDB().tenants.find((t) => t.id === id);
}
export function getTenantBySlug(slug: string): Tenant | undefined {
  return loadDB().tenants.find((t) => t.slug === slug);
}
export function updateTenant(id: string, patch: Partial<Tenant>): void {
  if (cache) {
    const idx = cache.tenants.findIndex((t) => t.id === id);
    if (idx >= 0) cache.tenants[idx] = { ...cache.tenants[idx], ...patch };
    notifyChange();
  }
  fireAndForget(sb().from("tenants").update(patch).eq("id", id), "updateTenant");
}

// Users
export function getUsers(tenantId: string): User[] {
  return loadDB().users.filter((u) => u.tenant_id === tenantId);
}
export function getUser(id: string): User | undefined {
  return loadDB().users.find((u) => u.id === id);
}
export function findUserByEmail(email: string): User | undefined {
  return loadDB().users.find((u) => u.email.toLowerCase() === email.toLowerCase());
}
export function createUser(u: Omit<User, "id" | "created_at">): User {
  const user: User = { ...u, id: uid(), created_at: new Date().toISOString() };
  if (cache) cache.users.push(user);
  notifyChange();
  fireAndForget(
    sb().from("users").insert({
      id: user.id,
      tenant_id: user.tenant_id,
      email: user.email,
      name: user.name,
      role: user.role,
      password: user.password,
      created_at: user.created_at,
    }),
    "createUser"
  );
  return user;
}
export function deleteUser(id: string): void {
  if (cache) cache.users = cache.users.filter((u) => u.id !== id);
  notifyChange();
  fireAndForget(sb().from("users").delete().eq("id", id), "deleteUser");
}

// Properties
export function getProperties(tenantId: string): Property[] {
  return loadDB()
    .properties.filter((p) => p.tenant_id === tenantId)
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
}
export function getProperty(id: string): Property | undefined {
  return loadDB().properties.find((p) => p.id === id);
}
export function getPropertyByToken(token: string): Property | undefined {
  return loadDB().properties.find((p) => p.form_token === token);
}
export function createProperty(p: Omit<Property, "id" | "created_at" | "form_token">): Property {
  const prop: Property = {
    ...p,
    id: uid(),
    form_token: uid(),
    created_at: new Date().toISOString(),
  };
  if (cache) cache.properties.push(prop);
  notifyChange();
  const { assignee_ids, ...rest } = prop;
  fireAndForget(
    (async () => {
      const ins = await sb().from("properties").insert({
        id: rest.id,
        tenant_id: rest.tenant_id,
        title: rest.title,
        property_type: rest.property_type,
        address: rest.address,
        price: rest.price,
        land_area: rest.land_area,
        building_area: rest.building_area,
        built_year_month: rest.built_year_month,
        transport: rest.transport,
        description: rest.description,
        reins_id: rest.reins_id,
        status: rest.status,
        form_token: rest.form_token,
        created_at: rest.created_at,
      });
      if (ins.error) return ins;
      if (assignee_ids?.length) {
        return sb()
          .from("property_assignees")
          .insert(assignee_ids.map((u) => ({ property_id: rest.id, user_id: u })));
      }
      return ins;
    })(),
    "createProperty"
  );
  return prop;
}
export function updateProperty(id: string, patch: Partial<Property>): void {
  if (cache) {
    const idx = cache.properties.findIndex((p) => p.id === id);
    if (idx >= 0) cache.properties[idx] = { ...cache.properties[idx], ...patch };
  }
  notifyChange();
  const { assignee_ids, ...rest } = patch;
  fireAndForget(
    (async () => {
      if (Object.keys(rest).length) {
        const upd = await sb().from("properties").update(rest).eq("id", id);
        if (upd.error) return upd;
      }
      if (assignee_ids !== undefined) {
        await sb().from("property_assignees").delete().eq("property_id", id);
        if (assignee_ids.length) {
          return sb()
            .from("property_assignees")
            .insert(assignee_ids.map((u) => ({ property_id: id, user_id: u })));
        }
      }
      return { error: null };
    })(),
    "updateProperty"
  );
}
export function deleteProperty(id: string): void {
  if (cache) {
    cache.properties = cache.properties.filter((p) => p.id !== id);
    cache.property_documents = cache.property_documents.filter((d) => d.property_id !== id);
  }
  notifyChange();
  fireAndForget(sb().from("properties").delete().eq("id", id), "deleteProperty");
}

// Documents
export function getDocuments(propertyId: string): PropertyDocument[] {
  return loadDB().property_documents.filter((d) => d.property_id === propertyId);
}
export function getDocument(id: string): PropertyDocument | undefined {
  return loadDB().property_documents.find((d) => d.id === id);
}
export function addDocument(doc: Omit<PropertyDocument, "id" | "created_at">): PropertyDocument {
  const d: PropertyDocument = { ...doc, id: uid(), created_at: new Date().toISOString() };
  if (cache) cache.property_documents.push(d);
  notifyChange();
  fireAndForget(
    sb().from("property_documents").insert({
      id: d.id,
      property_id: d.property_id,
      storage_connection_id: d.storage_connection_id,
      storage_provider: d.storage_provider,
      external_file_id: d.external_file_id,
      external_view_url: d.external_view_url || null,
      file_name: d.file_name,
      file_size: d.file_size,
      mime_type: d.mime_type,
      created_at: d.created_at,
    }),
    "addDocument"
  );
  return d;
}
export function deleteDocument(id: string): void {
  if (cache) cache.property_documents = cache.property_documents.filter((d) => d.id !== id);
  notifyChange();
  fireAndForget(sb().from("property_documents").delete().eq("id", id), "deleteDocument");
}

// Storage connections
export function getStorageConnections(tenantId: string): StorageConnection[] {
  return loadDB()
    .storage_connections.filter((c) => c.tenant_id === tenantId)
    .sort((a, b) => a.created_at.localeCompare(b.created_at));
}
export function getStorageConnection(id: string): StorageConnection | undefined {
  return loadDB().storage_connections.find((c) => c.id === id);
}
export function getDefaultStorageConnection(tenantId: string): StorageConnection | undefined {
  const list = getStorageConnections(tenantId);
  return (
    list.find((c) => c.is_default && c.status === "connected") ??
    list.find((c) => c.status === "connected")
  );
}
export function addStorageConnection(
  c: Omit<StorageConnection, "id" | "created_at" | "last_sync_at">
): StorageConnection {
  const now = new Date().toISOString();
  const conn: StorageConnection = { ...c, id: uid(), created_at: now, last_sync_at: now };
  if (cache) {
    if (conn.is_default) {
      cache.storage_connections = cache.storage_connections.map((x) =>
        x.tenant_id === conn.tenant_id ? { ...x, is_default: false } : x
      );
    }
    cache.storage_connections.push(conn);
  }
  notifyChange();
  fireAndForget(sb().from("storage_connections").insert(conn), "addStorageConnection");
  return conn;
}
export function updateStorageConnection(id: string, patch: Partial<StorageConnection>): void {
  if (cache) {
    const idx = cache.storage_connections.findIndex((c) => c.id === id);
    if (idx < 0) return;
    if (patch.is_default) {
      const tenantId = cache.storage_connections[idx].tenant_id;
      cache.storage_connections = cache.storage_connections.map((x) =>
        x.tenant_id === tenantId ? { ...x, is_default: false } : x
      );
    }
    cache.storage_connections[idx] = { ...cache.storage_connections[idx], ...patch };
  }
  notifyChange();
  fireAndForget(
    sb().from("storage_connections").update(patch).eq("id", id),
    "updateStorageConnection"
  );
}
export function deleteStorageConnection(id: string): void {
  if (cache) {
    cache.storage_connections = cache.storage_connections.filter((c) => c.id !== id);
    cache.property_documents = cache.property_documents.map((d) =>
      d.storage_connection_id === id
        ? { ...d, storage_connection_id: null, storage_provider: "bukkenlink" as const }
        : d
    );
  }
  notifyChange();
  fireAndForget(
    sb().from("storage_connections").delete().eq("id", id),
    "deleteStorageConnection"
  );
}

// Inquiries
export function getInquiries(tenantId: string): Inquiry[] {
  return loadDB()
    .inquiries.filter((i) => i.tenant_id === tenantId)
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
}
export function getInquiry(id: string): Inquiry | undefined {
  return loadDB().inquiries.find((i) => i.id === id);
}
export function getInquiryByToken(token: string): Inquiry | undefined {
  return loadDB().inquiries.find((i) => i.download_token === token);
}
export function createInquiry(
  i: Omit<Inquiry, "id" | "created_at" | "download_token" | "download_count">
): Inquiry {
  const inquiry: Inquiry = {
    ...i,
    id: uid(),
    download_token: uid(),
    download_count: 0,
    created_at: new Date().toISOString(),
  };
  if (cache) cache.inquiries.push(inquiry);
  notifyChange();
  fireAndForget(
    sb().from("inquiries").insert({ ...inquiry, ip_address: inquiry.ip_address || null }),
    "createInquiry"
  );
  return inquiry;
}
export function updateInquiry(id: string, patch: Partial<Inquiry>): void {
  if (cache) {
    const idx = cache.inquiries.findIndex((i) => i.id === id);
    if (idx >= 0) cache.inquiries[idx] = { ...cache.inquiries[idx], ...patch };
  }
  notifyChange();
  fireAndForget(sb().from("inquiries").update(patch).eq("id", id), "updateInquiry");
}

// Inquiry logs
export function getInquiryLogs(inquiryId: string): InquiryLog[] {
  return loadDB()
    .inquiry_logs.filter((l) => l.inquiry_id === inquiryId)
    .sort((a, b) => a.created_at.localeCompare(b.created_at));
}
export function addInquiryLog(log: Omit<InquiryLog, "id" | "created_at">): InquiryLog {
  const l: InquiryLog = { ...log, id: uid(), created_at: new Date().toISOString() };
  if (cache) cache.inquiry_logs.push(l);
  notifyChange();
  fireAndForget(sb().from("inquiry_logs").insert(l), "addInquiryLog");
  return l;
}

// Download logs
export function getDownloadLogs(inquiryId: string): DownloadLog[] {
  return loadDB()
    .download_logs.filter((d) => d.inquiry_id === inquiryId)
    .sort((a, b) => b.downloaded_at.localeCompare(a.downloaded_at));
}
export function addDownloadLog(log: Omit<DownloadLog, "id" | "downloaded_at">): DownloadLog {
  const l: DownloadLog = { ...log, id: uid(), downloaded_at: new Date().toISOString() };
  if (cache) {
    cache.download_logs.push(l);
    const idx = cache.inquiries.findIndex((i) => i.id === log.inquiry_id);
    if (idx >= 0) cache.inquiries[idx].download_count += 1;
  }
  notifyChange();
  fireAndForget(
    sb().from("download_logs").insert({
      inquiry_id: l.inquiry_id,
      document_id: l.document_id,
      ip_address: l.ip_address || null,
      user_agent: l.user_agent || null,
    }),
    "addDownloadLog"
  );
  return l;
}

// Email templates
export function getEmailTemplates(tenantId: string): EmailTemplate[] {
  return loadDB().email_templates.filter((t) => t.tenant_id === tenantId);
}
export function getDefaultTemplate(tenantId: string): EmailTemplate | undefined {
  const templates = getEmailTemplates(tenantId);
  return templates.find((t) => t.is_default) ?? templates[0];
}
export function saveTemplate(t: EmailTemplate): void {
  if (cache) {
    const idx = cache.email_templates.findIndex((x) => x.id === t.id);
    if (t.is_default) {
      cache.email_templates = cache.email_templates.map((x) =>
        x.tenant_id === t.tenant_id ? { ...x, is_default: false } : x
      );
    }
    if (idx >= 0) cache.email_templates[idx] = t;
    else cache.email_templates.push(t);
  }
  notifyChange();
  fireAndForget(sb().from("email_templates").upsert(t), "saveTemplate");
}
export function deleteTemplate(id: string): void {
  if (cache) cache.email_templates = cache.email_templates.filter((t) => t.id !== id);
  notifyChange();
  fireAndForget(sb().from("email_templates").delete().eq("id", id), "deleteTemplate");
}

// Notification settings
export function getNotificationSettings(tenantId: string): NotificationSettings | undefined {
  return loadDB().notification_settings.find((n) => n.tenant_id === tenantId);
}
export function saveNotificationSettings(n: NotificationSettings): void {
  if (cache) {
    const idx = cache.notification_settings.findIndex((x) => x.tenant_id === n.tenant_id);
    if (idx >= 0) cache.notification_settings[idx] = n;
    else cache.notification_settings.push(n);
  }
  notifyChange();
  fireAndForget(
    sb().from("notification_settings").upsert(n, { onConflict: "tenant_id" }),
    "saveNotificationSettings"
  );
}

// Email send settings
export function getEmailSendSettings(tenantId: string): EmailSendSettings | undefined {
  return loadDB().email_send_settings.find((e) => e.tenant_id === tenantId);
}
export function saveEmailSendSettings(s: EmailSendSettings): void {
  if (cache) {
    const idx = cache.email_send_settings.findIndex((x) => x.tenant_id === s.tenant_id);
    if (idx >= 0) cache.email_send_settings[idx] = s;
    else cache.email_send_settings.push(s);
  }
  notifyChange();
  fireAndForget(
    sb().from("email_send_settings").upsert(s, { onConflict: "tenant_id" }),
    "saveEmailSendSettings"
  );
}

// Session
export function getSession(): Session | null {
  return loadDB().session;
}
export function setSession(s: Session | null): void {
  if (cache) cache.session = s;
  notifyChange();
}

// Sent emails
export function getSentEmails(tenantId: string): SentEmail[] {
  return loadDB()
    .sent_emails.filter((e) => e.tenant_id === tenantId)
    .sort((a, b) => b.sent_at.localeCompare(a.sent_at));
}
export function recordSentEmail(e: Omit<SentEmail, "id" | "sent_at">): SentEmail {
  const email: SentEmail = { ...e, id: uid(), sent_at: new Date().toISOString() };
  if (cache) cache.sent_emails.push(email);
  notifyChange();

  // 1) DB record
  fireAndForget(
    sb().from("sent_emails").insert({
      id: email.id,
      tenant_id: email.tenant_id,
      to_address: email.to,
      subject: email.subject,
      body: email.body,
      kind: email.kind,
      sent_at: email.sent_at,
      from_email: email.from_email ?? null,
      from_display_name: email.from_display_name ?? null,
      reply_to: email.reply_to ?? null,
      cc: email.cc ?? null,
      send_mode: email.send_mode ?? null,
    }),
    "recordSentEmail"
  );

  // 2) Real send via Resend (server-side API route).
  //    Silently no-ops if RESEND_API_KEY is unset.
  if (isBrowser()) {
    fireAndForget(
      fetch("/api/send-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: email.to,
          subject: email.subject,
          body: email.body,
          from_email: email.from_email,
          from_display_name: email.from_display_name,
          reply_to: email.reply_to,
          cc: email.cc,
        }),
      }).then(async (res) => {
        const json = await res.json().catch(() => ({} as Record<string, unknown>));
        if (!res.ok || (json as { ok?: boolean }).ok === false) {
          return {
            error: {
              message:
                (json as { error?: string }).error ?? "send-email failed",
            },
          };
        }
        return { error: null };
      }),
      "sendEmail"
    );
  }

  return email;
}

// Template rendering
export function renderTemplate(body: string, vars: Record<string, string>): string {
  return body.replace(/\{\{\s*([^}]+)\s*\}\}/g, (_, key: string) => {
    const k = key.trim();
    return vars[k] ?? "{{" + k + "}}";
  });
}
