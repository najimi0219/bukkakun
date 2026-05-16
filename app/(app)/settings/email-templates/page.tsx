"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2, Star } from "lucide-react";
import { useCurrentUser } from "@/lib/auth";
import {
  deleteTemplate,
  getEmailTemplates,
  saveTemplate,
} from "@/lib/store";
import type { EmailTemplate } from "@/lib/types";
import { useToast } from "@/components/Toast";
import { Modal } from "@/components/Modal";

const VARS = ["{{会社名}}", "{{担当者名}}", "{{物件名}}", "{{資料URL}}", "{{有効期限}}"];

export default function EmailTemplatesPage() {
  const { tenant } = useCurrentUser();
  const toast = useToast();
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [editing, setEditing] = useState<EmailTemplate | null>(null);

  useEffect(() => {
    if (!tenant) return;
    const sync = () => setTemplates(getEmailTemplates(tenant.id));
    sync();
    window.addEventListener("bukkenlink:dbchange", sync);
    return () => window.removeEventListener("bukkenlink:dbchange", sync);
  }, [tenant]);

  const onAdd = () => {
    if (!tenant) return;
    setEditing({
      id: "tpl-" + Math.random().toString(36).slice(2),
      tenant_id: tenant.id,
      name: "新しいテンプレート",
      subject: "【{{物件名}}】資料ダウンロードのご案内",
      body: `{{会社名}}\n{{担当者名}} 様\n\nお問い合わせありがとうございます。\n資料は下記URLからダウンロードください。\n\n{{資料URL}}\n\n有効期限:{{有効期限}}`,
      is_default: templates.length === 0,
    });
  };

  const onSave = () => {
    if (!editing) return;
    saveTemplate(editing);
    toast.show("テンプレートを保存しました");
    setEditing(null);
  };

  const onDelete = (t: EmailTemplate) => {
    if (!confirm(`「${t.name}」を削除します。よろしいですか?`)) return;
    deleteTemplate(t.id);
    toast.show("テンプレートを削除しました");
  };

  if (!tenant) return null;

  return (
    <div className="p-8 space-y-6 max-w-5xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            メールテンプレート
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            自動返信メールの本文をカスタマイズできます
          </p>
        </div>
        <button onClick={onAdd} className="btn-primary">
          <Plus className="w-4 h-4" />
          新規追加
        </button>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {templates.map((t) => (
          <div key={t.id} className="card p-5">
            <div className="flex items-start justify-between mb-3">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-semibold text-gray-900">{t.name}</h3>
                  {t.is_default && (
                    <span className="badge bg-amber-100 text-amber-700">
                      <Star className="w-3 h-3 mr-0.5 inline" />
                      デフォルト
                    </span>
                  )}
                </div>
                <div className="text-xs text-gray-500 truncate">
                  {t.subject}
                </div>
              </div>
              <button
                onClick={() => onDelete(t)}
                className="text-gray-400 hover:text-red-600"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
            <pre className="text-xs text-gray-600 whitespace-pre-wrap font-sans bg-gray-50 p-3 rounded max-h-32 overflow-y-auto">
              {t.body}
            </pre>
            <div className="flex justify-end mt-3">
              <button
                onClick={() => setEditing(t)}
                className="btn-secondary text-xs"
              >
                編集
              </button>
            </div>
          </div>
        ))}
      </div>

      <Modal
        open={!!editing}
        onClose={() => setEditing(null)}
        title={editing?.name ?? "テンプレート編集"}
        size="lg"
      >
        {editing && (
          <div className="p-6 space-y-4">
            <div>
              <label className="label">テンプレート名</label>
              <input
                className="input"
                value={editing.name}
                onChange={(e) =>
                  setEditing({ ...editing, name: e.target.value })
                }
              />
            </div>
            <div>
              <label className="label">件名</label>
              <input
                className="input"
                value={editing.subject}
                onChange={(e) =>
                  setEditing({ ...editing, subject: e.target.value })
                }
              />
            </div>
            <div>
              <label className="label">本文</label>
              <textarea
                className="input min-h-[280px] font-mono text-xs"
                value={editing.body}
                onChange={(e) =>
                  setEditing({ ...editing, body: e.target.value })
                }
              />
              <div className="mt-2 flex flex-wrap gap-1">
                <span className="text-xs text-gray-500 mr-2">
                  挿入できる変数:
                </span>
                {VARS.map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() =>
                      setEditing({
                        ...editing,
                        body: editing.body + v,
                      })
                    }
                    className="text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-700 hover:bg-gray-200 font-mono"
                  >
                    {v}
                  </button>
                ))}
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={editing.is_default}
                onChange={(e) =>
                  setEditing({ ...editing, is_default: e.target.checked })
                }
              />
              デフォルトテンプレートとして設定
            </label>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setEditing(null)}
                className="btn-secondary"
              >
                キャンセル
              </button>
              <button onClick={onSave} className="btn-primary">
                保存
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
