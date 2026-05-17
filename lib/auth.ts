"use client";

import { useEffect, useState } from "react";
import {
  getTenant,
  getUser,
  initStore,
  isStoreReady,
} from "./store";
import { getCurrentTenantId, getCurrentUserId } from "./session";
import type { Tenant, User } from "./types";

/**
 * "Auth" for the beta-distribution mode.
 *
 * There is no real Supabase Auth session. Each browser picks (or creates)
 * a tenant during /signup and the tenant_id + user_id are stashed in
 * localStorage. `useCurrentUser()` reads those out and looks the rows up
 * in the in-memory store (hydrated from Supabase on first mount).
 *
 * Falls back to the env-default IDs (seed/demo tenant) when nothing has
 * been stored — useful while developing or when an admin wants to log
 * in as the demo tenant.
 */

export function login(
  _email: string,
  _password: string
): { ok: true } | { ok: false; error: string } {
  return { ok: true };
}

export function logout(): void {
  // eslint-disable-next-line no-console
  console.info("[BukkenLink] logout() is a no-op while auth is bypassed.");
}

export function useCurrentUser(): {
  loading: boolean;
  user: User | null;
  tenant: Tenant | null;
} {
  const [state, setState] = useState<{
    loading: boolean;
    user: User | null;
    tenant: Tenant | null;
  }>(() =>
    isStoreReady()
      ? {
          loading: false,
          user: getUser(getCurrentUserId()) ?? null,
          tenant: getTenant(getCurrentTenantId()) ?? null,
        }
      : { loading: true, user: null, tenant: null }
  );

  useEffect(() => {
    let cancelled = false;
    const sync = () => {
      if (cancelled) return;
      const user = getUser(getCurrentUserId()) ?? null;
      const tenant = getTenant(getCurrentTenantId()) ?? null;
      setState({ loading: false, user, tenant });
    };

    if (!isStoreReady()) {
      void initStore().then(() => {
        sync();
      });
    } else {
      sync();
    }
    window.addEventListener("bukkenlink:dbchange", sync);
    return () => {
      cancelled = true;
      window.removeEventListener("bukkenlink:dbchange", sync);
    };
  }, []);

  return state;
}
