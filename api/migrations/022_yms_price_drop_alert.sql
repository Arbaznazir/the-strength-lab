-- YMS price-drop alert banner + trusted store hub
INSERT INTO trusted_stores(
  id, name, slug, tag_label, tag_color, banner_url, link_url, description, forum_id, sort_order, is_active
)
SELECT
  gen_random_uuid(),
  'YMS Price Drop Alert',
  'yms-price-drop-alert',
  'Trusted Source',
  '#e85d5d',
  '/sponsors/yms-price-drop-alert.png',
  'https://www.yourmuscleshop.com',
  'PRICE DROP ALERT 🚨 | LIMITED-TIME PRICES WHILE STOCK LASTS',
  (SELECT id FROM forums WHERE slug = 'introductions' LIMIT 1),
  0,
  true
WHERE NOT EXISTS (
  SELECT 1 FROM trusted_stores WHERE slug = 'yms-price-drop-alert'
);

UPDATE trusted_stores
SET
  name = 'YMS Price Drop Alert',
  banner_url = '/sponsors/yms-price-drop-alert.png',
  link_url = 'https://www.yourmuscleshop.com',
  description = 'PRICE DROP ALERT 🚨 | LIMITED-TIME PRICES WHILE STOCK LASTS',
  sort_order = 0,
  is_active = true
WHERE slug = 'yms-price-drop-alert';

INSERT INTO sponsor_banners(id, name, image_url, link_url, forum_id, sort_order, is_active)
SELECT
  gen_random_uuid(),
  'YMS Price Drop Alert',
  '/sponsors/yms-price-drop-alert.png',
  'https://www.yourmuscleshop.com',
  (SELECT id FROM forums WHERE slug = 'introductions' LIMIT 1),
  0,
  true
WHERE NOT EXISTS (
  SELECT 1
  FROM sponsor_banners
  WHERE name = 'YMS Price Drop Alert'
     OR image_url LIKE '%/sponsors/yms-price-drop-alert.png'
);

UPDATE sponsor_banners
SET
  name = 'YMS Price Drop Alert',
  image_url = '/sponsors/yms-price-drop-alert.png',
  link_url = 'https://www.yourmuscleshop.com',
  forum_id = (SELECT id FROM forums WHERE slug = 'introductions' LIMIT 1),
  sort_order = 0,
  is_active = true
WHERE name = 'YMS Price Drop Alert'
   OR image_url LIKE '%/sponsors/yms-price-drop-alert.png';
