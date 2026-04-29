-- Add moodboard type and expand format options for JPG/WEBP
ALTER TABLE brand_assets DROP CONSTRAINT IF EXISTS brand_assets_type_check;
ALTER TABLE brand_assets ADD CONSTRAINT brand_assets_type_check CHECK (type IN ('logo_primary', 'logo_mark', 'font_file', 'watermark', 'moodboard'));

ALTER TABLE brand_assets DROP CONSTRAINT IF EXISTS brand_assets_format_check;
ALTER TABLE brand_assets ADD CONSTRAINT brand_assets_format_check CHECK (format IN ('svg', 'woff2', 'png', 'ttf', 'otf', 'jpg', 'jpeg', 'webp'));
