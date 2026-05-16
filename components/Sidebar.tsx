"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Building2,
  Inbox,
  Users,
  Mail,
  Bell,
  Building,
  CreditCard,
  Settings,
  ShieldCheck,
  Cloud,
  Send,
} from "lucide-react";
import { useCurrentUser } from "@/lib/auth";
import { PLAN_LABEL, ROLE_LABEL } from "@/lib/types";

const NAV = [
  { href: "/dashboard", label: "ダッシュボード", icon: LayoutDashboard },
  { href: "/properties", label: "物件管理", icon: Building2 },
  { href: "/inquiries", label: "問い合わせ", icon: Inbox },
  { href: "/inbox", label: "送信メール (デモ)", icon: Mail },
];

const SETTINGS = [
  { href: "/settings/users", label: "ユーザー管理", icon: Users },
  { href: "/settings/storage", label: "ストレージ接続", icon: Cloud },
  { href: "/settings/email-sending", label: "メール送信設定", icon: Send },
  { href: "/settings/email-templates", label: "メールテンプレート", icon: Mail },
  { href: "/settings/notifications", label: "通知設定", icon: Bell },
  { href: "/settings/company", label: "会社情報", icon: Building },
  { href: "/settings/billing", label: "プラン・請求", icon: CreditCard },
];

const SUPER = [
  { href: "/admin/tenants", label: "テナント一覧", icon: ShieldCheck },
  { href: "/admin/billing", label: "課金管理", icon: CreditCard },
  { href: "/admin/analytics", label: "統計", icon: LayoutDashboard },
];

export function Sidebar() {
  const pathname = usePathname();
  const { user, tenant } = useCurrentUser();

  const isActive = (href: string) =>
    pathname === href || pathname?.startsWith(href + "/");

  const isSuperAdmin = user?.role === "admin";

  return (
    <aside className="w-60 shrink-0 border-r border-gray-200 bg-white flex flex-col h-screen sticky top-0">
      <div className="px-5 py-5 border-b border-gray-200">
        <Link href="/dashboard" className="flex items-center gap-2">
          <div className="w-8 h-8 rounded bg-brand-600 text-white flex items-center justify-center font-bold">
            B
          </div>
          <div>
            <div className="font-semibold text-gray-900">BukkenLink</div>
            <div className="text-xs text-gray-500">物件問い合わせ管理</div>
          </div>
        </Link>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4">
        <div className="space-y-1">
          {NAV.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={
                  "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium " +
                  (isActive(item.href)
                    ? "bg-brand-50 text-brand-700"
                    : "text-gray-700 hover:bg-gray-100")
                }
              >
                <Icon className="w-4 h-4" />
                {item.label}
              </Link>
            );
          })}
        </div>

        <div className="mt-6 mb-2 px-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">
          <Settings className="w-3 h-3 inline mr-1" />
          設定
        </div>
        <div className="space-y-1">
          {SETTINGS.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={
                  "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium " +
                  (isActive(item.href)
                    ? "bg-brand-50 text-brand-700"
                    : "text-gray-700 hover:bg-gray-100")
                }
              >
                <Icon className="w-4 h-4" />
                {item.label}
              </Link>
            );
          })}
        </div>

        {isSuperAdmin && (
          <>
            <div className="mt-6 mb-2 px-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">
              <ShieldCheck className="w-3 h-3 inline mr-1" />
              スーパー管理
            </div>
            <div className="space-y-1">
              {SUPER.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={
                      "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium " +
                      (isActive(item.href)
                        ? "bg-brand-50 text-brand-700"
                        : "text-gray-700 hover:bg-gray-100")
                    }
                  >
                    <Icon className="w-4 h-4" />
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </>
        )}
      </nav>

      {user && tenant && (
        <div className="border-t border-gray-200 p-3">
          <div className="px-2 py-2">
            <div className="text-sm font-medium text-gray-900 truncate">{user.name}</div>
            <div className="text-xs text-gray-500 truncate">{tenant.name}</div>
            <div className="flex items-center gap-2 mt-1">
              <span className="badge bg-gray-100 text-gray-700">{ROLE_LABEL[user.role]}</span>
              <span className="badge bg-brand-50 text-brand-700">{PLAN_LABEL[tenant.plan]}</span>
            </div>
          </div>
          <div className="px-3 py-1.5 text-[10px] text-gray-400">
            🔓 認証バイパス中(開発モード)
          </div>
        </div>
      )}
    </aside>
  );
}
