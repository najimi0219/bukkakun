"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2, Mail } from "lucide-react";
import { useCurrentUser } from "@/lib/auth";
import {
  createUser,
  deleteUser,
  findUserByEmail,
  getUsers,
} from "@/lib/store";
import { ROLE_LABEL, type User, type UserRole } from "@/lib/types";
import { useToast } from "@/components/Toast";
import { Modal } from "@/components/Modal";
import { formatDate } from "@/lib/format";

export default function UsersPage() {
  const { user, tenant } = useCurrentUser();
  const toast = useToast();
  const [users, setUsers] = useState<User[]>([]);
  const [showInvite, setShowInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteName, setInviteName] = useState("");
  const [inviteRole, setInviteRole] = useState<UserRole>("sales");

  useEffect(() => {
    if (!tenant) return;
    const sync = () => setUsers(getUsers(tenant.id));
    sync();
    window.addEventListener("bukkenlink:dbchange", sync);
    return () => window.removeEventListener("bukkenlink:dbchange", sync);
  }, [tenant]);

  const onInvite = () => {
    if (!tenant || !inviteEmail || !inviteName) {
      toast.show("メールアドレスと氏名を入力してください", "error");
      return;
    }
    if (findUserByEmail(inviteEmail)) {
      toast.show("既に登録されているメールアドレスです", "error");
      return;
    }
    createUser({
      tenant_id: tenant.id,
      email: inviteEmail,
      password: "password",
      name: inviteName,
      role: inviteRole,
    });
    toast.show(`${inviteEmail} にメンバー招待を送信しました`);
    setInviteEmail("");
    setInviteName("");
    setInviteRole("sales");
    setShowInvite(false);
  };

  const onDelete = (u: User) => {
    if (u.id === user?.id) {
      toast.show("自分自身は削除できません", "error");
      return;
    }
    if (!confirm(`${u.name} を削除します。よろしいですか?`)) return;
    deleteUser(u.id);
    toast.show("メンバーを削除しました");
  };

  if (!tenant || !user) return null;

  return (
    <div className="p-8 space-y-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">ユーザー管理</h1>
          <p className="text-sm text-gray-500 mt-1">
            社内メンバーの招待・権限管理 ({users.length}名)
          </p>
        </div>
        <button
          onClick={() => setShowInvite(true)}
          className="btn-primary"
          disabled={user.role !== "admin"}
        >
          <Plus className="w-4 h-4" />
          メンバーを招待
        </button>
      </div>

      <div className="card overflow-hidden">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr className="text-left text-xs font-semibold text-gray-500 uppercase">
              <th className="px-4 py-3">氏名</th>
              <th className="px-4 py-3">メール</th>
              <th className="px-4 py-3">ロール</th>
              <th className="px-4 py-3">登録日</th>
              <th className="px-4 py-3 text-right">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {users.map((u) => (
              <tr key={u.id}>
                <td className="px-4 py-3 text-gray-900 font-medium">
                  {u.name}
                  {u.id === user.id && (
                    <span className="ml-2 badge bg-brand-50 text-brand-700">
                      自分
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-gray-600">{u.email}</td>
                <td className="px-4 py-3">
                  <span
                    className={`badge ${
                      u.role === "admin"
                        ? "bg-purple-100 text-purple-700"
                        : u.role === "sales"
                          ? "bg-blue-100 text-blue-700"
                          : "bg-gray-100 text-gray-600"
                    }`}
                  >
                    {ROLE_LABEL[u.role]}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-600">
                  {formatDate(u.created_at)}
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    onClick={() => onDelete(u)}
                    disabled={user.role !== "admin"}
                    className="p-1.5 text-gray-500 hover:text-red-600 disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal
        open={showInvite}
        onClose={() => setShowInvite(false)}
        title="メンバーを招待"
      >
        <div className="p-6 space-y-4">
          <div>
            <label className="label">氏名</label>
            <input
              className="input"
              value={inviteName}
              onChange={(e) => setInviteName(e.target.value)}
            />
          </div>
          <div>
            <label className="label">メールアドレス</label>
            <input
              type="email"
              className="input"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
            />
          </div>
          <div>
            <label className="label">ロール</label>
            <select
              className="input"
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value as UserRole)}
            >
              <option value="admin">管理者</option>
              <option value="sales">営業担当</option>
              <option value="viewer">閲覧のみ</option>
            </select>
          </div>
          <div className="text-xs text-gray-500 bg-gray-50 p-3 rounded">
            <Mail className="w-3 h-3 inline mr-1" />
            招待メールが指定のアドレスに送信されます (認証実装は順次対応)
          </div>
          <div className="flex justify-end gap-2">
            <button
              onClick={() => setShowInvite(false)}
              className="btn-secondary"
            >
              キャンセル
            </button>
            <button onClick={onInvite} className="btn-primary">
              招待
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
