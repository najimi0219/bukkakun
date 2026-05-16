import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export const metadata = {
  title: "プライバシーポリシー | BukkenLink",
  description: "BukkenLink における個人情報の取り扱いについて",
};

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-gray-200">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded bg-brand-600 text-white flex items-center justify-center font-bold">
              B
            </div>
            <span className="font-bold text-gray-900">BukkenLink</span>
          </Link>
          <Link
            href="/"
            className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft className="w-4 h-4" />
            トップへ戻る
          </Link>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-12">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          プライバシーポリシー
        </h1>
        <p className="text-sm text-gray-500 mb-10">
          最終更新日: 2026年5月16日
        </p>

        <div className="prose prose-sm max-w-none text-gray-700 space-y-8 leading-relaxed">
          <section>
            <p>
              なじみ合同会社(以下「当社」といいます)は、当社が提供する不動産物件問い合わせ管理 SaaS「BukkenLink」(以下「本サービス」といいます)におけるユーザーおよび本サービスを通じてお問い合わせいただく方(以下総称して「利用者」といいます)の個人情報の取り扱いについて、以下のとおりプライバシーポリシー(以下「本ポリシー」といいます)を定めます。
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">
              第1条 取得する個人情報
            </h2>
            <p>当社は、本サービスの提供にあたり、以下の個人情報を取得します。</p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li>
                テナント (不動産会社) 利用者: 会社名、宅地建物取引業免許番号、所在地、担当者氏名、メールアドレス、電話番号
              </li>
              <li>
                問い合わせフォーム送信者 (他業者): 会社名、担当者氏名、メールアドレス、電話番号、希望条件等のメッセージ内容、IPアドレス、ユーザーエージェント
              </li>
              <li>
                ダウンロード履歴: ダウンロード日時、IPアドレス、ユーザーエージェント
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">
              第2条 個人情報の利用目的
            </h2>
            <p>当社は、取得した個人情報を以下の目的で利用します。</p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li>本サービスの提供および運営</li>
              <li>本サービスの問い合わせ対応および物件資料の送信</li>
              <li>本サービスに関するお知らせ、メンテナンス情報の通知</li>
              <li>不正利用の防止、利用状況の分析、サービス改善</li>
              <li>請求書の発行、料金のご請求</li>
              <li>法令に基づく対応</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">
              第3条 個人情報の第三者提供
            </h2>
            <p>
              当社は、次に掲げる場合を除き、あらかじめ利用者の同意を得ることなく、第三者に個人情報を提供することはありません。
            </p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li>法令に基づき開示することが必要な場合</li>
              <li>人の生命、身体または財産の保護のために必要な場合</li>
              <li>
                本サービスの提供のために必要な業務委託先 (クラウドインフラ事業者、メール配信事業者等) に対し、利用目的の達成に必要な範囲で提供する場合
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">
              第4条 業務委託先
            </h2>
            <p>
              当社は、本サービスの提供にあたり、以下の事業者に業務の一部を委託しており、当該事業者に対し、個人情報の取り扱いに関する適切な監督を行います。
            </p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li>Supabase Inc. (データベース、ストレージ、認証基盤)</li>
              <li>Vercel Inc. (アプリケーションホスティング)</li>
              <li>Resend, Inc. (メール配信)</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">
              第5条 個人情報の安全管理
            </h2>
            <p>
              当社は、取得した個人情報の漏えい、滅失、毀損を防止するため、合理的な安全管理措置を講じます。具体的には、通信の暗号化 (TLS)、アクセス権限の最小化、ストレージレベルの暗号化、アクセスログの取得等を実施しています。
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">
              第6条 個人情報の開示・訂正・削除等
            </h2>
            <p>
              利用者は、当社の保有する自己の個人情報について、開示、訂正、削除、利用停止を求めることができます。これらのご請求は、本ポリシー末尾のお問い合わせ窓口までご連絡ください。当社は、本人確認を行った上で、合理的な期間内に対応いたします。
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">
              第7条 Cookie等の利用
            </h2>
            <p>
              本サービスでは、利用者の利便性向上、利用状況の分析等のため、Cookieおよび類似技術を使用する場合があります。利用者はブラウザの設定により Cookie を無効にすることができますが、その場合、本サービスの一部機能がご利用いただけなくなることがあります。
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">
              第8条 本ポリシーの変更
            </h2>
            <p>
              当社は、必要に応じて本ポリシーを変更することがあります。重要な変更を行う場合は、本サービス上にて事前に告知します。変更後の本ポリシーは、本サービス上に掲示された時点から効力を生じるものとします。
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">
              第9条 お問い合わせ窓口
            </h2>
            <p>
              本ポリシーおよび個人情報の取り扱いに関するお問い合わせは、以下までご連絡ください。
            </p>
            <div className="mt-2 p-4 bg-gray-50 rounded text-sm">
              <div>なじみ合同会社</div>
              <div>BukkenLink 個人情報お問い合わせ窓口</div>
              <div>メール: info@najimi-llc.com</div>
            </div>
          </section>
        </div>

        <div className="mt-12 pt-8 border-t border-gray-200 text-center">
          <Link
            href="/"
            className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft className="w-4 h-4" />
            トップへ戻る
          </Link>
        </div>
      </main>
    </div>
  );
}
