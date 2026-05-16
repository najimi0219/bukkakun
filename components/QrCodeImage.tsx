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
  size = 256,
  className,
}: {
  text: string;
  size?: number;
  className?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!canvasRef.current) return;
    // Render at 2x for sharp display on Retina/HiDPI screens.
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
      style={{ width: size, height: size, imageRendering: "pixelated" }}
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
