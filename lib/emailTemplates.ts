// 問い合わせ種別ごとの自動返信メールテンプレート
//
// このモジュールが「種別ごとの既定テンプレ文面」「種別ごとに使える変数」
// 「テンプレ変数の組み立て」の唯一の定義元。サインアップ時のシード
// (app/api/signup-tenant)、公開フォームの自動返信 (app/form/[token])、
// 設定画面 (settings/email-templates)、問い合わせ詳細モーダルが参照する。

import type { InquiryKind } from "./types";

export interface TemplateDef {
  name: string;
  subject: string;
  body: string;
}

// 種別テンプレの表示・シード順
export const TEMPLATE_KINDS: InquiryKind[] = ["documents", "location", "viewing", "offer", "other"];

// 種別ごとの既定テンプレ文面 (サインアップ時のシード / フォールバックに使用)
export const DEFAULT_TEMPLATES: Record<InquiryKind, TemplateDef> = {
  documents: {
    name: "資料請求の自動返信",
    subject: "【{{物件名}}】資料ダウンロードのご案内",
    body: "{{会社名}}\n{{担当者名}} 様\n\nこの度は「{{物件名}}」へのお問い合わせ誠にありがとうございます。\n下記URLより物件資料をダウンロードいただけます。\n\n▼ ダウンロードURL\n{{資料URL}}\n\n※有効期限:{{有効期限}}まで\n※ダウンロード回数には上限がございます\n\nご不明な点がございましたら、お気軽にご連絡ください。",
  },
  location: {
    name: "所在確認の自動返信",
    subject: "【{{物件名}}】所在地のご案内",
    body: "{{会社名}}\n{{担当者名}} 様\n\nこの度は「{{物件名}}」へのお問い合わせ誠にありがとうございます。\nご照会いただいた物件の所在地は下記のとおりです。\n\n▼ 所在地\n{{所在地}}\n\n▼ 交通\n{{交通}}\n\nご不明な点がございましたら、お気軽にご連絡ください。",
  },
  viewing: {
    name: "案内希望の自動返信",
    subject: "【{{物件名}}】内見のご希望を承りました",
    body: "{{会社名}}\n{{担当者名}} 様\n\nこの度は「{{物件名}}」の内見をご希望いただき誠にありがとうございます。\n下記の内容で承りました。\n\n▼ ご希望日時\n{{希望日時}}\n\n▼ ご希望方法\n{{希望方法}}\n\n{{案内情報}}\n\n内容を確認の上、担当者より追ってご連絡いたします。\n今しばらくお待ちくださいますようお願い申し上げます。",
  },
  offer: {
    name: "買付送付の自動返信",
    subject: "【{{物件名}}】買付書類を受領いたしました",
    body: "{{会社名}}\n{{担当者名}} 様\n\nこの度は「{{物件名}}」への買付書類をご送付いただき誠にありがとうございます。\n書類を確かに受領いたしました。\n\n担当者が内容を確認の上、追ってご連絡いたします。\n今しばらくお待ちくださいますようお願い申し上げます。",
  },
  other: {
    name: "その他の質問の自動返信",
    subject: "【{{物件名}}】お問い合わせを受け付けました",
    body: "{{会社名}}\n{{担当者名}} 様\n\nこの度は「{{物件名}}」へのお問い合わせ誠にありがとうございます。\n下記の内容で承りました。\n\n▼ お問い合わせ内容\n{{質問内容}}\n\n担当者より追ってご連絡いたします。\n今しばらくお待ちくださいますようお願い申し上げます。",
  },
};

// 編集画面で挿入できる変数 (種別ごと)
export const TEMPLATE_VARS: Record<InquiryKind, string[]> = {
  documents: ["{{会社名}}", "{{担当者名}}", "{{物件名}}", "{{資料URL}}", "{{有効期限}}"],
  location: ["{{会社名}}", "{{担当者名}}", "{{物件名}}", "{{所在地}}", "{{交通}}"],
  viewing: ["{{会社名}}", "{{担当者名}}", "{{物件名}}", "{{希望日時}}", "{{希望方法}}", "{{案内情報}}"],
  offer: ["{{会社名}}", "{{担当者名}}", "{{物件名}}"],
  other: ["{{会社名}}", "{{担当者名}}", "{{物件名}}", "{{質問内容}}"],
};

// カスタム (手動返信用) テンプレで挿入できる全変数
export const ALL_TEMPLATE_VARS: string[] = ["{{会社名}}", "{{担当者名}}", "{{物件名}}", "{{資料URL}}", "{{有効期限}}", "{{所在地}}", "{{交通}}", "{{希望日時}}", "{{希望方法}}", "{{案内情報}}", "{{質問内容}}"];

export interface TemplateVarInput {
  companyName: string;
  contactName: string;
  propertyTitle: string;
  docUrl?: string;
  docExpiresAt?: string;
  address?: string;
  transport?: string;
  viewingPreferredAt?: string;
  viewingMethodLabel?: string;
  viewingInfo?: string;
  question?: string;
}

/**
 * テンプレ文面に差し込む変数の一覧を組み立てる。すべての種別の変数を
 * まとめて返すので、どの種別のテンプレでもそのまま renderTemplate に渡せる。
 * 未指定の項目は空文字になる。
 */
export function buildTemplateVars(
  input: TemplateVarInput
): Record<string, string> {
  return {
    会社名: input.companyName,
    担当者名: input.contactName,
    物件名: input.propertyTitle,
    資料URL: input.docUrl ?? "",
    有効期限: input.docExpiresAt ?? "",
    所在地: input.address ?? "",
    交通: input.transport ?? "",
    希望日時: input.viewingPreferredAt ?? "",
    希望方法: input.viewingMethodLabel ?? "",
    案内情報: input.viewingInfo ?? "",
    質問内容: input.question ?? "",
  };
}
