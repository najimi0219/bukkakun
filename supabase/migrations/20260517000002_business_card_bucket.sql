-- Private bucket for business card images uploaded during signup.
-- Private because business cards typically contain personal info
-- (phone / mobile / private email). Admin views them via signed URL
-- from /admin/tenants.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'business-cards',
  'business-cards',
  FALSE,
  5242880, -- 5 MiB
  ARRAY['image/png', 'image/jpeg', 'image/webp', 'image/heic']
)
ON CONFLICT (id) DO NOTHING;

-- Open policy for dev (matches the other buckets). Tighten when auth lands.
DROP POLICY IF EXISTS "dev_all_business_cards" ON storage.objects;
CREATE POLICY "dev_all_business_cards"
  ON storage.objects FOR ALL
  USING (bucket_id = 'business-cards')
  WITH CHECK (bucket_id = 'business-cards');
