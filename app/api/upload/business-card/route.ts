import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  ensureFreshAccessToken,
  ensureFolder,
  uploadFileToDrive,
} from "@/lib/googleDrive";

export const runtime = "nodejs";

/**
 * POST /api/upload/business-card  (multipart/form-data)
 *
 * Fields:
 *   - file:     the image
 *   - tenant_id: tenant the inquiry belongs to (looked up from form_token
 *               server-side rather than trusted from the client)
 *   - form_token: the property's public form_token (proves the inquirer
 *               actually came through the form for this tenant)
 *
 * Routing:
 *   - If the tenant has a connected Google Drive (status=connected,
 *     provider=gdrive), upload to a "名刺" subfolder of their BukkenLink
 *     root folder. Return { provider: "gdrive", path: <drive_file_id> }.
 *   - Otherwise upload to the Supabase `business-cards` bucket, returning
 *     { provider: "bukkenlink", path: <bucket_path> }.
 *
 * The inquiry row's `business_card_url` stores the returned `path` regardless
 * of provider. We disambiguate by the connection's storage_provider for
 * deletion/download later.
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

  // Resolve tenant from the public form_token so the inquirer can’t
  // upload into another tenant’s space.
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

  // Look up the tenant's primary connected Google Drive.
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

      // BukkenLink > 名刺 folder
      const cardsFolderId = await ensureFolder({
        accessToken: fresh.access_token,
        name: "名刺",
        parentId: conn.root_folder_id as string,
      });
      const safeName =
        new Date().toISOString().slice(0, 10) +
        "_" +
        (file.name || "card.jpg").replace(/[\\/:*?"<>|]/g, "_");
      const result = await uploadFileToDrive({
        accessToken: fresh.access_token,
        parentFolderId: cardsFolderId,
        name: safeName,
        contentType: file.type || "image/jpeg",
        bytes: await file.arrayBuffer(),
      });
      return NextResponse.json({
        ok: true,
        provider: "gdrive",
        path: result.fileId,
        external_view_url: result.webViewLink,
      });
    } catch (e) {
      // Fall through to the Supabase fallback if Drive blew up.
      console.error("[upload/business-card] gdrive failed, falling back", e);
    }
  }

  // ----- Route 2: Supabase Storage (default) -----
  const ext = (file.name.split(".").pop() ?? "jpg").toLowerCase();
  const folder = crypto.randomUUID();
  const path = `tenants/${tenantId}/inquiries/${folder}/card.${ext}`;
  const { error: upErr } = await supabase.storage
    .from("business-cards")
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
