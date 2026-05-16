"use client";

import { useEffect, useState } from "react";
import { Upload, Image as ImageIcon } from "lucide-react";
import { useCurrentUser } from "@/lib/auth";
import { updateTenant } from "@/lib/store";
import { useToast } from "@/components/Toast";

export default function CompanyPage() {
  const { tenant } = useCurrentUser();
  const toast = useToast();
  const [name, setName] = useState("");
  const [licenseNumber, setLicenseNumber] = useState("");
  const [address, setAddress] = useState("");
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [slug, setSlug] = useState("");

  useEffect(() => {
    if (!tenant) return;
    setName(tenant.name);
    setLicenseNumber(tenant.license_number);
    setAddress(tenant.address ?? "");
    setLogoUrl(tenant.logo_url);
    setSlug(tenant.slug);
  }, [tenant]);

  const onLogoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 2 * 1024 * 1024) {
      toast.show("ロゴ画像は2MB以下にしてください", "error");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setLogoUrl(reader.result as string);
    reader.readAsDataURL(f);
  };

  const onSave = () => {
    if (!tenant) return;
    updateTenant(tenant.id, {
      name,
      license_number: licenseNumber,
      address,
      logo_url: logoUrl,
      slug,
    });
    toast.show("会社情報を保存しました");
  };

  if (!tenant) return null;

  return (
    <div className="p-8 space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">会社情報</h1>
        <p className="text-sm text-gray-500 mt-1">
          フォーム画面と自動返信メールに表示される情報です
        </p>
      </div>

      <div className="card p-6 space-y-4">
        <div>
          <label className="label">会社ロゴ</label>
          <div className="flex items-start gap-4">
            <div className="w-32 h-32 rounded-lg bg-gray-50 border border-gray-200 flex items-center justify-center overflow-hidden">
              {logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={logoUrl}
                  alt="logo"
                  className="max-w-full max-h-full object-contain"
                />
              ) : (
                <ImageIcon className="w-10 h-10 text-gray-300" />
              )}
            </div>
            <div className="flex-1">
              <label className="btn-secondary cursor-pointer inline-flex">
                <Upload className="w-4 h-4" />
                ロゴをアップロード
                <input
                  type="file"
                  accept="image/*"
                  onChange={onLogoChange}
                  className="hidden"
                />
              </label>
              {logoUrl && (
                <button
                  onClick={() => setLogoUrl(null)}
                  className="ml-2 text-sm text-red-600 hover:underline"
                >
                  削除
                </button>
              )}
              <p className="text-xs text-gray-500 mt-2">
                推奨:横長 / 透過PNG / 2MB以下
              </p>
            </div>
          </div>
        </div>
        <div>
          <label className="label">会社名</label>
          <input
            className="input"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <div>
          <label className="label">宅建業免許番号</label>
          <input
            className="input"
            value={licenseNumber}
            onChange={(e) => setLicenseNumber(e.target.value)}
          />
        </div>
        <div>
          <label className="label">所在地</label>
          <input
            className="input"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
          />
        </div>
        <div>
          <label className="label">URLスラッグ</label>
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500">https://example.com/</span>
            <input
              className="input"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
            />
            <span className="text-sm text-gray-500">/form/...</span>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            Proプランではカスタムドメインも設定可能
          </p>
        </div>
      </div>

      <div className="flex justify-end">
        <button onClick={onSave} className="btn-primary">
          保存
        </button>
      </div>
    </div>
  );
}
