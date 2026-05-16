"use client";

import { Cloud, HardDrive } from "lucide-react";
import type { StorageProvider } from "@/lib/types";

interface Props {
  provider: StorageProvider;
  size?: number;
  className?: string;
}

export function StorageProviderIcon({ provider, size = 18, className }: Props) {
  const px = `${size}px`;
  if (provider === "gdrive") {
    return (
      <svg viewBox="0 0 87 79" width={px} height={px} className={className} aria-label="Google Drive">
        <path fill="#0066DA" d="M6.6 66.85L10.5 73.6c.81 1.42 1.97 2.54 3.34 3.36L27.71 53H0c0 1.59.41 3.17 1.21 4.59z" />
        <path fill="#00AC47" d="M43.65 25L29.79 1c-1.37.81-2.53 1.94-3.34 3.36L1.21 47.4c-.81 1.42-1.21 3-1.21 4.6h27.71L43.65 25z" />
        <path fill="#EA4335" d="M73.55 76.96c1.37-.82 2.53-1.94 3.34-3.36l1.62-2.79 7.78-13.51c.81-1.42 1.21-3 1.21-4.6H59.79l5.9 11.6 7.86 12.66z" />
        <path fill="#00832D" d="M43.65 25L57.51 1c-1.37-.81-2.94-1.21-4.55-1.21H34.34c-1.61 0-3.18.45-4.55 1.21l13.86 24z" />
        <path fill="#2684FC" d="M59.8 53H27.5l-13.7 23.96c1.37.82 2.94 1.21 4.55 1.21h50.6c1.61 0 3.18-.45 4.55-1.21L59.8 53z" />
        <path fill="#FFBA00" d="M73.4 26.46L60.78 4.36c-.81-1.42-1.97-2.54-3.34-3.36L43.65 25l16.13 28h27.61c0-1.59-.41-3.17-1.21-4.59L73.4 26.46z" />
      </svg>
    );
  }
  if (provider === "dropbox") {
    return (
      <svg viewBox="0 0 256 218" width={px} height={px} className={className} aria-label="Dropbox">
        <path fill="#0061FF" d="M63.99 0L0 40.81l63.99 40.81 64-40.81L63.99 0zM192.01 0l-64.01 40.81 64.01 40.81L256 40.81 192.01 0zM0 122.43l63.99 40.81 64-40.81-64-40.81L0 122.43zM192.01 81.62l-64.01 40.81 64.01 40.81L256 122.43l-63.99-40.81zM64 176.81l64.01 40.81 64-40.81-64-40.81L64 176.81z" />
      </svg>
    );
  }
  if (provider === "onedrive") {
    return (
      <svg viewBox="0 0 1080 1080" width={px} height={px} className={className} aria-label="OneDrive">
        <path fill="#0364B8" d="M650 510L500 660l60 90 90-30 250-30-50-180z" />
        <path fill="#0078D4" d="M280 360c0 60 40 90 80 100-30 50-50 110-30 170 20 50 80 90 150 90l600-30c50 0 90-40 90-90s-40-90-90-90l-100-10c20-90-30-180-130-200-50-10-110 0-150 30-30-90-130-150-230-130-90 20-150 90-150 180z" />
        <path fill="#1490DF" d="M850 590c-50-10-100 0-140 40l-260 40v280h540c50 0 90-40 90-90s-40-90-90-90l-100-10c20-80-20-160-100-180z" />
        <path fill="#28A8EA" d="M840 640l-340 50v200h350c50 0 90-30 90-80s-30-80-80-90l-20-80z" />
      </svg>
    );
  }
  if (provider === "box") {
    return (
      <svg viewBox="0 0 512 512" width={px} height={px} className={className} aria-label="Box">
        <rect x="0" y="0" width="512" height="512" rx="80" fill="#0061D5" />
        <text x="50%" y="58%" textAnchor="middle" fill="#fff" fontSize="220" fontWeight="700" fontFamily="Inter, sans-serif">box</text>
      </svg>
    );
  }
  if (provider === "s3") {
    return (
      <svg viewBox="0 0 32 32" width={px} height={px} className={className} aria-label="S3">
        <path fill="#E25444" d="M16 28L4 24V8l12-4 12 4v16z" />
        <path fill="#7B1F1A" d="M16 28V4l12 4v16z" />
        <path fill="#58150D" d="M16 28v-8l12-2v6z" />
      </svg>
    );
  }
  return <HardDrive width={px} height={px} className={className} />;
}
