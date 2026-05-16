"use client";

import { useEffect, useState } from "react";
import {
  getTenant,
  getUser,
  initStore,
  isStoreReady,
} from "./store";
import { DEV_TENANT_ID, DEV_USER_ID } from "./supabase";
import type { Tenant, User } from "./types";

/**
 * Auth is currently bypassed. There is no real Supabase Auth session.
 *
 * `useCurrentUser()` resolves to the hardcoded "you" (info@najimi-llc.com)
 * after the in-memory store has been hydrated from Supabase.
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
          user: getUser(DEV_USER_ID) ?? null,
          tenant: getTenant(DEV_TENANT_ID) ?? null,
        }
      : { loading: true, user: null, tenant: null }
  );

  useEffect(() => {
    let cancelled = false;
    const sync = () => {
      if (cancelled) return;
      const user = getUser(DEV_USER_ID) ?? null;
      const tenant = getTenant(DEV_TENANT_ID) ?? null;
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
