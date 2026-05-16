"use client";

import { useEffect, useState } from "react";
import { Plus, X, Bell } from "lucide-react";
import { useCurrentUser } from "@/lib/auth";
import {
  getNotificationSettings,
  saveNotificationSettings,
  uid,
} from "@/lib/store";
import type { NotificationSettings } from "@/lib/types";
import { useToast } from "@/components/Toast";

export default function NotificationsPage() {
  const { tenant } = useCurrentUser();
  const toast = useToast();
  const [settings, setSettings] = useState<NotificationSettings | null>(null);
  const [newEmail, setNewEmail] = useState("");

  useEffect(() => {
    if (!tenant) return;
    const sync = () => {
      let s = getNotificationSettings(tenant.id);
      if (!s) {
        s = {
          id: uid(),
          tenant_id: tenant.id,
          email_recipients: [],
          slack_webhook: "",
          line_token: "",
          chatwork_token: "",
          timing: "immediate",
        };
      }
      setSettings(s);
    };
    sync();
    window.addEventListener("bukkenlink:dbchange", sync);
    return () => window.removeEventListener("bukkenlink:dbchange", sync);
  }, [tenant]);

  const addEmail = () => {
    if (!settings || !newEmail) return;
    if (!/^.+@.+\..+$/.test(newEmail)) {
      toast.show("正しいメールアドレスを入力してください", "error");
      return;
    }
    if (settings.email_recipients.includes(newEmail)) {
      toast.show("既に追加されています", "error");
      return;
    }
    setSettings({
      ...settings,
      email_recipients: [...settings.email_recipients, newEmail],
    });
    setNewEmail("");
  };

  const removeEmail = (email: string) => {
    if (!settings) return;
    setSettings({
      ...settings,
      email_recipients: settings.email_recipients.filter((e) => e !== email),
    });
  };

  const onSave = () => {
    if (!settings) return;
    saveNotificationSettings(settings);
    toast.show("通知設定を保存しました");
  };

  if (!tenant || !settings) return null;

  return (
    <div className="p-8 space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">通知設定</h1>
        <p className="text-sm text-gray-500 mt-1">
          問い合わせ受信時の通知先を設定します
        </p>
      </div>

      <div className="card p-6 space-y-4">
        <h2 className="font-semibold text-gray-900 flex items-center gap-2">
          <Bell className="w-5 h-5 text-brand-600" />
          通知タイミング
        </h2>
        <div className="space-y-2">
          <label className="flex items-start gap-3 p-3 rounded border border-gray-200 cursor-pointer hover:bg-gray-50">
            <input
              type="radio"
              checked={settings.timing === "immediate"}
              onChange={() => setSettings({ ...settings, timing: "immediate" })}
              className="mt-1"
            />
            <div>
              <div className="text-sm font-medium text-gray-900">受信即時</div>
              <div className="text-xs text-gray-500">
                問い合わせを受信したらすぐに通知します
              </div>
            </div>
          </label>
          <label className="flex items-start gap-3 p-3 rounded border border-gray-200 cursor-pointer hover:bg-gray-50">
            <input
              type="radio"
              checked={settings.timing === "daily"}
              onChange={() => setSettings({ ...settings, timing: "daily" })}
              className="mt-1"
            />
            <div>
              <div className="text-sm font-medium text-gray-900">
                朝サマリ送信
              </div>
              <div className="text-xs text-gray-500">
                一日分の問い合わせをまとめて毎朝通知します
              </div>
            </div>
          </label>
        </div>
      </div>

      <div className="card p-6 space-y-4">
        <h2 className="font-semibold text-gray-900">メール通知</h2>
        <div className="flex flex-wrap gap-2">
          {settings.email_recipients.map((e) => (
            <span
              key={e}
              className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-brand-50 text-brand-700 text-sm"
            >
              {e}
              <button
                onClick={() => removeEmail(e)}
                className="text-brand-500 hover:text-brand-800"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
          {settings.email_recipients.length === 0 && (
            <span className="text-sm text-gray-500">
              通知先メールアドレスが未設定です
            </span>
          )}
        </div>
        <div className="flex gap-2">
          <input
            type="email"
            className="input flex-1"
            placeholder="notify@company.example"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addEmail())}
          />
          <button onClick={addEmail} className="btn-secondary">
            <Plus className="w-4 h-4" />
            追加
          </button>
        </div>
      </div>

      <div className="card p-6 space-y-4">
        <h2 className="font-semibold text-gray-900">Slack 通知</h2>
        <div>
          <label className="label">Webhook URL</label>
          <input
            className="input font-mono text-xs"
            placeholder="https://hooks.slack.com/services/..."
            value={settings.slack_webhook}
            onChange={(e) =>
              setSettings({ ...settings, slack_webhook: e.target.value })
            }
          />
        </div>
      </div>

      <div className="card p-6 space-y-4">
        <h2 className="font-semibold text-gray-900">LINE 通知</h2>
        <div>
          <label className="label">LINE Notify トークン</label>
          <input
            type="password"
            className="input font-mono text-xs"
            placeholder="LINE Notify Personal Access Token"
            value={settings.line_token}
            onChange={(e) =>
              setSettings({ ...settings, line_token: e.target.value })
            }
          />
        </div>
      </div>

      <div className="card p-6 space-y-4">
        <h2 className="font-semibold text-gray-900">Chatwork 通知</h2>
        <div>
          <label className="label">Chatwork API トークン</label>
          <input
            type="password"
            className="input font-mono text-xs"
            placeholder="Chatwork API Token"
            value={settings.chatwork_token}
            onChange={(e) =>
              setSettings({ ...settings, chatwork_token: e.target.value })
            }
          />
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
