-- YMS Viagra price-drop banner + trusted store hub
INSERT INTO trusted_stores(
  id, name, slug, tag_label, tag_color, banner_url, link_url, description, forum_id, sort_order, is_active
)
SELECT
  gen_random_uuid(),
  'YMS Viagra Price Drop',
  'yms-viagra-price-drop',
  'Trusted Source',
  '#e85d5d',
  '/sponsors/yms-viagra-price-drop.png',
  'https://www.yourmuscleshop.com',
  'THE BIGGEST GENLABS SAVINGS | LIMITED-TIME PRICES DROP | DON''T MISS OUT',
  (SELECT id FROM forums WHERE slug = 'introductions' LIMIT 1),
  0,
  true
WHERE NOT EXISTS (
  SELECT 1 FROM trusted_stores WHERE slug = 'yms-viagra-price-drop'
);

UPDATE trusted_stores
SET
  name = 'YMS Viagra Price Drop',
  banner_url = '/sponsors/yms-viagra-price-drop.png',
  link_url = 'https://www.yourmuscleshop.com',
  description = 'THE BIGGEST GENLABS SAVINGS | LIMITED-TIME PRICES DROP | DON''T MISS OUT',
  sort_order = 0,
  is_active = true
WHERE slug = 'yms-viagra-price-drop';

INSERT INTO sponsor_banners(id, name, image_url, link_url, forum_id, sort_order, is_active)
SELECT
  gen_random_uuid(),
  'YMS Viagra Price Drop',
  '/sponsors/yms-viagra-price-drop.png',
  'https://www.yourmuscleshop.com',
  (SELECT id FROM forums WHERE slug = 'introductions' LIMIT 1),
  0,
  true
WHERE NOT EXISTS (
  SELECT 1
  FROM sponsor_banners
  WHERE name = 'YMS Viagra Price Drop'
     OR image_url LIKE '%/sponsors/yms-viagra-price-drop.png'
);

UPDATE sponsor_banners
SET
  name = 'YMS Viagra Price Drop',
  image_url = '/sponsors/yms-viagra-price-drop.png',
  link_url = 'https://www.yourmuscleshop.com',
  forum_id = (SELECT id FROM forums WHERE slug = 'introductions' LIMIT 1),
  sort_order = 0,
  is_active = true
WHERE name = 'YMS Viagra Price Drop'
   OR image_url LIKE '%/sponsors/yms-viagra-price-drop.png';
