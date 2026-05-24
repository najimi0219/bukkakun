"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2, Star } from "lucide-react";
import { useCurrentUser } from "@/lib/auth";
import {
  deleteTemplate,
  getEmailTemplates,
  saveTemplate,
  uid,
} from "@/lib/store";
import {
  INQUIRY_KIND_COLOR,
  INQUIRY_KIND_LABEL,
  type EmailTemplate,
  type InquiryKind,
} from "@/lib/types";
import {
  ALL_TEMPLATE_VARS,
  DEFAULT_TEMPLATES,
  TEMPLATE_KINDS,
  TEMPLATE_VARS,
} from "@/lib/emailTemplates";
import { useToast } from "@/components/Toast";
import { Modal } from "@/components/Modal";

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

  if (!tenant) return null;
  const tenantId = tenant.id;

  const kindTemplate = (k: InquiryKind) => templates.find((t) => t.kind === k);
  const customTemplates = templates.filter((t) => !t.kind);

  // 種別テンプレを編集 (未作成なら既定文面で新規作成)
  const editKind = (k: InquiryKind) => {
    const existing = kindTemplate(k);
    if (existing) {
      setEditing(existing);
      return;
    }
    const def = DEFAULT_TEMPLATES[k];
    setEditing({
      id: uid(),
      tenant_id: tenantId,
      kind: k,
      name: def.name,
      subject: def.subject,
      body: def.body,
      is_default: k === "documents",
    });
  };

  const onAddCustom = () => {
    setEditing({
      id: uid(),
      tenant_id: tenantId,
      kind: null,
      name: "新しいテンプレート",
      subject: DEFAULT_TEMPLATES.documents.subject,
      body: DEFAULT_TEMPLATES.documents.body,
      is_default: customTemplates.length === 0,
    });
  };

  const onSave = () => {
    if (!editing) return;
    if (!editing.name.trim()) {
      toast.show("テンプレート名を入力してください", "error");
      return;
    }
    saveTemplate(editing);
    toast.show("テンプレートを保存しました");
    setEditing(null);
  };

  const onDelete = (t: EmailTemplate) => {
    if (!confirm(`「${t.name}」を削除します。よろしいですか?`)) return;
    deleteTemplate(t.id);
    toast.show("テンプレートを削除しました");
  };

  const editorTitle =
    editing && editing.kind
      ? `${INQUIRY_KIND_LABEL[editing.kind]}の自動返信テンプレート`
      : "テンプレート編集";
  const editorVars = editing
    ? editing.kind
      ? TEMPLATE_VARS[editing.kind]
      : ALL_TEMPLATE_VARS
    : [];

  return (
    <div className="p-8 space-y-8 max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">メールテンプレート</h1>
        <p className="text-sm text-gray-500 mt-1">
          問い合わせ種別ごとの自動返信メールと、手動返信用のテンプレートを管理できます。
        </p>
      </div>

      {/* 種別ごとの自動返信 */}
      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">
            種別ごとの自動返信
          </h2>
          <p className="text-sm text-gray-500">
            問い合わせフォームの種別に応じて、自動で送信されるメールです。
          </p>
        </div>
        <div className="grid md:grid-cols-2 gap-4">
          {TEMPLATE_KINDS.map((k) => {
            const t = kindTemplate(k);
            const def = DEFAULT_TEMPLATES[k];
            return (
              <div key={k} className="card p-5">
                <div className="flex items-center gap-2 mb-2">
                  <span className={`badge ${INQUIRY_KIND_COLOR[k]}`}>
                    {INQUIRY_KIND_LABEL[k]}
                  </span>
                  {!t && (
                    <span className="badge bg-amber-100 text-amber-700">
                      未作成
                    </span>
                  )}
                </div>
                <h3 className="font-semibold text-gray-900">
                  {t?.name ?? def.name}
                </h3>
                <div className="text-xs text-gray-500 truncate mb-2">
                  件名:{t?.subject ?? def.subject}
                </div>
                <pre className="text-xs text-gray-600 whitespace-pre-wrap font-sans bg-gray-50 p-3 rounded max-h-32 overflow-y-auto">
                  {t?.body ?? def.body}
                </pre>
                {!t && (
                  <p className="text-xs text-amber-600 mt-2">
                    まだ保存されていません。「作成」すると上記の既定文面が登録されます。
                  </p>
                )}
                <div className="flex justify-end mt-3">
                  <button
                    onClick={() => editKind(k)}
                    className="btn-secondary text-xs"
                  >
                    {t ? "編集" : "作成"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* その他のテンプレート */}
      <section className="space-y-3">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              その他のテンプレート
            </h2>
            <p className="text-sm text-gray-500">
              問い合わせ詳細画面から手動で返信するときに選べるテンプレートです。
            </p>
          </div>
          <button onClick={onAddCustom} className="btn-primary shrink-0">
            <Plus className="w-4 h-4" />
            新規追加
          </button>
        </div>
        {customTemplates.length === 0 ? (
          <p className="text-sm text-gray-500 card p-5">
            カスタムテンプレートはまだありません。
          </p>
        ) : (
          <div className="grid md:grid-cols-2 gap-4">
            {customTemplates.map((t) => (
              <div key={t.id} className="card p-5">
                <div className="flex items-start justify-between mb-3">
                  <div className="min-w-0">
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
                      件名:{t.subject}
                    </div>
                  </div>
                  <button
                    onClick={() => onDelete(t)}
                    className="text-gray-400 hover:text-red-600 shrink-0"
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
        )}
      </section>

      <Modal
        open={!!editing}
        onClose={() => setEditing(null)}
        title={editorTitle}
        size="lg"
      >
        {editing && (
          <div className="p-6 space-y-4">
            {editing.kind && (
              <div className="flex items-center gap-2 p-3 rounded bg-gray-50">
                <span className={`badge ${INQUIRY_KIND_COLOR[editing.kind]}`}>
                  {INQUIRY_KIND_LABEL[editing.kind]}
                </span>
                <span className="text-xs text-gray-500">
                  この種別の問い合わせを受け付けたときに自動返信されます
                </span>
              </div>
            )}
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
              <div className="mt-2 flex flex-wrap gap-1 items-center">
                <span className="text-xs text-gray-500 mr-2">
                  挿入できる変数:
                </span>
                {editorVars.map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() =>
                      setEditing({ ...editing, body: editing.body + v })
                    }
                    className="text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-700 hover:bg-gray-200 font-mono"
                  >
                    {v}
                  </button>
                ))}
              </div>
            </div>
            {!editing.kind && (
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={editing.is_default}
                  onChange={(e) =>
                    setEditing({ ...editing, is_default: e.target.checked })
                  }
                />
                手動返信時のデフォルトに設定
              </label>
            )}
            <div className="flex justify-between gap-2 pt-1">
              <div>
                {editing.kind && (
                  <button
                    type="button"
                    onClick={() => {
                      if (!editing.kind) return;
                      const def = DEFAULT_TEMPLATES[editing.kind];
                      setEditing({
                        ...editing,
                        subject: def.subject,
                        body: def.body,
                      });
                    }}
                    className="btn-secondary text-xs"
                  >
                    既定の文面に戻す
                  </button>
                )}
              </div>
              <div className="flex gap-2">
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
          </div>
        )}
      </Modal>
    </div>
  );
}
