/**
 * Browser-local "session" for the auth-bypassed mode.
 *
 * No passwords, no JWTs — just a per-browser localStorage record that says
 * "this browser is acting as tenant X / user Y". The /signup flow creates
 * a fresh tenant row in Supabase and stashes its IDs here; from then on
 * the app reads tenant scope from this module instead of the global env
 * fallback.
 *
 * This is deliberately a temporary scaffold so we can distribute the app to
 * real estate companies for feedback without writing a full auth layer.
 * When we migrate to Supabase Auth proper, replace `getCurrentTenantId` /
 * `getCurrentUserId` with `supabase.auth.getSession()` lookups and the
 * rest of the codebase keeps working.
 */

const LS_TENANT_KEY = "bukkenlink_tenant_id";
const LS_USER_KEY = "bukkenlink_user_id";

const FALLBACK_TENANT_ID =
  process.env.NEXT_PUBLIC_DEV_TENANT_ID ??
  "00000000-0000-0000-0000-000000000001";
const FALLBACK_USER_ID =
  process.env.NEXT_PUBLIC_DEV_USER_ID ??
  "00000000-0000-0000-0000-000000000010";

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

/**
 * The tenant_id the current browser is acting as. Falls back to the env
 * default (typically the seed/demo tenant) when running server-side or
 * when nothing has been stored yet.
 */
export function getCurrentTenantId(): string {
  if (isBrowser()) {
    const v = window.localStorage.getItem(LS_TENANT_KEY);
    if (v) return v;
  }
  return FALLBACK_TENANT_ID;
}

export function getCurrentUserId(): string {
  if (isBrowser()) {
    const v = window.localStorage.getItem(LS_USER_KEY);
    if (v) return v;
  }
  return FALLBACK_USER_ID;
}

/** True if this browser has been "signed up" (has its own tenant_id stored). */
export function hasLocalSession(): boolean {
  if (!isBrowser()) return false;
  return !!window.localStorage.getItem(LS_TENANT_KEY);
}

export function setLocalSession(tenantId: string, userId: string): void {
  if (!isBrowser()) return;
  window.localStorage.setItem(LS_TENANT_KEY, tenantId);
  window.localStorage.setItem(LS_USER_KEY, userId);
}

export function clearLocalSession(): void {
  if (!isBrowser()) return;
  window.localStorage.removeItem(LS_TENANT_KEY);
  window.localStorage.removeItem(LS_USER_KEY);
}
