-- BukkenLink seed data
-- Runs after migrations on `supabase db reset` and on first `supabase start`

-- ============================================================
-- Tenant + users
-- ============================================================
INSERT INTO tenants (id, name, slug, license_number, plan, address, created_at)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'なじみ合同会社',
  'najimi',
  '東京都知事(1) 第000000号',
  'standard',
  '東京都千代田区丸の内1-1-1',
  NOW() - INTERVAL '90 days'
);

INSERT INTO users (id, tenant_id, email, name, role, created_at)
VALUES
  ('00000000-0000-0000-0000-000000000010',
   '00000000-0000-0000-0000-000000000001',
   'info@najimi-llc.com',
   'shuichiro',
   'admin',
   NOW() - INTERVAL '90 days'),
  ('00000000-0000-0000-0000-000000000011',
   '00000000-0000-0000-0000-000000000001',
   'sales@najimi-llc.com',
   '鈴木 花子',
   'sales',
   NOW() - INTERVAL '60 days'),
  ('00000000-0000-0000-0000-000000000012',
   '00000000-0000-0000-0000-000000000001',
   'viewer@najimi-llc.com',
   '佐藤 次郎',
   'viewer',
   NOW() - INTERVAL '30 days');

-- ============================================================
-- Storage connections (mock OAuth state)
-- ============================================================
INSERT INTO storage_connections (
  id, tenant_id, provider, display_name, account_email,
  root_folder_id, root_folder_name, status, is_default,
  mock_token_hint, created_at, last_sync_at
) VALUES
  ('00000000-0000-0000-0000-000000000020',
   '00000000-0000-0000-0000-000000000001',
   'gdrive',
   '営業部 共有ドライブ',
   'info@najimi-llc.com',
   '1XYZ_BukkenLink_Root_Folder_ID',
   'BukkenLink/物件資料',
   'connected',
   TRUE,
   'ya29.****',
   NOW() - INTERVAL '60 days',
   NOW() - INTERVAL '1 hour'),
  ('00000000-0000-0000-0000-000000000021',
   '00000000-0000-0000-0000-000000000001',
   'dropbox',
   'Dropbox Business (バックアップ用)',
   'info@najimi-llc.com',
   '/BukkenLink',
   '/BukkenLink',
   'connected',
   FALSE,
   'sl.****',
   NOW() - INTERVAL '30 days',
   NOW() - INTERVAL '3 hours');

-- ============================================================
-- Properties
-- ============================================================
INSERT INTO properties (
  id, tenant_id, title, property_type, address, price,
  land_area, building_area, built_year_month, transport,
  description, reins_id, status, form_token, created_at
) VALUES
  ('00000000-0000-0000-0000-000000000100',
   '00000000-0000-0000-0000-000000000001',
   '丸の内ガーデンレジデンス 1203',
   'mansion',
   '東京都千代田区丸の内2-3-1',
   128000000,
   NULL, 78.5, '2018-06',
   'JR東京駅 徒歩5分',
   '皇居を望む高層階。最上階リビングからの夜景が圧巻のプレミアム物件。リフォーム済み。',
   'T-2026-00123',
   'published',
   'aaaaaaaa-0000-0000-0000-000000000100',
   NOW() - INTERVAL '10 days'),
  ('00000000-0000-0000-0000-000000000101',
   '00000000-0000-0000-0000-000000000001',
   '世田谷区代田 売地',
   'land',
   '東京都世田谷区代田5-12',
   96000000,
   132.5, NULL, NULL,
   '小田急線 世田谷代田駅 徒歩6分',
   '閑静な住宅街に位置する整形地。建築条件なし。第一種低層住居専用地域。',
   'T-2026-00211',
   'published',
   'aaaaaaaa-0000-0000-0000-000000000101',
   NOW() - INTERVAL '7 days'),
  ('00000000-0000-0000-0000-000000000102',
   '00000000-0000-0000-0000-000000000001',
   '渋谷区神宮前 一棟収益ビル',
   'income',
   '東京都渋谷区神宮前4-2-7',
   980000000,
   215.3, 720.8, '2008-03',
   'JR原宿駅 徒歩4分',
   '表面利回り4.8%、満室稼働中。アパレル系テナント中心。',
   NULL,
   'draft',
   'aaaaaaaa-0000-0000-0000-000000000102',
   NOW() - INTERVAL '3 days');

-- Property assignees (m2m)
INSERT INTO property_assignees (property_id, user_id) VALUES
  ('00000000-0000-0000-0000-000000000100', '00000000-0000-0000-0000-000000000010'),
  ('00000000-0000-0000-0000-000000000100', '00000000-0000-0000-0000-000000000011'),
  ('00000000-0000-0000-0000-000000000101', '00000000-0000-0000-0000-000000000011'),
  ('00000000-0000-0000-0000-000000000102', '00000000-0000-0000-0000-000000000010');

-- ============================================================
-- Property documents (metadata; bytes are uploaded separately when used)
-- These are placeholder rows so the demo download page has something to show.
-- ============================================================
INSERT INTO property_documents (
  id, property_id, storage_connection_id, storage_provider,
  external_file_id, external_view_url,
  file_name, file_size, mime_type, created_at
) VALUES
  ('00000000-0000-0000-0000-000000000200',
   '00000000-0000-0000-0000-000000000100',
   '00000000-0000-0000-0000-000000000020',
   'gdrive',
   '1aBcDeFg_marunouchi_overview',
   'https://drive.google.com/file/d/1aBcDeFg_marunouchi_overview/view',
   '丸の内_物件概要書.pdf',
   1234567,
   'application/pdf',
   NOW() - INTERVAL '10 days'),
  ('00000000-0000-0000-0000-000000000201',
   '00000000-0000-0000-0000-000000000100',
   '00000000-0000-0000-0000-000000000020',
   'gdrive',
   '1aBcDeFg_marunouchi_floorplan',
   'https://drive.google.com/file/d/1aBcDeFg_marunouchi_floorplan/view',
   '丸の内_間取り図.pdf',
   543210,
   'application/pdf',
   NOW() - INTERVAL '10 days'),
  ('00000000-0000-0000-0000-000000000202',
   '00000000-0000-0000-0000-000000000101',
   '00000000-0000-0000-0000-000000000021',
   'dropbox',
   '/BukkenLink/代田_重要事項説明書.pdf',
   'https://www.dropbox.com/scl/fi/abc/daita.pdf',
   '代田_重要事項説明書.pdf',
   876543,
   'application/pdf',
   NOW() - INTERVAL '7 days');

-- ============================================================
-- Inquiries (sample mix across all statuses)
-- ============================================================
INSERT INTO inquiries (
  id, tenant_id, property_id, company_name, license_number,
  contact_name, phone, email, message, status,
  download_token, token_expires_at, download_count, download_limit,
  ip_address, user_agent, created_at
) VALUES
  ('00000000-0000-0000-0000-000000000300',
   '00000000-0000-0000-0000-000000000001',
   '00000000-0000-0000-0000-000000000100',
   'ABC不動産株式会社', '東京都知事(2) 第987654号',
   '高橋 健', '03-1234-5678', 'takahashi@abc-fudosan.example',
   '顧客が興味を示しています。資料をいただけますでしょうか。',
   'new',
   'bbbbbbbb-0000-0000-0000-000000000300',
   NOW() + INTERVAL '7 days', 0, 10,
   '203.0.113.10', 'Mozilla/5.0',
   NOW() - INTERVAL '2 hours'),
  ('00000000-0000-0000-0000-000000000301',
   '00000000-0000-0000-0000-000000000001',
   '00000000-0000-0000-0000-000000000101',
   'ハッピーホーム', '国土交通大臣(5) 第555555号',
   '中村 美穂', '03-2222-3333', 'nakamura@happyhome.example',
   '土地の境界確定状況について教えてください。',
   'in_progress',
   'bbbbbbbb-0000-0000-0000-000000000301',
   NOW() + INTERVAL '7 days', 2, 10,
   '203.0.113.11', 'Mozilla/5.0',
   NOW() - INTERVAL '1 day' - INTERVAL '3 hours'),
  ('00000000-0000-0000-0000-000000000302',
   '00000000-0000-0000-0000-000000000001',
   '00000000-0000-0000-0000-000000000100',
   '東京リアルエステート', '東京都知事(1) 第111222号',
   '田中 雄一', '03-9999-8888', 'tanaka@tokyo-re.example',
   '内見希望です。来週の土曜日に伺えますか?',
   'negotiating',
   'bbbbbbbb-0000-0000-0000-000000000302',
   NOW() + INTERVAL '7 days', 5, 10,
   '203.0.113.12', 'Mozilla/5.0',
   NOW() - INTERVAL '2 days' - INTERVAL '1 hour'),
  ('00000000-0000-0000-0000-000000000303',
   '00000000-0000-0000-0000-000000000001',
   '00000000-0000-0000-0000-000000000101',
   'ABC不動産株式会社', '東京都知事(2) 第987654号',
   '高橋 健', '03-1234-5678', 'takahashi@abc-fudosan.example',
   '買主候補との商談がまとまりました。契約進めたいです。',
   'closed',
   'bbbbbbbb-0000-0000-0000-000000000303',
   NOW() - INTERVAL '1 day', 8, 10,
   '203.0.113.10', 'Mozilla/5.0',
   NOW() - INTERVAL '5 days'),
  ('00000000-0000-0000-0000-000000000304',
   '00000000-0000-0000-0000-000000000001',
   '00000000-0000-0000-0000-000000000100',
   'メガリアルティ', '東京都知事(4) 第333444号',
   '渡辺 広', '03-7777-6666', 'watanabe@mega-realty.example',
   '(問い合わせ内容なし)',
   'rejected',
   'bbbbbbbb-0000-0000-0000-000000000304',
   NOW() + INTERVAL '2 days', 1, 10,
   '203.0.113.13', 'Mozilla/5.0',
   NOW() - INTERVAL '3 days' - INTERVAL '5 hours');

-- Inquiry logs
INSERT INTO inquiry_logs (inquiry_id, user_id, action_type, content, created_at) VALUES
  ('00000000-0000-0000-0000-000000000301',
   '00000000-0000-0000-0000-000000000011',
   'status_change', '未対応 → 対応中',
   NOW() - INTERVAL '1 day' - INTERVAL '2 hours'),
  ('00000000-0000-0000-0000-000000000301',
   '00000000-0000-0000-0000-000000000011',
   'note', '境界杭の有無を売主様に確認中。',
   NOW() - INTERVAL '1 day' - INTERVAL '1 hour'),
  ('00000000-0000-0000-0000-000000000302',
   '00000000-0000-0000-0000-000000000010',
   'status_change', '対応中 → 商談中',
   NOW() - INTERVAL '2 days');

-- Download logs (for inquiry 301 only)
INSERT INTO download_logs (inquiry_id, document_id, ip_address, user_agent, downloaded_at) VALUES
  ('00000000-0000-0000-0000-000000000301',
   '00000000-0000-0000-0000-000000000202',
   '203.0.113.11', 'Mozilla/5.0',
   NOW() - INTERVAL '1 day' - INTERVAL '2 hours'),
  ('00000000-0000-0000-0000-000000000301',
   '00000000-0000-0000-0000-000000000202',
   '203.0.113.11', 'Mozilla/5.0',
   NOW() - INTERVAL '1 day' - INTERVAL '1 hour');

-- The trigger we created bumps download_count too, so reset to match the seeded values
UPDATE inquiries SET download_count = 0 WHERE id = '00000000-0000-0000-0000-000000000300';
UPDATE inquiries SET download_count = 2 WHERE id = '00000000-0000-0000-0000-000000000301';
UPDATE inquiries SET download_count = 5 WHERE id = '00000000-0000-0000-0000-000000000302';
UPDATE inquiries SET download_count = 8 WHERE id = '00000000-0000-0000-0000-000000000303';
UPDATE inquiries SET download_count = 1 WHERE id = '00000000-0000-0000-0000-000000000304';

-- ============================================================
-- Email templates
-- ============================================================
INSERT INTO email_templates (id, tenant_id, name, subject, body, is_default) VALUES
  ('00000000-0000-0000-0000-000000000400',
   '00000000-0000-0000-0000-000000000001',
   'デフォルト自動返信',
   '【BukkenLink】資料ダウンロードのご案内',
   '{{会社名}}
{{担当者名}} 様

この度は「{{物件名}}」へのお問い合わせ誠にありがとうございます。
下記URLより資料をダウンロードいただけます。

▼ ダウンロードURL
{{資料URL}}

※有効期限:{{有効期限}}まで
※ダウンロード回数には上限がございます

ご不明点がございましたらお気軽にご連絡ください。

──
なじみ合同会社
東京都千代田区丸の内1-1-1',
   TRUE),
  ('00000000-0000-0000-0000-000000000401',
   '00000000-0000-0000-0000-000000000001',
   '高額物件用 (丁寧版)',
   '【BukkenLink】物件資料ご送付の件',
   '{{会社名}} {{担当者名}} 様

平素より大変お世話になっております。
この度は「{{物件名}}」につきましてお問い合わせをいただき誠にありがとうございます。

物件資料を下記URLよりご確認くださいませ。

▼ 資料DL
{{資料URL}}

▼ ダウンロード期限
{{有効期限}}

──
なじみ合同会社
営業統括部',
   FALSE);

-- ============================================================
-- Notification settings
-- ============================================================
INSERT INTO notification_settings (
  tenant_id, email_recipients, slack_webhook, line_token, chatwork_token, timing
) VALUES (
  '00000000-0000-0000-0000-000000000001',
  ARRAY['info@najimi-llc.com', 'sales@najimi-llc.com'],
  '', '', '',
  'immediate'
);

-- ============================================================
-- Email send settings (default: relay_with_cc)
-- ============================================================
INSERT INTO email_send_settings (
  id, tenant_id, mode,
  from_display_name, reply_to_email, cc_emails
) VALUES (
  '00000000-0000-0000-0000-000000000500',
  '00000000-0000-0000-0000-000000000001',
  'relay_with_cc',
  'なじみ合同会社',
  'info@najimi-llc.com',
  ARRAY['info@najimi-llc.com']
);
