"use client";

import { useEffect, useState } from "react";
import { Lock, Check, FolderOpen, ArrowRight } from "lucide-react";
import { Modal } from "@/components/Modal";
import { StorageProviderIcon } from "@/components/StorageProviderIcon";
import {
  STORAGE_PROVIDER_LABEL,
  type StorageProvider,
} from "@/lib/types";

interface Props {
  open: boolean;
  provider: StorageProvider;
  defaultEmail: string;
  onClose: () => void;
  onConnect: (data: {
    account_email: string;
    root_folder_id: string;
    root_folder_name: string;
    display_name: string;
  }) => void;
}

type Step = "auth" | "permissions" | "folder" | "done";

export function StorageConnectModal({
  open,
  provider,
  defaultEmail,
  onClose,
  onConnect,
}: Props) {
  const [step, setStep] = useState<Step>("auth");
  const [email, setEmail] = useState(defaultEmail);
  const [folderName, setFolderName] = useState("BukkenLink/物件資料");
  const [working, setWorking] = useState(false);

  useEffect(() => {
    if (open) {
      setStep("auth");
      setEmail(defaultEmail);
      setFolderName(provider === "s3" ? "bukkenlink-files" : "BukkenLink/物件資料");
      setWorking(false);
    }
  }, [open, defaultEmail, provider]);

  const providerLabel = STORAGE_PROVIDER_LABEL[provider];

  const next = () => {
    setWorking(true);
    setTimeout(() => {
      setWorking(false);
      if (step === "auth") setStep("permissions");
      else if (step === "permissions") setStep("folder");
    }, 600);
  };

  const finish = () => {
    setWorking(true);
    setTimeout(() => {
      setWorking(false);
      onConnect({
        account_email: email,
        root_folder_id:
          provider === "s3"
            ? folderName
            : provider === "dropbox"
              ? "/" + folderName.replace(/^\/+/, "")
              : "folder_" + Math.random().toString(36).slice(2, 12),
        root_folder_name: folderName,
        display_name:
          provider === "s3"
            ? `S3 バケット: ${folderName}`
            : `${email} の ${providerLabel}`,
      });
    }, 800);
  };

  return (
    <Modal open={open} onClose={onClose} size="md">
      <div className="px-6 py-4 border-b border-gray-200 flex items-center gap-3">
        <StorageProviderIcon provider={provider} size={28} />
        <div>
          <h2 className="text-lg font-semibold text-gray-900">
            {providerLabel} に接続
          </h2>
          <p className="text-xs text-gray-500">
            BukkenLink がアクセスするアカウントを選択してください
          </p>
        </div>
      </div>

      <div className="px-6 pt-4">
        <div className="flex items-center gap-2 mb-4 text-xs">
          <StepDot active={step === "auth"} done={step !== "auth"} num={1} label="認証" />
          <div className="flex-1 h-px bg-gray-200" />
          <StepDot
            active={step === "permissions"}
            done={step === "folder" || step === "done"}
            num={2}
            label="権限"
          />
          <div className="flex-1 h-px bg-gray-200" />
          <StepDot active={step === "folder"} done={step === "done"} num={3} label="フォルダ" />
        </div>
      </div>

      {step === "auth" && (
        <div className="p-6 space-y-4">
          {provider === "s3" ? (
            <>
              <div>
                <label className="label">AWS Access Key ID</label>
                <input
                  className="input font-mono text-xs"
                  placeholder="AKIA****************"
                  defaultValue="AKIAIOSFODNN7EXAMPLE"
                />
              </div>
              <div>
                <label className="label">AWS Secret Access Key</label>
                <input
                  type="password"
                  className="input font-mono text-xs"
                  placeholder="****************"
                  defaultValue="wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY"
                />
              </div>
              <div>
                <label className="label">Region</label>
                <input className="input" defaultValue="ap-northeast-1" />
              </div>
            </>
          ) : (
            <>
              <p className="text-sm text-gray-600 leading-relaxed">
                {providerLabel} のアカウントでサインインしてください。
                BukkenLink は資料保管に必要な最小限の権限のみリクエストします。
              </p>
              <div>
                <label className="label">アカウント (メールアドレス)</label>
                <input
                  type="email"
                  className="input"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            </>
          )}
          <div className="flex justify-between items-center pt-2">
            <span className="text-xs text-gray-400 flex items-center gap-1">
              <Lock className="w-3 h-3" />
              このダイアログはデモです
            </span>
            <button onClick={next} disabled={working} className="btn-primary">
              {working ? "認証中..." : "次へ"}
            </button>
          </div>
        </div>
      )}

      {step === "permissions" && (
        <div className="p-6 space-y-4">
          <div className="flex items-start gap-3 p-3 bg-gray-50 rounded">
            <StorageProviderIcon provider={provider} size={32} />
            <div className="text-sm">
              <div className="font-medium text-gray-900">
                BukkenLink にアクセスを許可しますか?
              </div>
              <div className="text-gray-500 mt-0.5">{email}</div>
            </div>
          </div>
          <div>
            <div className="text-xs text-gray-500 mb-2">リクエストする権限:</div>
            <ul className="space-y-2 text-sm">
              <Perm
                label={
                  provider === "s3"
                    ? "指定バケットへのオブジェクトの読み書き"
                    : "BukkenLink が作成・選択したファイル/フォルダの参照と編集"
                }
              />
              <Perm label="ダウンロードリンク用の署名付きURLの発行" />
              <Perm label="メタデータ (ファイル名・サイズ・更新日時) の読み取り" />
            </ul>
            <div className="mt-3 text-xs text-gray-500 leading-relaxed">
              ※ アカウント全体や他のフォルダへのアクセスはリクエストしません。
              いつでも{providerLabel}の設定から接続を解除できます。
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button onClick={onClose} className="btn-secondary">
              拒否
            </button>
            <button onClick={next} disabled={working} className="btn-primary">
              {working ? "処理中..." : "許可"}
            </button>
          </div>
        </div>
      )}

      {step === "folder" && (
        <div className="p-6 space-y-4">
          <div className="flex items-start gap-3 p-3 bg-emerald-50 border border-emerald-200 rounded">
            <Check className="w-5 h-5 text-emerald-600 mt-0.5 shrink-0" />
            <div className="text-sm text-emerald-800">
              <strong>認証に成功しました。</strong>
              <br />
              次に資料を保存するフォルダを指定してください。
            </div>
          </div>
          <div>
            <label className="label flex items-center gap-1">
              <FolderOpen className="w-4 h-4" />
              {provider === "s3" ? "バケット名" : "保管先フォルダ"}
            </label>
            <input
              className="input"
              value={folderName}
              onChange={(e) => setFolderName(e.target.value)}
            />
            <p className="text-xs text-gray-500 mt-1">
              {provider === "s3"
                ? "既存バケットを指定。BukkenLink がここにアップロードします。"
                : "存在しない場合は自動作成されます。BukkenLink はこのフォルダ配下のみ操作します。"}
            </p>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button onClick={onClose} className="btn-secondary">
              キャンセル
            </button>
            <button onClick={finish} disabled={working} className="btn-primary">
              {working ? "接続中..." : "接続を完了"}
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}

function StepDot({
  num,
  label,
  active,
  done,
}: {
  num: number;
  label: string;
  active: boolean;
  done: boolean;
}) {
  return (
    <div className="flex flex-col items-center">
      <div
        className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${
          done ? "bg-emerald-500 text-white" : active ? "bg-brand-600 text-white" : "bg-gray-200 text-gray-500"
        }`}
      >
        {done ? "✓" : num}
      </div>
      <div className="text-[10px] text-gray-500 mt-0.5">{label}</div>
    </div>
  );
}

function Perm({ label }: { label: string }) {
  return (
    <li className="flex items-start gap-2">
      <Check className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" />
      <span className="text-gray-700">{label}</span>
    </li>
  );
}
