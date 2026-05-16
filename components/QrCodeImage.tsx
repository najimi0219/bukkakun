"use client";

import { useEffect, useRef } from "react";
import QRCode from "qrcode";

export function QrCodeImage({
  text,
  size = 200,
  className,
}: {
  text: string;
  size?: number;
  className?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!canvasRef.current) return;
    QRCode.toCanvas(canvasRef.current, text, {
      width: size,
      margin: 1,
      color: { dark: "#1e3a86", light: "#ffffff" },
    }).catch(() => {
      /* ignore */
    });
  }, [text, size]);

  return <canvas ref={canvasRef} className={className} />;
}

export async function qrCodeDataUrl(text: string, size = 400): Promise<string> {
  return QRCode.toDataURL(text, {
    width: size,
    margin: 1,
    color: { dark: "#1e3a86", light: "#ffffff" },
  });
}
