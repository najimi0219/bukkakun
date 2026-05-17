"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Upload, X, FileText, Cloud, AlertCircle, Sparkles, Loader2 } from "lucide-react";
import { hasOcrAccess, OCR_BADGE_LABEL } from "@/lib/featureFlags";
import { useCurrentUser } from "@/lib/auth";
import {
  addDocument,
  createProperty,
  deleteDocument,
  getDefaultStorageConnection,
  getDocuments,
  getStorageConnections,
  getUsers,
  updateProperty,
} from "@/lib/store";
import {
  PROPERTY_TYPE_LABEL,
  STORAGE_PROVIDER_COLOR,
  STORAGE_PROVIDER_LABEL,
  VIEWING_METHOD_LABEL,
  AVAILABILITY_STATUS_LABEL,
  type AvailabilityStatus,
  type Property,
  type PropertyDocument,
  type PropertyType,
  type StorageConnection,
  type User,
  type ViewingMethod,
} from "@/lib/types";
import { useToast } from "@/components/Toast";
import { formatBytes } from "@/lib/format";
import { StorageProviderIcon } from "@/components/StorageProviderIcon";
import { getSupabase, PROPERTY_DOCS_BUCKET } from "@/lib/supabase";

interface Props {
  tenantId: string;
  property?: Property;
}

export function PropertyForm({ tenantId, property }: Props) {
  const router = useRouter();
  const toast = useToast();
  const isEdit = !!property;

  const [title, setTitle] = useState(property?.title ?? "");
  const [propertyType, setPropertyType] = useState<PropertyType>(
    property?.property_type ?? "mansion"
  );
  const [address, setAddress] = useState(property?.address ?? "");
  const [price, setPrice] = useState<string>(property ? String(property.price) : "");
  const [landArea, setLandArea] = useState(
    property?.land_area != null ? String(property.land_area) : ""
  );
  const [buildingArea, setBuildingArea] = useState(
    property?.building_area != null ? String(property.building_area) : ""
  );
  const [builtYearMonth, setBuiltYearMonth] = useState(
    property?.built_year_month ?? ""
  );
  const [transport, setTransport] = useState(property?.transport ?? "");
  const [description, setDescription] = useState(property?.description ?? "");
  const [reinsId, setReinsId] = useState(property?.reins_id ?? "");
  const [status, setStatus] = useState<"published" | "draft">(
    property?.status ?? "published"
  );
  const [assigneeIds, setAssigneeIds] = useState<string[]>(
    property?.assignee_ids ?? []
  );
  // 公開設定
  const [showAddress, setShowAddress] = useState<boolean>(
    property?.show_address ?? true
  );
  // 内見対応
  const [viewingAvailable, setViewingAvailable] = useState<boolean>(
    property?.viewing_available ?? false
  );
  const [viewingMethods, setViewingMethods] = useState<ViewingMethod[]>(
    property?.viewing_methods ?? []
  );
  const [viewingKeyPickupInfo, setViewingKeyPickupInfo] = useState<string>(
    property?.viewing_key_pickup_info ?? ""
  );
  const [viewingKeyBoxCode, setViewingKeyBoxCode] = useState<string>(
    property?.viewing_key_box_code ?? ""
  );
  const [viewingNotes, setViewingNotes] = useState<string>(
    property?.viewing_notes ?? ""
  );

  // 販売状況 (Phase A)
  const [availabilityStatus, setAvailabilityStatus] = useState<AvailabilityStatus>(
    property?.availability_status ?? "available"
  );
  const [verificationFrequencyDays, setVerificationFrequencyDays] =
    useState<number>(property?.verification_frequency_days ?? 1);
  const [verificationEmailEnabled, setVerificationEmailEnabled] =
    useState<boolean>(property?.verification_email_enabled ?? true);

  const toggleViewingMethod = (m: ViewingMethod) => {
    setViewingMethods((prev) =>
      prev.includes(m) ? prev.filter((x) => x !== m) : [...prev, m]
    );
  };
  const [users, setUsers] = useState<User[]>([]);
  const [docs, setDocs] = useState<PropertyDocument[]>([]);
  const [connections, setConnections] = useState<StorageConnection[]>([]);
  const [activeConnId, setActiveConnId] = useState<string>("");
  const [isDragOver, setIsDragOver] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    const sync = () => {
      setUsers(getUsers(tenantId));
      if (property) setDocs(getDocuments(property.id));
      const conns = getStorageConnections(tenantId).filter(
        (c) => c.status === "connected"
      );
      setConnections(conns);
      const def = getDefaultStorageConnection(tenantId);
      setActiveConnId((prev) => prev || def?.id || conns[0]?.id || "");
    };
    sync();
    window.addEventListener("bukkenlink:dbchange", sync);
    return () => window.removeEventListener("bukkenlink:dbchange", sync);
  }, [tenantId, property]);

  const toggleAssignee = (id: string) => {
    setAssigneeIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  // ----- マイソク OCR (新規物件登録時の入力補助) -----
  const { tenant } = useCurrentUser();
  const ocrEnabled = hasOcrAccess(tenant);
  const [ocrRunning, setOcrRunning] = useState(false);
  const [ocrApplied, setOcrApplied] = useState<Set<string>>(new Set());
  const sheetInputRef = useRef<HTMLInputElement>(null);

  const runPropertySheetOcr = async (file: File) => {
    if (file.size > 20 * 1024 * 1024) {
      toast.show("マイソクは20MB以下にしてください", "error");
      return;
    }
    const ok = file.type === "application/pdf" || file.type.startsWith("image/");
    if (!ok) {
      toast.show("PDF または画像ファイルを選択してください", "error");
      return;
    }
    setOcrRunning(true);
    try {
      const fd = new FormData();
      fd.append("file", file, file.name);
      fd.append("tenant_id", tenantId);
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
        toast.show(
          "マイソクの自動読み取りに失敗しました: " + (json.error ?? "unknown"),
          "error"
        );
        return;
      }
      const f = json.fields;
      const filled = new Set<string>(ocrApplied);
      const PROPERTY_TYPE_VALUES = [
        "land", "house", "mansion", "income", "business",
      ];
      if (f.title && !title.trim()) {
        setTitle(f.title);
        filled.add("title");
      }
      if (
        f.property_type &&
        PROPERTY_TYPE_VALUES.includes(f.property_type)
      ) {
        setPropertyType(f.property_type as PropertyType);
        filled.add("propertyType");
      }
      if (f.address && !address.trim()) {
        setAddress(f.address);
        filled.add("address");
      }
      if (f.price != null && !price.trim()) {
        setPrice(String(f.price));
        filled.add("price");
      }
      if (f.land_area != null && !landArea.trim()) {
        setLandArea(String(f.land_area));
        filled.add("landArea");
      }
      if (f.building_area != null && !buildingArea.trim()) {
        setBuildingArea(String(f.building_area));
        filled.add("buildingArea");
      }
      if (f.built_year_month && !builtYearMonth.trim()) {
        setBuiltYearMonth(f.built_year_month);
        filled.add("builtYearMonth");
      }
      if (f.transport && !transport.trim()) {
        setTransport(f.transport);
        filled.add("transport");
      }
      if (f.description && !description.trim()) {
        setDescription(f.description);
        filled.add("description");
      }
      if (f.reins_id && !reinsId.trim()) {
        setReinsId(f.reins_id);
        filled.add("reinsId");
      }
      setOcrApplied(filled);
      toast.show(
        filled.size > 0
          ? "マイソクから " + filled.size + " 項目を自動入力しました"
          : "マイソクから自動入力できる項目がありませんでした"
      );
    } catch (err) {
      toast.show(
        "マイソクの自動読み取りに失敗しました: " +
          (err instanceof Error ? err.message : String(err)),
        "error"
      );
    } finally {
      setOcrRunning(false);
    }
  };

  // Mark an OCR-filled field as "user-edited" so the green highlight goes
  // away after manual touch.
  const clearOcrMark = (key: string) => {
    if (!ocrApplied.has(key)) return;
    const next = new Set(ocrApplied);
    next.delete(key);
    setOcrApplied(next);
  };
  const ocrCls = (key: string) =>
    ocrApplied.has(key) ? "border-emerald-400 bg-emerald-50/40" : "";

  const handleFiles = async (files: FileList | File[] | null, propertyId: string) => {
    if (!files) return;
    const list = Array.from(files);
    if (list.length === 0) return;
    const conn = connections.find((c) => c.id === activeConnId);
    const provider = conn?.provider ?? "bukkenlink";
    const connId = conn?.id ?? null;
    const supabase = getSupabase();

    setIsUploading(true);
    let uploaded = 0;
    for (const file of list) {
      if (file.size > 50 * 1024 * 1024) {
        toast.show(file.name + " は50MBを超えています", "error");
        continue;
      }
      const safeName = file.name.replace(/[^\w.\-]+/g, "_");
      const storagePath = tenantId + "/" + propertyId + "/" + Date.now() + "_" + safeName;
      const { error: upErr } = await supabase.storage
        .from(PROPERTY_DOCS_BUCKET)
        .upload(storagePath, file, {
          contentType: file.type || "application/octet-stream",
          upsert: false,
        });
      if (upErr) {
        toast.show(file.name + " のアップロードに失敗: " + upErr.message, "error");
        continue;
      }

      const externalUrl =
        provider === "gdrive"
          ? "https://drive.google.com/file/d/mock-" + (storagePath.split("/").pop() ?? "") + "/view"
          : provider === "dropbox"
            ? "https://www.dropbox.com/scl/fi/mock-" + encodeURIComponent(file.name)
            : provider === "onedrive"
              ? "https://onedrive.live.com/edit?id=mock-" + storagePath
              : provider === "box"
                ? "https://app.box.com/file/mock"
                : provider === "s3"
                  ? "s3://" + (conn?.root_folder_id ?? "bukkenlink-files") + "/" + storagePath
                  : "";

      addDocument({
        property_id: propertyId,
        storage_connection_id: connId,
        storage_provider: provider,
        external_file_id: storagePath,
        external_view_url: externalUrl,
        file_name: file.name,
        file_data: "",
        file_size: file.size,
        mime_type: file.type || "application/octet-stream",
      });
      uploaded += 1;
    }

    setDocs(getDocuments(propertyId));
    setIsUploading(false);
    if (uploaded > 0) {
      toast.show(
        provider === "bukkenlink"
          ? uploaded + "件をアップロードしました (BukkenLinkホスト)"
          : uploaded + "件を " + STORAGE_PROVIDER_LABEL[provider] + " にアップロードしました"
      );
    }
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.types.includes("Files")) {
      setIsDragOver(true);
    }
  };

  const onDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.currentTarget === e.target) setIsDragOver(false);
  };

  const onDrop = (e: React.DragEvent, propertyId: string) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    const files = Array.from(e.dataTransfer.files);
    if (files.length === 0) return;
    void handleFiles(files, propertyId);
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !address || !price) {
      toast.show("必須項目を入力してください", "error");
      return;
    }

    const payload = {
      tenant_id: tenantId,
      title,
      property_type: propertyType,
      address,
      price: Number(price),
      land_area: landArea ? Number(landArea) : null,
      building_area: buildingArea ? Number(buildingArea) : null,
      built_year_month: builtYearMonth || null,
      transport,
      description,
      reins_id: reinsId || null,
      status,
      assignee_ids: assigneeIds,
      show_address: showAddress,
      viewing_available: viewingAvailable,
      viewing_methods: viewingMethods,
      viewing_key_pickup_info: viewingKeyPickupInfo || null,
      viewing_key_box_code: viewingKeyBoxCode || null,
      viewing_notes: viewingNotes || null,
      availability_status: availabilityStatus,
      verification_frequency_days: verificationFrequencyDays,
      verification_email_enabled: verificationEmailEnabled,
      // 状況が変更されたら "最終確認日時" を NOW に更新。
      ...(property && property.availability_status !== availabilityStatus
        ? { availability_updated_at: new Date().toISOString() }
        : !property
          ? { availability_updated_at: new Date().toISOString() }
          : {}),
    };

    if (isEdit && property) {
      updateProperty(property.id, payload);
      toast.show("物件を更新しました");
      router.push("/properties/" + property.id);
    } else {
      const created = createProperty(payload);
      toast.show("物件を登録しました");
      router.push("/properties/" + created.id);
    }
  };

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      {ocrEnabled && !isEdit && (
        <div className="card p-5 bg-gradient-to-r from-emerald-50 to-brand-50 border-emerald-200">
          <h2 className="font-semibold text-gray-900 mb-1 flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-emerald-600" />
            マイソクから自動入力
            <span className="badge bg-amber-100 text-amber-700 text-[10px]">
              {OCR_BADGE_LABEL}
            </span>
          </h2>
          <p className="text-xs text-gray-600 mb-3">
            販売図面 (マイソク) の PDF または画像をアップロードすると、AI が物件情報を読み取って下のフォームに自動入力します。読み取り後、内容を確認・修正の上で登録してください。
          </p>
          <div className="flex items-center gap-3 flex-wrap">
            <button
              type="button"
              onClick={() => sheetInputRef.current?.click()}
              disabled={ocrRunning}
              className="btn-primary text-sm"
            >
              {ocrRunning ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  解析中...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4" />
                  マイソクをアップロード
                </>
              )}
            </button>
            <span className="text-xs text-gray-500">
              PDF / JPG / PNG (20MB以下)
            </span>
            <input
              ref={sheetInputRef}
              type="file"
              accept="application/pdf,image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void runPropertySheetOcr(f);
                // reset so same file can be re-picked
                e.target.value = "";
              }}
            />
          </div>
          {ocrApplied.size > 0 && (
            <p className="mt-3 text-xs text-emerald-700 inline-flex items-center gap-1">
              <Sparkles className="w-3 h-3" />
              {ocrApplied.size} 項目が自動入力されました (緑のハイライト)
            </p>
          )}
        </div>
      )}

      <div className="card p-6 space-y-4">
        <h2 className="font-semibold text-gray-900">基本情報</h2>
        <div className="grid md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <label className="label">
              物件名/タイトル <span className="text-red-500">*</span>
            </label>
            <input
              className={"input " + ocrCls("title")}
              value={title}
              onChange={(e) => { setTitle(e.target.value); clearOcrMark("title"); }}
              required
            />
          </div>
          <div>
            <label className="label">物件種別</label>
            <select
              className={"input " + ocrCls("propertyType")}
              value={propertyType}
              onChange={(e) => {
                setPropertyType(e.target.value as PropertyType);
                clearOcrMark("propertyType");
              }}
            >
              {Object.entries(PROPERTY_TYPE_LABEL).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">公開ステータス</label>
            <select
              className="input"
              value={status}
              onChange={(e) =>
                setStatus(e.target.value as "published" | "draft")
              }
            >
              <option value="published">公開</option>
              <option value="draft">下書き(非公開)</option>
            </select>
          </div>
          <div className="md:col-span-2">
            <label className="label">
              所在地 <span className="text-red-500">*</span>
            </label>
            <input
              className={"input " + ocrCls("address")}
              value={address}
              onChange={(e) => { setAddress(e.target.value); clearOcrMark("address"); }}
              required
            />
          </div>
          <div>
            <label className="label">
              価格 (円) <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              className={"input " + ocrCls("price")}
              value={price}
              onChange={(e) => { setPrice(e.target.value); clearOcrMark("price"); }}
              required
            />
          </div>
          <div>
            <label className="label">レインズ物件番号</label>
            <input
              className={"input " + ocrCls("reinsId")}
              value={reinsId}
              onChange={(e) => { setReinsId(e.target.value); clearOcrMark("reinsId"); }}
              placeholder="任意"
            />
          </div>
          <div>
            <label className="label">土地面積 (㎡)</label>
            <input
              type="number"
              step="0.01"
              className={"input " + ocrCls("landArea")}
              value={landArea}
              onChange={(e) => { setLandArea(e.target.value); clearOcrMark("landArea"); }}
            />
          </div>
          <div>
            <label className="label">建物面積 (㎡)</label>
            <input
              type="number"
              step="0.01"
              className={"input " + ocrCls("buildingArea")}
              value={buildingArea}
              onChange={(e) => { setBuildingArea(e.target.value); clearOcrMark("buildingArea"); }}
            />
          </div>
          <div>
            <label className="label">築年月</label>
            <input
              className={"input " + ocrCls("builtYearMonth")}
              value={builtYearMonth}
              onChange={(e) => { setBuiltYearMonth(e.target.value); clearOcrMark("builtYearMonth"); }}
              placeholder="2018-06"
            />
          </div>
          <div>
            <label className="label">交通</label>
            <input
              className={"input " + ocrCls("transport")}
              value={transport}
              onChange={(e) => { setTransport(e.target.value); clearOcrMark("transport"); }}
              placeholder="○○線 ○○駅 徒歩○分"
            />
          </div>
          <div className="md:col-span-2">
            <label className="label">物件概要</label>
            <textarea
              className={"input min-h-[100px] " + ocrCls("description")}
              value={description}
              onChange={(e) => { setDescription(e.target.value); clearOcrMark("description"); }}
            />
          </div>
        </div>
      </div>

      <div className="card p-6 space-y-4">
        <h2 className="font-semibold text-gray-900">営業担当</h2>
        <p className="text-xs text-gray-500">
          複数指定可。担当物件のみ通知設定にも反映されます。
        </p>
        <div className="grid sm:grid-cols-2 gap-2">
          {users.length === 0 ? (
            <div className="text-sm text-gray-500">
              ユーザーが登録されていません
            </div>
          ) : (
            users.map((u) => (
              <label
                key={u.id}
                className="flex items-center gap-2 px-3 py-2 rounded border border-gray-200 cursor-pointer hover:bg-gray-50"
              >
                <input
                  type="checkbox"
                  checked={assigneeIds.includes(u.id)}
                  onChange={() => toggleAssignee(u.id)}
                />
                <div>
                  <div className="text-sm text-gray-900">{u.name}</div>
                  <div className="text-xs text-gray-500">{u.email}</div>
                </div>
              </label>
            ))
          )}
        </div>
      </div>

      {isEdit && property && (
        <div className="card p-6 space-y-4">
          <h2 className="font-semibold text-gray-900">物件資料</h2>

          {connections.length > 0 ? (
            <div>
              <label className="label flex items-center gap-1">
                <Cloud className="w-4 h-4" />
                アップロード先ストレージ
              </label>
              <div className="space-y-2">
                {connections.map((c) => (
                  <label
                    key={c.id}
                    className={
                      "flex items-center gap-3 px-3 py-2 rounded border cursor-pointer transition-colors " +
                      (activeConnId === c.id
                        ? "border-brand-500 bg-brand-50"
                        : "border-gray-200 hover:bg-gray-50")
                    }
                  >
                    <input
                      type="radio"
                      name="storage"
                      checked={activeConnId === c.id}
                      onChange={() => setActiveConnId(c.id)}
                    />
                    <StorageProviderIcon provider={c.provider} size={20} />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-gray-900 truncate">
                        {c.display_name}
                      </div>
                      <div className="text-xs text-gray-500 font-mono truncate">
                        {c.root_folder_name}
                      </div>
                    </div>
                    <span className={"badge " + STORAGE_PROVIDER_COLOR[c.provider]}>
                      {STORAGE_PROVIDER_LABEL[c.provider]}
                    </span>
                  </label>
                ))}
              </div>
              <p className="text-xs text-gray-500 mt-2">
                ファイルは選択したストレージに保存されます。BukkenLink
                サーバーにはメタデータのみ残ります。
              </p>
            </div>
          ) : (
            <div className="p-4 rounded border border-amber-200 bg-amber-50 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5 shrink-0" />
              <div className="text-sm text-amber-800 flex-1">
                <strong>クラウドストレージが未接続です。</strong>
                <br />
                資料は BukkenLink にホストされます。
                <Link
                  href="/settings/storage"
                  className="text-brand-700 underline ml-1"
                >
                  ストレージを接続する →
                </Link>
              </div>
            </div>
          )}

          {/* Drag & Drop zone */}
          <label
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={(e) => onDrop(e, property.id)}
            className={
              "block cursor-pointer rounded-lg border-2 border-dashed transition-colors px-6 py-10 text-center " +
              (isDragOver
                ? "border-brand-500 bg-brand-50"
                : isUploading
                  ? "border-brand-300 bg-brand-50/40"
                  : "border-gray-300 bg-gray-50/50 hover:border-brand-400 hover:bg-brand-50/30")
            }
          >
            <input
              type="file"
              multiple
              className="hidden"
              onChange={(e) => handleFiles(e.target.files, property.id)}
              accept=".pdf,image/*"
              disabled={isUploading}
            />
            {isUploading ? (
              <div className="flex flex-col items-center gap-2 text-brand-700">
                <span className="inline-block w-8 h-8 border-2 border-brand-600 border-t-transparent rounded-full animate-spin" />
                <span className="text-sm font-medium">アップロード中…</span>
              </div>
            ) : isDragOver ? (
              <div className="flex flex-col items-center gap-2 text-brand-700">
                <Upload className="w-10 h-10" />
                <span className="text-base font-medium">ここにドロップ</span>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2 text-gray-600">
                <Upload className="w-8 h-8 text-gray-400" />
                <span className="text-sm font-medium text-gray-700">
                  ファイルをドラッグ&ドロップ
                </span>
                <span className="text-xs text-gray-500">
                  または<span className="text-brand-600 underline">クリックして選択</span>
                </span>
                <span className="text-[11px] text-gray-400 mt-1">
                  PDF・画像 / 最大50MB/ファイル
                </span>
              </div>
            )}
          </label>

          {docs.length > 0 && (
            <ul className="divide-y divide-gray-100 border border-gray-200 rounded">
              {docs.map((d) => (
                <li
                  key={d.id}
                  className="flex items-center gap-3 px-4 py-3"
                >
                  <FileText className="w-5 h-5 text-gray-400 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-gray-900 truncate">
                      {d.file_name}
                    </div>
                    <div className="text-xs text-gray-500 flex items-center gap-2 mt-0.5">
                      <span>{formatBytes(d.file_size)}</span>
                      <span className="text-gray-300">·</span>
                      <span className="inline-flex items-center gap-1">
                        <StorageProviderIcon
                          provider={d.storage_provider}
                          size={12}
                        />
                        {STORAGE_PROVIDER_LABEL[d.storage_provider]}
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      deleteDocument(d.id);
                      setDocs(getDocuments(property.id));
                      toast.show("資料を削除しました");
                    }}
                    className="text-gray-400 hover:text-red-600"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="card p-6 space-y-4">
        <h2 className="font-semibold text-gray-900">公開設定 / 内見対応</h2>

        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={showAddress}
            onChange={(e) => setShowAddress(e.target.checked)}
            className="mt-1"
          />
          <div>
            <div className="text-sm font-medium text-gray-900">
              公開フォームに正確な所在地を表示する
            </div>
            <div className="text-xs text-gray-500">
              OFF にすると、フォームでは市区町村までで打ち切って表示し、所在確認の問い合わせを受けた時に正確な住所を自動返信します。
            </div>
          </div>
        </label>

        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={viewingAvailable}
            onChange={(e) => setViewingAvailable(e.target.checked)}
            className="mt-1"
          />
          <div>
            <div className="text-sm font-medium text-gray-900">
              「案内希望」を受け付ける
            </div>
            <div className="text-xs text-gray-500">
              ON にすると、公開フォームに「案内希望」種別が選択肢として表示されます。
            </div>
          </div>
        </label>

        {viewingAvailable && (
          <div className="pl-6 space-y-4 border-l-2 border-brand-100">
            <div>
              <label className="label">対応可能な内見方法</label>
              <div className="flex flex-wrap gap-2">
                {(["key_pickup", "key_box", "attended"] as ViewingMethod[]).map((m) => (
                  <label
                    key={m}
                    className={
                      "px-3 py-1.5 rounded border text-sm cursor-pointer " +
                      (viewingMethods.includes(m)
                        ? "border-brand-500 bg-brand-50 text-brand-700"
                        : "border-gray-200 bg-white text-gray-700 hover:border-gray-300")
                    }
                  >
                    <input
                      type="checkbox"
                      checked={viewingMethods.includes(m)}
                      onChange={() => toggleViewingMethod(m)}
                      className="hidden"
                    />
                    {VIEWING_METHOD_LABEL[m]}
                  </label>
                ))}
              </div>
            </div>

            {viewingMethods.includes("key_pickup") && (
              <div>
                <label className="label">鍵取り情報 (自動返信に挿入)</label>
                <textarea
                  className="input min-h-[60px]"
                  placeholder="例: 弊社受付までお越しください。受付時間 平日10:00-18:00、03-1234-5678"
                  value={viewingKeyPickupInfo}
                  onChange={(e) => setViewingKeyPickupInfo(e.target.value)}
                />
              </div>
            )}
            {viewingMethods.includes("key_box") && (
              <div>
                <label className="label">キーボックス暗証番号 (自動返信に挿入)</label>
                <input
                  className="input font-mono"
                  placeholder="例: 4桁の番号"
                  value={viewingKeyBoxCode}
                  onChange={(e) => setViewingKeyBoxCode(e.target.value)}
                />
                <p className="text-xs text-red-500 mt-1">
                  ⚠ 自動返信メールにそのまま記載されます。漏洩リスクを承知の上でご設定ください。
                </p>
              </div>
            )}

            <div>
              <label className="label">内見時の注意事項 (任意)</label>
              <textarea
                className="input min-h-[60px]"
                placeholder="例: マンション管理人へ事前連絡をお願いします"
                value={viewingNotes}
                onChange={(e) => setViewingNotes(e.target.value)}
              />
            </div>
          </div>
        )}
      </div>

      <div className="card p-6 space-y-4">
        <h2 className="font-semibold text-gray-900">販売状況</h2>
        <p className="text-xs text-gray-500">
          公開フォームに「○月○日時点で {AVAILABILITY_STATUS_LABEL[availabilityStatus]}」と表示されます。
          状況が変わったらここを更新するか、定期的に届く確認メールから1クリックで更新できます。
        </p>
        <div>
          <label className="label">現在の販売状況</label>
          <div className="flex flex-wrap gap-2">
            {(["available", "reserved", "negotiating", "closed"] as AvailabilityStatus[]).map((s) => (
              <label
                key={s}
                className={
                  "px-3 py-1.5 rounded border text-sm cursor-pointer " +
                  (availabilityStatus === s
                    ? "border-brand-500 bg-brand-50 text-brand-700 ring-2 ring-brand-200"
                    : "border-gray-200 bg-white text-gray-700 hover:border-gray-300")
                }
              >
                <input
                  type="radio"
                  name="availability_status"
                  checked={availabilityStatus === s}
                  onChange={() => setAvailabilityStatus(s)}
                  className="hidden"
                />
                {AVAILABILITY_STATUS_LABEL[s]}
              </label>
            ))}
          </div>
        </div>
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={verificationEmailEnabled}
            onChange={(e) => setVerificationEmailEnabled(e.target.checked)}
            className="mt-1"
          />
          <div>
            <div className="text-sm font-medium text-gray-900">
              定期的に状況確認メールを受け取る
            </div>
            <div className="text-xs text-gray-500">
              メール内の4ボタン (公開 / 申込あり / 商談中 / 終了) をクリックするだけで、最終確認日時が即更新されます。
            </div>
          </div>
        </label>
        {verificationEmailEnabled && (
          <div className="pl-6">
            <label className="label">確認頻度</label>
            <select
              className="input max-w-xs"
              value={verificationFrequencyDays}
              onChange={(e) =>
                setVerificationFrequencyDays(parseInt(e.target.value, 10))
              }
            >
              <option value={1}>毎日</option>
              <option value={3}>3日ごと</option>
              <option value={7}>毎週</option>
              <option value={14}>2週間ごと</option>
              <option value={30}>毎月</option>
            </select>
          </div>
        )}
      </div>

      <div className="flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={() => router.back()}
          className="btn-secondary"
        >
          キャンセル
        </button>
        <button type="submit" className="btn-primary">
          {isEdit ? "更新" : "登録"}
        </button>
      </div>

      {!isEdit && (
        <p className="text-center text-xs text-gray-500">
          ※ 資料アップロードは登録後の編集画面から可能です
        </p>
      )}
    </form>
  );
}
