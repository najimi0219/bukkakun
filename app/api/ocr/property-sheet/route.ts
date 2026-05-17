import { NextRequest, NextResponse } from "next/server";
import { hasOcrAccessByTenantId } from "@/lib/featureFlags";

export const runtime = "nodejs";
// PDF を Claude が解析するのは画像より少し重い。30秒上限。
export const maxDuration = 30;

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const MODEL = "claude-haiku-4-5-20251001";

// 物件種別 enum (DB と一致させる)
const PROPERTY_TYPES = [
  "land",
  "house",
  "mansion",
  "income",
  "business",
] as const;

interface PropertyOcrResult {
  title: string | null;
  property_type: (typeof PROPERTY_TYPES)[number] | null;
  address: string | null;
  /** 円単位 (万円 → 円 に正規化済) */
  price: number | null;
  /** 平方メートル */
  land_area: number | null;
  building_area: number | null;
  /** "YYYY-MM" 形式 (推定できれば) / 年だけなら "YYYY-01" */
  built_year_month: string | null;
  transport: string | null;
  description: string | null;
  reins_id: string | null;
}

/**
 * POST /api/ocr/property-sheet  (multipart/form-data, field: "file")
 *
 * マイソク (販売図面) を Claude Haiku Vision で解析して物件フィールドを
 * 抽出する。PDF / JPEG / PNG / WEBP 対応。
 *
 * - PDF は最初の数ページのみ解析 (Anthropic 側で自動的に画像化される)
 * - tenant_id を form フィールドに含めると将来の課金ゲートに引っかかる
 * - LLM が判定不能なフィールドは null で返す
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
  // 20MB up to handle scanned PDFs.
  if (file.size > 20 * 1024 * 1024) {
    return NextResponse.json(
      { ok: false, error: "マイソクは20MB以下にしてください" },
      { status: 400 }
    );
  }

  const gateTenantId = (form.get("tenant_id") as string | null) ?? null;
  if (!hasOcrAccessByTenantId(gateTenantId)) {
    return NextResponse.json(
      { ok: false, error: "OCR は現在ご利用いただけません" },
      { status: 402 }
    );
  }

  const inMedia = (file.type || "").toLowerCase();
  const isPdf = inMedia === "application/pdf";
  // Claude が直接受け取れるメディアタイプにマップ。
  const mediaType = isPdf
    ? "application/pdf"
    : ["image/jpeg", "image/png", "image/gif", "image/webp"].includes(inMedia)
      ? inMedia
      : "image/jpeg";

  const buf = await file.arrayBuffer();
  const b64 = Buffer.from(buf).toString("base64");

  const systemPrompt =
    "あなたは日本の不動産販売図面 (マイソク) から物件情報を抽出する正確なツールです。" +
    "JSON で結果だけを返してください。前置きや説明は不要です。" +
    "判定できないフィールドは null にしてください。";

  const userInstruction = [
    "添付のマイソク画像/PDFから以下のフィールドを抽出してください。",
    "",
    "- title: 物件名/タイトル (例: 「ブランズ六本木」「丸の内ガーデンレジデンス 1203号室」)",
    `- property_type: 種別。次のいずれか1つ: ${PROPERTY_TYPES.join(", ")}`,
    "    land=土地, house=戸建, mansion=分譲マンション, income=収益物件, business=事業用",
    "- address: 所在地 (都道府県から番地まで、見えるところまで)",
    "- price: 価格を **円単位の整数** で。"
      + "「3,980万円」→ 39800000 / 「1億2000万円」→ 120000000。",
    "- land_area: 土地面積 (㎡、小数可)。坪表記しかない場合は ㎡ に変換 (1坪 = 3.305785㎡)。",
    "- building_area: 建物面積/専有面積 (㎡、小数可)。",
    "- built_year_month: 築年月。YYYY-MM 形式。年だけなら YYYY-01。元号(令和等)も西暦変換。",
    "- transport: 交通アクセス (例: 「東京メトロ日比谷線 六本木駅 徒歩3分」)。複数路線は読点区切り。",
    "- description: 物件概要・特徴・備考 (300字以内、改行 \\n)。リフォーム履歴や設備、PRポイント等。",
    "- reins_id: レインズ物件番号があれば。",
    "",
    "見つからない/判定不能なフィールドは null にしてください。",
    "出力は次の JSON スキーマに厳密に従ってください:",
    '{"title": string|null, "property_type": "land"|"house"|"mansion"|"income"|"business"|null, "address": string|null, "price": number|null, "land_area": number|null, "building_area": number|null, "built_year_month": string|null, "transport": string|null, "description": string|null, "reins_id": string|null}',
  ].join("\n");

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
        max_tokens: 1500,
        system: systemPrompt,
        messages: [
          {
            role: "user",
            content: [
              {
                // PDF も画像も同じ "document" or "image" ブロックで受け取れる
                type: isPdf ? "document" : "image",
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
  const textBlock = json.content?.find(
    (b: any) => b.type === "text"
  )?.text as string | undefined;
  if (!textBlock) {
    return NextResponse.json(
      { ok: false, error: "Anthropic から空のレスポンスが返りました" },
      { status: 502 }
    );
  }

  const stripped = textBlock
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();

  let parsed: any;
  try {
    parsed = JSON.parse(stripped);
  } catch {
    return NextResponse.json(
      { ok: false, error: "Anthropic の出力を JSON として解釈できませんでした" },
      { status: 502 }
    );
  }

  const sanitized: PropertyOcrResult = {
    title: nullableStr(parsed.title),
    property_type: nullableEnum(parsed.property_type),
    address: nullableStr(parsed.address),
    price: nullableNum(parsed.price),
    land_area: nullableNum(parsed.land_area),
    building_area: nullableNum(parsed.building_area),
    built_year_month: nullableYm(parsed.built_year_month),
    transport: nullableStr(parsed.transport),
    description: nullableStr(parsed.description),
    reins_id: nullableStr(parsed.reins_id),
  };

  return NextResponse.json({ ok: true, fields: sanitized });
}

function nullableStr(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  if (!s || s.toLowerCase() === "null") return null;
  return s;
}

function nullableNum(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : Number(String(v).replace(/[, ]/g, ""));
  return Number.isFinite(n) ? n : null;
}

function nullableEnum(v: unknown): PropertyOcrResult["property_type"] {
  if (typeof v !== "string") return null;
  const lower = v.toLowerCase().trim();
  return (PROPERTY_TYPES as readonly string[]).includes(lower)
    ? (lower as PropertyOcrResult["property_type"])
    : null;
}

function nullableYm(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const s = v.trim();
  // YYYY or YYYY-MM 形式に揃える。
  const m = s.match(/^(\d{4})(?:-(\d{1,2}))?/);
  if (!m) return null;
  const y = m[1];
  const mo = m[2] ? m[2].padStart(2, "0") : "01";
  return `${y}-${mo}`;
}
