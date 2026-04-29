ALTER TABLE brand_assets DROP CONSTRAINT IF EXISTS brand_assets_type_check;
ALTER TABLE brand_assets ADD CONSTRAINT brand_assets_type_check CHECK (type IN ('logo_primary', 'logo_mark', 'font_file', 'watermark', 'moodboard'));
