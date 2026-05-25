"use client";

import { useEffect, useRef } from "react";
import QRCode from "qrcode";

const DEFAULT_OPTIONS = {
  // High error correction: 30% of codewords can be restored, robust against
  // dirty/wet printouts, glare, partial covering and creased paper.
  errorCorrectionLevel: "H" as const,
  // Extra quiet zone helps phone cameras lock onto the finder patterns.
  margin: 4,
  // Crisp dots — fewer scanning failures on cheap printers.
  color: { dark: "#0f172a", light: "#ffffff" },
};

export function QrCodeImage({
  text,
  size = 200,
  className,
}: {
  text: string;
  // Max display size in CSS px. The actual canvas may shrink to fit its
  // container, but never exceeds this.
  size?: number;
  className?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!canvasRef.current) return;
    // Render the canvas at 2x for sharp display on Retina/HiDPI screens.
    const renderPx = size * 2;
    QRCode.toCanvas(canvasRef.current, text, {
      ...DEFAULT_OPTIONS,
      width: renderPx,
    }).catch(() => {
      /* ignore */
    });
  }, [text, size]);

  return (
    <canvas
      ref={canvasRef}
      className={className}
      style={{
        width: "100%",
        height: "auto",
        maxWidth: size,
        maxHeight: size,
        aspectRatio: "1 / 1",
        display: "block",
        imageRendering: "pixelated",
      }}
    />
  );
}

// Used when the user clicks "Download QR" — generate a 1024px PNG for
// printing on REINS documents at high quality.
export async function qrCodeDataUrl(text: string, size = 1024): Promise<string> {
  return QRCode.toDataURL(text, {
    ...DEFAULT_OPTIONS,
    width: size,
  });
}

const CAPTION_FONT =
  '"Hiragino Sans", "Yu Gothic", "Noto Sans JP", Meiryo, sans-serif';

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("image load failed"));
    img.src = src;
  });
}

/**
 * QRコードの上にキャプション文を載せた 1 枚の PNG を生成する。
 * 販売図面の帯にそのまま貼れる「案内文 + QR」一体型の画像。
 * キャプションは QR 幅に収まるよう文字単位で自動折り返しする。
 */
export async function qrCodeWithCaptionDataUrl(
  text: string,
  caption: string,
  qrPx = 880
): Promise<string> {
  const plain = () =>
    QRCode.toDataURL(text, { ...DEFAULT_OPTIONS, width: qrPx });

  const trimmed = caption.trim();
  if (!trimmed) return plain();

  const qrImg = await loadImage(await plain());

  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) return plain();

  const pad = Math.round(qrPx * 0.07);
  const fontSize = Math.round(qrPx * 0.062);
  const lineHeight = Math.round(fontSize * 1.42);
  const gap = Math.round(qrPx * 0.045);

  // キャプションを QR 幅に収まるよう文字単位で折り返す。
  ctx.font = `bold ${fontSize}px ${CAPTION_FONT}`;
  const lines: string[] = [];
  let line = "";
  for (const ch of trimmed) {
    if (ch === "\n") {
      lines.push(line);
      line = "";
      continue;
    }
    const next = line + ch;
    if (line && ctx.measureText(next).width > qrPx) {
      lines.push(line);
      line = ch;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);

  const textBlock = lines.length * lineHeight;
  const width = qrPx + pad * 2;
  const height = pad + textBlock + gap + qrPx + pad;
  // canvas のサイズ変更はコンテキスト状態をリセットするので先に設定する。
  canvas.width = width;
  canvas.height = height;

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);

  ctx.fillStyle = DEFAULT_OPTIONS.color.dark;
  ctx.font = `bold ${fontSize}px ${CAPTION_FONT}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  lines.forEach((ln, i) => {
    ctx.fillText(ln, width / 2, pad + i * lineHeight);
  });

  ctx.drawImage(qrImg, pad, pad + textBlock + gap, qrPx, qrPx);

  return canvas.toDataURL("image/png");
}
