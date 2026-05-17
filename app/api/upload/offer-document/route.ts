import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  ensureFreshAccessToken,
  ensureFolder,
  uploadFileToDrive,
} from "@/lib/googleDrive";

export const runtime = "nodejs";

const OFFERS_BUCKET = "business-cards"; // reuse for now; same security model

/**
 * POST /api/upload/offer-document  (multipart/form-data)
 *
 * Same shape as /api/upload/business-card. Used when the inquiry kind is
 * "offer" (買付送付). Files can be PDF or image, up to 10 MB.
 *
 * Routes to the tenant's Google Drive (under BukkenLink/買付) when
 * connected, otherwise to the Supabase business-cards bucket under
 * tenants/{tenant}/offers/{inquiry}/...
 */
export async function POST(req: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const gClientId = process.env.GOOGLE_CLIENT_ID;
  const gClientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!url || !serviceKey) {
    return NextResponse.json(
      { ok: false, error: "Supabase env vars missing" },
      { status: 500 }
    );
  }

  const form = await req.formData().catch(() => null);
  if (!form) {
    return NextResponse.json(
      { ok: false, error: "multipart/form-data が必要です" },
      { status: 400 }
    );
  }
  const file = form.get("file");
  const formToken = (form.get("form_token") as string | null) ?? "";
  if (!(file instanceof File)) {
    return NextResponse.json(
      { ok: false, error: "file が不足しています" },
      { status: 400 }
    );
  }
  if (!formToken) {
    return NextResponse.json(
      { ok: false, error: "form_token が不足しています" },
      { status: 400 }
    );
  }

  const supabase = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: prop } = await supabase
    .from("properties")
    .select("tenant_id")
    .eq("form_token", formToken)
    .maybeSingle();
  if (!prop?.tenant_id) {
    return NextResponse.json(
      { ok: false, error: "物件が見つかりません" },
      { status: 404 }
    );
  }
  const tenantId = prop.tenant_id as string;

  const { data: conn } = await supabase
    .from("storage_connections")
    .select(
      "id, provider, status, refresh_token, access_token, token_expires_at, root_folder_id"
    )
    .eq("tenant_id", tenantId)
    .eq("provider", "gdrive")
    .eq("status", "connected")
    .maybeSingle();

  // ----- Route 1: Google Drive -----
  if (conn?.refresh_token && conn?.root_folder_id && gClientId && gClientSecret) {
    try {
      const fresh = await ensureFreshAccessToken({
        refresh_token: conn.refresh_token as string,
        access_token: (conn.access_token as string | null) ?? null,
        expires_at: conn.token_expires_at
          ? new Date(conn.token_expires_at as string).getTime()
          : null,
        clientId: gClientId,
        clientSecret: gClientSecret,
      });
      if (fresh.refreshed) {
        await supabase
          .from("storage_connections")
          .update({
            access_token: fresh.access_token,
            token_expires_at: new Date(fresh.expires_at).toISOString(),
          })
          .eq("id", conn.id);
      }

      const offersFolderId = await ensureFolder({
        accessToken: fresh.access_token,
        name: "買付",
        parentId: conn.root_folder_id as string,
      });
      const safeName =
        new Date().toISOString().slice(0, 10) +
        "_" +
        (file.name || "offer").replace(/[\\/:*?"<>|]/g, "_");
      const result = await uploadFileToDrive({
        accessToken: fresh.access_token,
        parentFolderId: offersFolderId,
        name: safeName,
        contentType: file.type || "application/octet-stream",
        bytes: await file.arrayBuffer(),
      });
      return NextResponse.json({
        ok: true,
        provider: "gdrive",
        path: result.fileId,
        external_view_url: result.webViewLink,
      });
    } catch (e) {
      console.error("[upload/offer-document] gdrive failed, falling back", e);
    }
  }

  // ----- Route 2: Supabase Storage -----
  const ext =
    (file.name.split(".").pop() ?? (file.type === "application/pdf" ? "pdf" : "jpg")).toLowerCase();
  const folder = crypto.randomUUID();
  const path = `tenants/${tenantId}/offers/${folder}/offer.${ext}`;
  const { error: upErr } = await supabase.storage
    .from(OFFERS_BUCKET)
    .upload(path, file, {
      upsert: false,
      contentType: file.type || undefined,
    });
  if (upErr) {
    return NextResponse.json(
      { ok: false, error: "Supabase upload failed: " + upErr.message },
      { status: 500 }
    );
  }
  return NextResponse.json({
    ok: true,
    provider: "bukkenlink",
    path,
    external_view_url: null,
  });
}
