-- 問い合わせ種別ごとのメールテンプレート
-- email_templates に kind 列を追加し、種別ごとの自動返信テンプレを扱えるようにする。
--   kind IS NULL          : 手動返信用のカスタムテンプレ
--   kind = 'documents' 等 : 種別ごとの自動返信テンプレ (テナントごとに1件)

ALTER TABLE email_templates
  ADD COLUMN IF NOT EXISTS kind TEXT;

-- 既存のデフォルトテンプレ (is_default=TRUE) は資料請求 (documents) として扱う
UPDATE email_templates
   SET kind = 'documents'
 WHERE kind IS NULL
   AND is_default = TRUE;

-- 「1テナント1デフォルト」トリガを種別単位に変更し、
-- 種別テンプレとカスタムテンプレの is_default が互いに干渉しないようにする
CREATE OR REPLACE FUNCTION enforce_single_default_template()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_default THEN
    UPDATE email_templates
       SET is_default = FALSE
     WHERE tenant_id = NEW.tenant_id
       AND id <> NEW.id
       AND kind IS NOT DISTINCT FROM NEW.kind;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 既存テナントに不足している種別テンプレを補完する
INSERT INTO email_templates (tenant_id, kind, name, subject, body, is_default)
SELECT t.id, k.kind, k.name, k.subject, k.body, FALSE
  FROM tenants t
  CROSS JOIN (VALUES
    ('documents', '資料請求の自動返信', '【{{物件名}}】資料ダウンロードのご案内',
     '{{会社名}}
{{担当者名}} 様

この度は「{{物件名}}」へのお問い合わせ誠にありがとうございます。
下記URLより物件資料をダウンロードいただけます。

▼ ダウンロードURL
{{資料URL}}

※有効期限:{{有効期限}}まで
※ダウンロード回数には上限がございます

ご不明な点がございましたら、お気軽にご連絡ください。'),
    ('location', '所在確認の自動返信', '【{{物件名}}】所在地のご案内',
     '{{会社名}}
{{担当者名}} 様

この度は「{{物件名}}」へのお問い合わせ誠にありがとうございます。
ご照会いただいた物件の所在地は下記のとおりです。

▼ 所在地
{{所在地}}

▼ 交通
{{交通}}

ご不明な点がございましたら、お気軽にご連絡ください。'),
    ('viewing', '案内希望の自動返信', '【{{物件名}}】内見のご希望を承りました',
     '{{会社名}}
{{担当者名}} 様

この度は「{{物件名}}」の内見をご希望いただき誠にありがとうございます。
下記の内容で承りました。

▼ ご希望日時
{{希望日時}}

▼ ご希望方法
{{希望方法}}

{{案内情報}}

内容を確認の上、担当者より追ってご連絡いたします。
今しばらくお待ちくださいますようお願い申し上げます。'),
    ('offer', '買付送付の自動返信', '【{{物件名}}】買付書類を受領いたしました',
     '{{会社名}}
{{担当者名}} 様

この度は「{{物件名}}」への買付書類をご送付いただき誠にありがとうございます。
書類を確かに受領いたしました。

担当者が内容を確認の上、追ってご連絡いたします。
今しばらくお待ちくださいますようお願い申し上げます。'),
    ('other', 'その他の質問の自動返信', '【{{物件名}}】お問い合わせを受け付けました',
     '{{会社名}}
{{担当者名}} 様

この度は「{{物件名}}」へのお問い合わせ誠にありがとうございます。
下記の内容で承りました。

▼ お問い合わせ内容
{{質問内容}}

担当者より追ってご連絡いたします。
今しばらくお待ちくださいますようお願い申し上げます。')
  ) AS k(kind, name, subject, body)
 WHERE NOT EXISTS (
   SELECT 1 FROM email_templates e
    WHERE e.tenant_id = t.id
      AND e.kind = k.kind
 );

CREATE INDEX IF NOT EXISTS idx_email_templates_kind
  ON email_templates(tenant_id, kind);
