import { NextRequest, NextResponse } from "next/server";
import { hasOcrAccessByTenantId } from "@/lib/featureFlags";

export const runtime = "nodejs";
// OCR can briefly run up to ~10s on first call (cold start + model latency).
export const maxDuration = 30;

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const MODEL = "claude-haiku-4-5-20251001";

interface OcrResult {
  company_name: string | null;
  contact_name: string | null;
  title: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
}

/**
 * POST /api/ocr/business-card  (multipart/form-data, field: "file")
 *
 * Extracts structured fields from a business card image using Claude Haiku
 * Vision. Returns a JSON envelope so the form can pre-fill itself.
 *
 * - No DB writes, no auth — this is a thin proxy. The actual privacy-
 *   sensitive image storage step is handled by /api/upload/business-card
 *   after the inquirer confirms the form. We just see-and-forget here.
 * - 10 MB upper bound matches the form\'s 5 MB client-side cap with some
 *   headroom for un-compressed uploads.
 */
export async function POST(req: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { ok: false, error: "ANTHROPIC_API_KEY is not configured" },
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
  if (!(file instanceof File)) {
    return NextResponse.json(
      { ok: false, error: "file が不足しています" },
      { status: 400 }
    );
  }
  if (file.size > 10 * 1024 * 1024) {
    return NextResponse.json(
      { ok: false, error: "画像は10MB以下にしてください" },
      { status: 400 }
    );
  }

  // Feature gate: free during beta, paid add-on later.
  // The inquirer is anonymous so we accept an optional tenant_id field for
  // the gate check; absent it we default-allow during beta.
  const gateTenantId = (form.get("tenant_id") as string | null) ?? null;
  if (!hasOcrAccessByTenantId(gateTenantId)) {
    return NextResponse.json(
      { ok: false, error: "OCR は現在ご利用いただけません" },
      { status: 402 }
    );
  }

  // Map common image MIME types to what Anthropic accepts. HEIC won\'t be
  // accepted as input — the form\'s pre-upload compression already converts
  // to JPEG, so this only catches unusual edge cases.
  const inMedia = (file.type || "image/jpeg").toLowerCase();
  const mediaType = ["image/jpeg", "image/png", "image/gif", "image/webp"].includes(
    inMedia
  )
    ? inMedia
    : "image/jpeg";

  const buf = await file.arrayBuffer();
  const b64 = Buffer.from(buf).toString("base64");

  const systemPrompt =
    "あなたは日本語の名刺画像から連絡先情報を抽出する正確なツールです。" +
    "JSON で結果だけを返してください。前置きや説明は不要です。";

  const userInstruction =
    "添付の名刺画像から以下のフィールドを抽出してください。\n" +
    "- company_name: 会社名/組織名 (株式会社等の法人格込み)\n" +
    "- contact_name: 担当者の氏名 (姓名)\n" +
    "- title: 役職/肩書 (例: 代表取締役、営業部長)\n" +
    "- phone: 代表的な電話番号 (複数あれば固定電話を優先、ハイフン含む形式)\n" +
    "- email: メールアドレス\n" +
    "- address: 住所 (郵便番号があれば含める)\n\n" +
    "見つからないフィールドは null にしてください。" +
    "出力は次の JSON スキーマに厳密に従ってください:\n" +
    '{"company_name": string|null, "contact_name": string|null, "title": string|null, "phone": string|null, "email": string|null, "address": string|null}';

  let res: Response;
  try {
    res = await fetch(ANTHROPIC_API_URL, {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 600,
        system: systemPrompt,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image",
                source: {
                  type: "base64",
                  media_type: mediaType,
                  data: b64,
                },
              },
              {
                type: "text",
                text: userInstruction,
              },
            ],
          },
        ],
      }),
    });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error: "Anthropic API への通信に失敗しました: " +
          (err instanceof Error ? err.message : String(err)),
      },
      { status: 502 }
    );
  }

  const json = await res.json().catch(() => null as any);
  if (!res.ok) {
    return NextResponse.json(
      {
        ok: false,
        error:
          (json?.error?.message as string | undefined) ??
          `Anthropic returned ${res.status}`,
      },
      { status: 502 }
    );
  }
  // The model echoes one or more content blocks; the first text block is
  // expected to be the JSON envelope.
  const textBlock = json.content?.find(
    (b: any) => b.type === "text"
  )?.text as string | undefined;
  if (!textBlock) {
    return NextResponse.json(
      { ok: false, error: "Anthropic から空のレスポンスが返りました" },
      { status: 502 }
    );
  }

  // The model can occasionally wrap JSON in a code fence; strip it.
  const stripped = textBlock
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();

  let parsed: OcrResult;
  try {
    parsed = JSON.parse(stripped) as OcrResult;
  } catch {
    return NextResponse.json(
      { ok: false, error: "Anthropic の出力を JSON として解釈できませんでした" },
      { status: 502 }
    );
  }

  // Defensive: ensure every key exists and is string|null.
  const sanitized: OcrResult = {
    company_name: nullable(parsed.company_name),
    contact_name: nullable(parsed.contact_name),
    title: nullable(parsed.title),
    phone: nullable(parsed.phone),
    email: nullable(parsed.email),
    address: nullable(parsed.address),
  };

  return NextResponse.json({ ok: true, fields: sanitized });
}

function nullable(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  if (!s || s.toLowerCase() === "null") return null;
  return s;
}
