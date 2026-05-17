"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  Upload,
  X,
  FileText,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  ExternalLink,
} from "lucide-react";
import { useCurrentUser } from "@/lib/auth";
import { createProperty } from "@/lib/store";
import { hasOcrAccess, OCR_BADGE_LABEL } from "@/lib/featureFlags";
import { useToast } from "@/components/Toast";
import type { PropertyType } from "@/lib/types";

type RowStatus = "pending" | "processing" | "done" | "error";

interface BulkRow {
  id: string;
  file: File;
  status: RowStatus;
  /** Set when status === "done". */
  propertyId?: string;
  propertyTitle?: string;
  /** Set when status === "error". */
  error?: string;
}

/**
 * /properties/bulk-import
 *
 * テナント管理者が複数のマイソク (PDF/画像) を一括ドロップして、
 * 各ファイルを OCR にかけ、抽出された情報で物件レコードを下書きとして
 * 一括作成する。
 *
 * - 同時並列はせず、1ファイルずつ順次処理 (Anthropic API のレート対策 + UX)
 * - 必須項目 (title, address, price) が OCR で取得できなかったら "error" 扱い
 *   → ユーザーは元ファイルを手動アップする選択肢を取れる
 * - すべての登録物件は status="draft" で作成 → ユーザーが確認してから "公開" に切り替え
 */
export default function BulkImportPage() {
  const { tenant } = useCurrentUser();
  const toast = useToast();
  const [rows, setRows] = useState<BulkRow[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const [running, setRunning] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // OCR をテナントが使えない (将来の有料化時) ならゲート画面のみ表示。
  const enabled = hasOcrAccess(tenant);

  useEffect(() => {
    return () => {
      // No previews; nothing to revoke.
    };
  }, []);

  const addFiles = (files: FileList | File[] | null) => {
    if (!files) return;
    const list = Array.from(files);
    const accepted = list.filter((f) => {
      if (f.size > 20 * 1024 * 1024) {
        toast.show(f.name + " は20MBを超えています", "error");
        return false;
      }
      if (f.type !== "application/pdf" && !f.type.startsWith("image/")) {
        toast.show(f.name + " は PDF または画像ではありません", "error");
        return false;
      }
      return true;
    });
    if (accepted.length === 0) return;
    setRows((prev) => [
      ...prev,
      ...accepted.map<BulkRow>((f) => ({
        id: crypto.randomUUID(),
        file: f,
        status: "pending",
      })),
    ]);
  };

  const removeRow = (id: string) => {
    setRows((prev) => prev.filter((r) => r.id !== id));
  };

  const updateRow = (id: string, patch: Partial<BulkRow>) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  };

  const processOne = async (row: BulkRow) => {
    if (!tenant) return;
    updateRow(row.id, { status: "processing" });
    try {
      const fd = new FormData();
      fd.append("file", row.file, row.file.name);
      fd.append("tenant_id", tenant.id);
      const res = await fetch("/api/ocr/property-sheet", {
        method: "POST",
        body: fd,
      });
      const json = (await res.json()) as {
        ok?: boolean;
        fields?: {
          title: string | null;
          property_type: string | null;
          address: string | null;
          price: number | null;
          land_area: number | null;
          building_area: number | null;
          built_year_month: string | null;
          transport: string | null;
          description: string | null;
          reins_id: string | null;
        };
        error?: string;
      };
      if (!res.ok || !json.ok || !json.fields) {
        updateRow(row.id, {
          status: "error",
          error: json.error ?? "OCR に失敗しました",
        });
        return;
      }
      const f = json.fields;
      if (!f.title || !f.address || f.price == null) {
        updateRow(row.id, {
          status: "error",
          error:
            "必須項目を抽出できませんでした (タイトル / 所在地 / 価格)。手動登録してください。",
        });
        return;
      }
      // Sensible defaults for the unattended write.
      const PROPERTY_TYPE_VALUES: PropertyType[] = [
        "mansion",
        "house",
        "land",
        "office",
        "shop",
        "other",
      ];
      const property_type: PropertyType =
        f.property_type &&
        (PROPERTY_TYPE_VALUES as readonly string[]).includes(f.property_type)
          ? (f.property_type as PropertyType)
          : "mansion";

      const created = createProperty({
        tenant_id: tenant.id,
        title: f.title,
        property_type,
        address: f.address,
        price: f.price,
        land_area: f.land_area,
        building_area: f.building_area,
        built_year_month: f.built_year_month,
        transport: f.transport ?? "",
        description: f.description ?? "",
        reins_id: f.reins_id ?? null,
        // 一括登録は誤入力リスクがあるので draft で着地 → ユーザーが確認後に公開
        status: "draft",
        assignee_ids: [],
        show_address: true,
        viewing_available: false,
        viewing_methods: [],
        viewing_key_pickup_info: null,
        viewing_key_box_code: null,
        viewing_notes: null,
      });

      updateRow(row.id, {
        status: "done",
        propertyId: created.id,
        propertyTitle: created.title,
      });
    } catch (err) {
      updateRow(row.id, {
        status: "error",
        error: err instanceof Error ? err.message : String(err),
      });
    }
  };

  const startProcessing = async () => {
    if (!tenant) return;
    if (running) return;
    const pending = rows.filter((r) => r.status === "pending");
    if (pending.length === 0) {
      toast.show("処理対象のファイルがありません", "error");
      return;
    }
    setRunning(true);
    try {
      // Sequential — keeps the API gentle and the UI readable.
      for (const r of pending) {
        // eslint-disable-next-line no-await-in-loop
        await processOne(r);
      }
      const doneCount = rows.filter((r) => r.status === "done").length;
      toast.show(`${pending.length}件の処理が完了しました`);
      void doneCount;
    } finally {
      setRunning(false);
    }
  };

  const reset = () => {
    if (running) return;
    setRows([]);
    if (inputRef.current) inputRef.current.value = "";
  };

  if (!tenant) return null;

  if (!enabled) {
    return (
      <div className="p-8 max-w-3xl">
        <Link
          href="/properties"
          className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-3"
        >
          <ArrowLeft className="w-4 h-4" /> 物件一覧へ戻る
        </Link>
        <div className="card p-8 text-center">
          <Sparkles className="w-10 h-10 text-emerald-600 mx-auto mb-3" />
          <h1 className="text-xl font-bold text-gray-900 mb-2">
            一括物件登録 (OCR)
          </h1>
          <p className="text-sm text-gray-500">
            この機能は OCR アドオンが必要です。詳細は管理者までお問い合わせください。
          </p>
        </div>
      </div>
    );
  }

  const pendingCount = rows.filter((r) => r.status === "pending").length;
  const doneCount = rows.filter((r) => r.status === "done").length;
  const errorCount = rows.filter((r) => r.status === "error").length;

  return (
    <div className="p-8 max-w-5xl space-y-6">
      <div>
        <Link
          href="/properties"
          className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-2"
        >
          <ArrowLeft className="w-4 h-4" /> 物件一覧へ戻る
        </Link>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Sparkles className="w-6 h-6 text-emerald-600" />
          マイソク一括物件登録
          <span className="badge bg-amber-100 text-amber-700 text-[10px]">
            {OCR_BADGE_LABEL}
          </span>
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          複数のマイソク (PDF / 画像) をまとめてアップロードすると、AI
          が物件情報を読み取って下書き状態で一括登録します。登録後、各物件を確認・編集してから公開してください。
        </p>
      </div>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragOver(true);
        }}
        onDragLeave={(e) => {
          e.preventDefault();
          if (e.currentTarget === e.target) setIsDragOver(false);
        }}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragOver(false);
          addFiles(e.dataTransfer.files);
        }}
        className={
          "card border-2 border-dashed p-8 text-center transition " +
          (isDragOver
            ? "border-emerald-500 bg-emerald-50"
            : "border-gray-300 hover:border-gray-400 bg-gray-50")
        }
      >
        <Upload className="w-10 h-10 text-gray-400 mx-auto mb-3" />
        <div className="text-gray-700 font-medium mb-1">
          ここにファイルをドラッグ&ドロップ
        </div>
        <div className="text-xs text-gray-500 mb-4">
          PDF / JPG / PNG (1ファイル20MB以下)
        </div>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="btn-secondary text-sm"
        >
          <Upload className="w-4 h-4" />
          ファイル選択
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf,image/*"
          multiple
          className="hidden"
          onChange={(e) => {
            addFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </div>

      {rows.length > 0 && (
        <div className="card overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-200 bg-gray-50 flex items-center justify-between gap-3 flex-wrap">
            <div className="text-sm text-gray-700">
              <strong>{rows.length}件</strong>
              <span className="text-gray-500 mx-1">·</span>
              未処理 <strong>{pendingCount}</strong>
              <span className="text-gray-500 mx-1">·</span>
              完了 <strong className="text-emerald-700">{doneCount}</strong>
              <span className="text-gray-500 mx-1">·</span>
              エラー <strong className="text-red-700">{errorCount}</strong>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={reset}
                disabled={running}
                className="btn-ghost text-xs"
              >
                クリア
              </button>
              <button
                type="button"
                onClick={startProcessing}
                disabled={running || pendingCount === 0}
                className="btn-primary text-sm"
              >
                {running ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    解析中... ({doneCount + errorCount}/{rows.length})
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    一括解析 & 登録 ({pendingCount}件)
                  </>
                )}
              </button>
            </div>
          </div>
          <ul className="divide-y divide-gray-100">
            {rows.map((r) => (
              <li
                key={r.id}
                className="px-5 py-3 flex items-center gap-3 text-sm"
              >
                <FileText className="w-5 h-5 text-gray-400 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-gray-900 truncate">{r.file.name}</div>
                  <div className="text-xs text-gray-500">
                    {(r.file.size / 1024 / 1024).toFixed(1)} MB
                  </div>
                  {r.error && (
                    <div className="text-xs text-red-600 mt-1">{r.error}</div>
                  )}
                </div>
                <div className="shrink-0">
                  {r.status === "pending" && (
                    <span className="badge bg-gray-100 text-gray-600 text-[10px]">
                      待機中
                    </span>
                  )}
                  {r.status === "processing" && (
                    <span className="badge bg-amber-100 text-amber-700 text-[10px] inline-flex items-center gap-1">
                      <Loader2 className="w-3 h-3 animate-spin" />
                      解析中
                    </span>
                  )}
                  {r.status === "done" && (
                    <span className="badge bg-emerald-100 text-emerald-700 text-[10px] inline-flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" />
                      登録完了
                    </span>
                  )}
                  {r.status === "error" && (
                    <span className="badge bg-red-100 text-red-700 text-[10px] inline-flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" />
                      エラー
                    </span>
                  )}
                </div>
                {r.status === "done" && r.propertyId ? (
                  <Link
                    href={"/properties/" + r.propertyId}
                    className="text-xs text-brand-600 hover:underline inline-flex items-center gap-0.5 shrink-0"
                  >
                    開く
                    <ExternalLink className="w-3 h-3" />
                  </Link>
                ) : (
                  !running &&
                  r.status !== "processing" && (
                    <button
                      type="button"
                      onClick={() => removeRow(r.id)}
                      className="text-xs text-red-500 hover:underline shrink-0"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="card p-4 border-amber-200 bg-amber-50/60 text-xs text-amber-900">
        <strong>動作について:</strong>{" "}
        登録された物件はすべて
        <strong className="mx-1">下書き状態 (非公開)</strong>
        になります。物件詳細を確認・修正してから「公開」に切り替えてください。
        OCR が必須項目 (タイトル / 所在地 / 価格) を抽出できなかったファイルはエラー扱いとなり、手動での登録をご利用ください。
      </div>
    </div>
  );
}
