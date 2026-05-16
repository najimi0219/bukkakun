import Link from "next/link";
import { Building2, QrCode, Kanban, Mail, Shield, Zap } from "lucide-react";

export default function LandingPage() {
  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="border-b border-gray-200 bg-white/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded bg-brand-600 text-white flex items-center justify-center font-bold">
              B
            </div>
            <span className="font-bold text-gray-900">BukkenLink</span>
          </Link>
          <div className="flex items-center gap-3">
            <Link href="/login" className="btn-ghost">
              ログイン
            </Link>
            <Link href="/signup" className="btn-primary">
              無料で始める
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="px-6 py-20 bg-gradient-to-b from-brand-50 to-transparent">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-block px-3 py-1 rounded-full bg-brand-100 text-brand-700 text-xs font-medium mb-4">
            元付業者向け SaaS
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 leading-tight mb-6">
            物件問い合わせの<br className="sm:hidden" />電話対応、もう要らない。
          </h1>
          <p className="text-lg text-gray-600 mb-8 max-w-2xl mx-auto">
            レインズ資料に貼るQRコードで、他業者からの問い合わせを<br className="hidden sm:block" />
            自動受付・資料配布。カンバン形式で対応状況を一元管理します。
          </p>
          <div className="flex items-center justify-center gap-3">
            <Link href="/signup" className="btn-primary text-base px-6 py-3">
              無料プランで始める
            </Link>
            <Link href="/login" className="btn-secondary text-base px-6 py-3">
              デモアカウントでログイン
            </Link>
          </div>
          <p className="mt-4 text-sm text-gray-500">
            デモ:<code className="font-mono">admin@najimi.example</code> / <code className="font-mono">password</code>
          </p>
        </div>
      </section>

      {/* Features */}
      <section className="px-6 py-16">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-2xl font-bold text-gray-900 text-center mb-12">
            主な機能
          </h2>
          <div className="grid md:grid-cols-3 gap-6">
            <FeatureCard
              icon={QrCode}
              title="QRコードで瞬時に資料配布"
              desc="物件ごとにフォームURL/QRを自動生成。レインズ資料に貼るだけで他業者がスマホから即アクセスできます。"
            />
            <FeatureCard
              icon={Kanban}
              title="カンバン式 問い合わせ管理"
              desc="未対応 / 対応中 / 商談中 / 成約 / 却下 をドラッグ&ドロップで管理。誰が何をしているか一目瞭然。"
            />
            <FeatureCard
              icon={Mail}
              title="自動返信メール&資料DL"
              desc="問い合わせ後、資料DL用のトークン付URLを自動メール送信。期限&回数制限で漏洩リスクを抑制。"
            />
            <FeatureCard
              icon={Building2}
              title="物件&メンバー管理"
              desc="物件ごとに営業担当をアサイン。担当物件のみ通知することも可能。社内権限はロールで制御。"
            />
            <FeatureCard
              icon={Shield}
              title="アクセスログ・期限管理"
              desc="ダウンロード回数・有効期限・IP/UAをすべて記録。漏洩時の追跡が可能です。"
            />
            <FeatureCard
              icon={Zap}
              title="Slack/LINE/Chatwork通知"
              desc="問い合わせ受信を即座にチームに通知。メール・Slack・LINE・Chatworkに対応。"
            />
          </div>
        </div>
      </section>

      {/* Plans */}
      <section className="px-6 py-16 bg-gray-50">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-2xl font-bold text-gray-900 text-center mb-12">
            料金プラン
          </h2>
          <div className="grid md:grid-cols-3 gap-6">
            <PlanCard
              name="Free"
              price="¥0"
              features={["物件3件まで", "月20問い合わせまで", "メール通知"]}
            />
            <PlanCard
              name="Standard"
              price="¥3,980"
              period="/月"
              features={["物件30件まで", "月300問い合わせまで", "Slack/LINE通知", "メールテンプレート"]}
              highlight
            />
            <PlanCard
              name="Pro"
              price="¥9,800"
              period="/月"
              features={["物件無制限", "問い合わせ無制限", "チームメンバー追加可", "カスタムドメイン"]}
            />
          </div>
        </div>
      </section>

      <footer className="border-t border-gray-200 py-8">
        <div className="max-w-6xl mx-auto px-6 text-center text-sm text-gray-500">
          © 2026 BukkenLink (なじみ合同会社) — Document version 1.0
        </div>
      </footer>
    </div>
  );
}

function FeatureCard({
  icon: Icon,
  title,
  desc,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  desc: string;
}) {
  return (
    <div className="card p-6">
      <div className="w-10 h-10 rounded-lg bg-brand-100 text-brand-700 flex items-center justify-center mb-4">
        <Icon className="w-5 h-5" />
      </div>
      <h3 className="font-semibold text-gray-900 mb-2">{title}</h3>
      <p className="text-sm text-gray-600 leading-relaxed">{desc}</p>
    </div>
  );
}

function PlanCard({
  name,
  price,
  period,
  features,
  highlight,
}: {
  name: string;
  price: string;
  period?: string;
  features: string[];
  highlight?: boolean;
}) {
  return (
    <div
      className={`card p-6 ${highlight ? "ring-2 ring-brand-500 relative" : ""}`}
    >
      {highlight && (
        <div className="absolute -top-3 left-6 bg-brand-600 text-white text-xs font-medium px-2 py-0.5 rounded">
          人気
        </div>
      )}
      <div className="text-sm font-medium text-gray-500">{name}</div>
      <div className="mt-2 mb-4 flex items-baseline gap-1">
        <span className="text-3xl font-bold text-gray-900">{price}</span>
        {period && <span className="text-gray-500">{period}</span>}
      </div>
      <ul className="space-y-2 text-sm text-gray-600">
        {features.map((f) => (
          <li key={f}>・{f}</li>
        ))}
      </ul>
    </div>
  );
}
