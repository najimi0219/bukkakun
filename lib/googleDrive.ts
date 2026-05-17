/**
 * Minimal Google Drive v3 client.
 *
 * Designed to run on the Next.js Node runtime (NOT the edge). We avoid
 * pulling in `googleapis` (it's heavy and assumes Node fs APIs) — instead
 * we hit Google's REST endpoints directly via fetch with the OAuth access
 * token from the tenant's storage_connections row.
 *
 * Scope used: `https://www.googleapis.com/auth/drive.file` — we can only
 * see/touch files our app created. Perfect for BYO use case.
 */

const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const DRIVE_FILES_URL = "https://www.googleapis.com/drive/v3/files";
const DRIVE_UPLOAD_URL = "https://www.googleapis.com/upload/drive/v3/files";

export const GOOGLE_OAUTH_SCOPE = "https://www.googleapis.com/auth/drive.file";

export interface DriveTokens {
  access_token: string;
  refresh_token: string;
  /** UNIX ms timestamp when access_token expires. */
  expires_at: number;
}

export interface DriveUploadResult {
  fileId: string;
  webViewLink: string | null;
  name: string;
}

/**
 * Exchange an auth `code` (from /api/oauth/google/callback) for the first
 * pair of access/refresh tokens.
 */
export async function exchangeCodeForTokens(opts: {
  code: string;
  redirectUri: string;
  clientId: string;
  clientSecret: string;
}): Promise<{
  access_token: string;
  refresh_token: string;
  expires_in: number;
  scope: string;
  token_type: string;
}> {
  const body = new URLSearchParams({
    code: opts.code,
    client_id: opts.clientId,
    client_secret: opts.clientSecret,
    redirect_uri: opts.redirectUri,
    grant_type: "authorization_code",
  });
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  const json = await res.json();
  if (!res.ok) {
    throw new Error(
      `Google token exchange failed: ${json.error ?? res.status} ${
        json.error_description ?? ""
      }`.trim()
    );
  }
  if (!json.refresh_token) {
    // Should not happen because we request access_type=offline + prompt=consent,
    // but surface a clear error if Google omits it (e.g. previously consented
    // user without prompt=consent).
    throw new Error(
      "Google did not return a refresh_token. Re-consent with prompt=consent."
    );
  }
  return json;
}

/**
 * If the cached access_token is still good, return it. Otherwise hit
 * Google's token endpoint with refresh_token and persist the new one.
 *
 * Callers pass the connection record; on refresh we mutate fields in place
 * and rely on the caller to write back to Supabase.
 */
export async function ensureFreshAccessToken(opts: {
  refresh_token: string;
  access_token: string | null;
  expires_at: number | null;
  clientId: string;
  clientSecret: string;
}): Promise<{
  access_token: string;
  expires_at: number;
  refreshed: boolean;
}> {
  // 60s safety buffer so we don't race the clock.
  const stillGoodFor = (opts.expires_at ?? 0) - Date.now();
  if (opts.access_token && stillGoodFor > 60_000) {
    return {
      access_token: opts.access_token,
      expires_at: opts.expires_at!,
      refreshed: false,
    };
  }
  const body = new URLSearchParams({
    refresh_token: opts.refresh_token,
    client_id: opts.clientId,
    client_secret: opts.clientSecret,
    grant_type: "refresh_token",
  });
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  const json = await res.json();
  if (!res.ok) {
    throw new Error(
      `Google token refresh failed: ${json.error ?? res.status} ${
        json.error_description ?? ""
      }`.trim()
    );
  }
  return {
    access_token: json.access_token as string,
    expires_at: Date.now() + (json.expires_in as number) * 1000,
    refreshed: true,
  };
}

/**
 * Find an existing folder by name under `parentId`, or create one if it
 * doesn't exist. Returns the folder ID.
 *
 * For the BukkenLink use case we call this with parentId="root" once to
 * make the top-level "BukkenLink" folder, then again recursively for
 * sub-folders like "物件資料/{物件名}" or "名刺".
 */
export async function ensureFolder(opts: {
  accessToken: string;
  name: string;
  parentId?: string;
}): Promise<string> {
  const parentId = opts.parentId ?? "root";
  // Search for an existing folder with that name + parent (and not trashed).
  const safeName = opts.name.replace(/'/g, "\\'");
  const q = `mimeType='application/vnd.google-apps.folder' and name='${safeName}' and '${parentId}' in parents and trashed=false`;
  const searchUrl = `${DRIVE_FILES_URL}?q=${encodeURIComponent(q)}&fields=files(id,name)&pageSize=1`;
  const searchRes = await fetch(searchUrl, {
    headers: { Authorization: `Bearer ${opts.accessToken}` },
  });
  const searchJson = await searchRes.json();
  if (!searchRes.ok) {
    throw new Error(
      `Drive folder search failed: ${searchJson.error?.message ?? searchRes.status}`
    );
  }
  const first = searchJson.files?.[0];
  if (first?.id) return first.id;

  // Create.
  const createRes = await fetch(`${DRIVE_FILES_URL}?fields=id`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${opts.accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: opts.name,
      mimeType: "application/vnd.google-apps.folder",
      parents: [parentId],
    }),
  });
  const createJson = await createRes.json();
  if (!createRes.ok || !createJson.id) {
    throw new Error(
      `Drive folder create failed: ${createJson.error?.message ?? createRes.status}`
    );
  }
  return createJson.id as string;
}

/**
 * Upload `bytes` to Drive under `parentFolderId` as `name`. Uses Drive's
 * multipart upload so we can set metadata + content in a single request.
 */
export async function uploadFileToDrive(opts: {
  accessToken: string;
  parentFolderId: string;
  name: string;
  contentType: string;
  bytes: ArrayBuffer | Uint8Array | Blob;
}): Promise<DriveUploadResult> {
  const metadata = {
    name: opts.name,
    parents: [opts.parentFolderId],
  };
  const boundary = `bukkenlink-${crypto.randomUUID()}`;
  const enc = new TextEncoder();
  const head = enc.encode(
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n` +
      JSON.stringify(metadata) +
      `\r\n--${boundary}\r\nContent-Type: ${opts.contentType}\r\n\r\n`
  );
  const tail = enc.encode(`\r\n--${boundary}--`);

  // Normalize body to Uint8Array.
  let bodyBytes: Uint8Array;
  if (opts.bytes instanceof Blob) {
    bodyBytes = new Uint8Array(await opts.bytes.arrayBuffer());
  } else if (opts.bytes instanceof Uint8Array) {
    bodyBytes = opts.bytes;
  } else {
    bodyBytes = new Uint8Array(opts.bytes);
  }
  const payload = new Uint8Array(head.length + bodyBytes.length + tail.length);
  payload.set(head, 0);
  payload.set(bodyBytes, head.length);
  payload.set(tail, head.length + bodyBytes.length);

  const url = `${DRIVE_UPLOAD_URL}?uploadType=multipart&fields=id,name,webViewLink`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${opts.accessToken}`,
      "Content-Type": `multipart/related; boundary=${boundary}`,
    },
    body: payload,
  });
  const json = await res.json();
  if (!res.ok || !json.id) {
    throw new Error(
      `Drive upload failed: ${json.error?.message ?? res.status}`
    );
  }
  return {
    fileId: json.id as string,
    name: (json.name as string) ?? opts.name,
    webViewLink: (json.webViewLink as string) ?? null,
  };
}

/**
 * Download the bytes of a Drive file. Used when the tenant's admin clicks
 * "Download" in our UI — we proxy it so the inquirer never gets a Drive
 * URL with their own credentials.
 */
export async function downloadFileFromDrive(opts: {
  accessToken: string;
  fileId: string;
}): Promise<{ bytes: ArrayBuffer; contentType: string | null }> {
  const res = await fetch(`${DRIVE_FILES_URL}/${opts.fileId}?alt=media`, {
    headers: { Authorization: `Bearer ${opts.accessToken}` },
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`Drive download failed: ${res.status} ${txt}`);
  }
  return {
    bytes: await res.arrayBuffer(),
    contentType: res.headers.get("content-type"),
  };
}

/**
 * Delete (trash) a file from Drive. Used when an inquiry is closed/rejected
 * and we want to clean up the inquirer's business card.
 */
export async function deleteFileFromDrive(opts: {
  accessToken: string;
  fileId: string;
}): Promise<void> {
  const res = await fetch(`${DRIVE_FILES_URL}/${opts.fileId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${opts.accessToken}` },
  });
  if (!res.ok && res.status !== 404) {
    const txt = await res.text().catch(() => "");
    throw new Error(`Drive delete failed: ${res.status} ${txt}`);
  }
}
