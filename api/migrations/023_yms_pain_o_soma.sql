-- YMS Pain-O-Soma banner + trusted store hub
INSERT INTO trusted_stores(
  id, name, slug, tag_label, tag_color, banner_url, link_url, description, forum_id, sort_order, is_active
)
SELECT
  gen_random_uuid(),
  'YMS Pain-O-Soma',
  'yms-pain-o-soma',
  'Trusted Source',
  '#e85d5d',
  '/sponsors/yms-pain-o-soma.png',
  'https://www.yourmuscleshop.com',
  'THE BIGGEST GENLABS SAVINGS | LIMITED-TIME PRICES DROP | DON''T MISS OUT',
  (SELECT id FROM forums WHERE slug = 'introductions' LIMIT 1),
  0,
  true
WHERE NOT EXISTS (
  SELECT 1 FROM trusted_stores WHERE slug = 'yms-pain-o-soma'
);

UPDATE trusted_stores
SET
  name = 'YMS Pain-O-Soma',
  banner_url = '/sponsors/yms-pain-o-soma.png',
  link_url = 'https://www.yourmuscleshop.com',
  description = 'THE BIGGEST GENLABS SAVINGS | LIMITED-TIME PRICES DROP | DON''T MISS OUT',
  sort_order = 0,
  is_active = true
WHERE slug = 'yms-pain-o-soma';

INSERT INTO sponsor_banners(id, name, image_url, link_url, forum_id, sort_order, is_active)
SELECT
  gen_random_uuid(),
  'YMS Pain-O-Soma',
  '/sponsors/yms-pain-o-soma.png',
  'https://www.yourmuscleshop.com',
  (SELECT id FROM forums WHERE slug = 'introductions' LIMIT 1),
  0,
  true
WHERE NOT EXISTS (
  SELECT 1
  FROM sponsor_banners
  WHERE name = 'YMS Pain-O-Soma'
     OR image_url LIKE '%/sponsors/yms-pain-o-soma.png'
);

UPDATE sponsor_banners
SET
  name = 'YMS Pain-O-Soma',
  image_url = '/sponsors/yms-pain-o-soma.png',
  link_url = 'https://www.yourmuscleshop.com',
  forum_id = (SELECT id FROM forums WHERE slug = 'introductions' LIMIT 1),
  sort_order = 0,
  is_active = true
WHERE name = 'YMS Pain-O-Soma'
   OR image_url LIKE '%/sponsors/yms-pain-o-soma.png';
