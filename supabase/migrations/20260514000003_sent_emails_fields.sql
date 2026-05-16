-- Extend sent_emails to capture the From / Cc / Reply-To / send mode used.
ALTER TABLE sent_emails ADD COLUMN from_email TEXT;
ALTER TABLE sent_emails ADD COLUMN from_display_name TEXT;
ALTER TABLE sent_emails ADD COLUMN reply_to TEXT;
ALTER TABLE sent_emails ADD COLUMN cc TEXT[];
ALTER TABLE sent_emails ADD COLUMN send_mode email_send_mode;
