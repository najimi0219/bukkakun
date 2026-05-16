import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";

export const runtime = "nodejs";

interface SendEmailBody {
  to: string;
  subject: string;
  body: string;
  from_email?: string | null;
  from_display_name?: string | null;
  reply_to?: string | null;
  cc?: string[] | null;
}

/**
 * POST /api/send-email
 *
 * Server-side proxy to Resend. Without RESEND_API_KEY set, returns
 * { ok: true, skipped: true } so the rest of the app keeps working
 * in pure-demo mode.
 */
export async function POST(req: NextRequest) {
  const apiKey = process.env.RESEND_API_KEY;
  const defaultFrom =
    process.env.RESEND_DEFAULT_FROM ?? "BukkenLink <onboarding@resend.dev>";

  if (!apiKey) {
    // Demo mode — no real send.
    return NextResponse.json({ ok: true, skipped: true, reason: "no_api_key" });
  }

  let body: SendEmailBody;
  try {
    body = (await req.json()) as SendEmailBody;
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid JSON" },
      { status: 400 }
    );
  }

  if (!body.to || !body.subject || !body.body) {
    return NextResponse.json(
      { ok: false, error: "to / subject / body are required" },
      { status: 400 }
    );
  }

  // Build the From header.
  // - If the email_send_settings explicitly gave a from_email (custom_domain mode), use it.
  // - Otherwise fall back to RESEND_DEFAULT_FROM (typically onboarding@resend.dev).
  const fromAddress = body.from_email ?? null;
  const fromHeader = fromAddress
    ? body.from_display_name
      ? `${body.from_display_name} <${fromAddress}>`
      : fromAddress
    : defaultFrom;

  const resend = new Resend(apiKey);
  try {
    const result = await resend.emails.send({
      from: fromHeader,
      to: body.to,
      cc: body.cc && body.cc.length > 0 ? body.cc : undefined,
      replyTo: body.reply_to ?? undefined,
      subject: body.subject,
      text: body.body,
    });
    if (result.error) {
      return NextResponse.json(
        { ok: false, error: result.error.message ?? "Resend error" },
        { status: 502 }
      );
    }
    return NextResponse.json({ ok: true, id: result.data?.id ?? null });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
