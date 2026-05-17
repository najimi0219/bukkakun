/**
 * Feature flags / paid-feature gating.
 *
 * BukkenLink is in free beta — every tenant currently has access to every
 * feature. When billing is wired up (post-beta), individual features will
 * be gated by plan or add-on subscriptions. The helpers here are the
 * single seam where that policy lives; UI + API routes import them and
 * stay ignorant of the billing details.
 *
 * Migration plan:
 *   1. Add `tenants.ocr_addon` BOOLEAN DEFAULT FALSE column
 *   2. Add Stripe Checkout for the OCR add-on
 *   3. Update hasOcrAccess() to read tenant.ocr_addon (or plan tier)
 *   4. Bump the price advertised on the marketing page
 */

import type { Tenant } from "./types";

/**
 * Whether this tenant can use the LLM-powered OCR features:
 *   - 名刺の自動入力 (public inquiry form)
 *   - マイソクの自動入力 (property registration)
 *
 * In beta this is always true. Set to a real check once billing lands.
 */
export function hasOcrAccess(_tenant?: Tenant | null): boolean {
  // Beta: everyone gets OCR free of charge.
  // After GA: return !!tenant?.ocr_addon || tenant?.plan === "pro";
  return true;
}

/**
 * Server-side variant for when the caller only has a tenant_id (e.g.
 * inside an API route). We don't try to query the DB here — the gate
 * still defaults open until billing is wired. When tightened later,
 * update this to load the tenant row and check the add-on flag.
 */
export function hasOcrAccessByTenantId(_tenantId: string | null): boolean {
  return true;
}

/**
 * Human-readable label shown next to feature CTAs ("OCR で自動入力"
 * buttons). In beta we show "ベータ機能"; after GA we can show
 * "Pro プラン" / "OCRアドオン" etc.
 */
export const OCR_BADGE_LABEL = "ベータ機能 (将来は有料予定)";
