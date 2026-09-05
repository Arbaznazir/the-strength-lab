-- GenLabs Wholesale banner + trusted store hub
INSERT INTO trusted_stores(
  id, name, slug, tag_label, tag_color, banner_url, link_url, description, forum_id, sort_order, is_active
)
SELECT
  gen_random_uuid(),
  'GenLabs Wholesale',
  'genlabs-wholesale',
  'Trusted Source',
  '#e85d5d',
  '/sponsors/genlabs-wholesale.png',
  'https://www.yourmuscleshop.com',
  'THE BIGGEST GENLABS SAVINGS | LIMITED-TIME PRICES DROP | DON''T MISS OUT',
  (SELECT id FROM forums WHERE slug = 'supplements' LIMIT 1),
  0,
  true
WHERE NOT EXISTS (
  SELECT 1 FROM trusted_stores WHERE slug = 'genlabs-wholesale'
);

UPDATE trusted_stores
SET
  name = 'GenLabs Wholesale',
  banner_url = '/sponsors/genlabs-wholesale.png',
  link_url = 'https://www.yourmuscleshop.com',
  description = 'THE BIGGEST GENLABS SAVINGS | LIMITED-TIME PRICES DROP | DON''T MISS OUT',
  sort_order = 0,
  is_active = true
WHERE slug = 'genlabs-wholesale';

INSERT INTO sponsor_banners(id, name, image_url, link_url, forum_id, sort_order, is_active)
SELECT
  gen_random_uuid(),
  'GenLabs Wholesale',
  '/sponsors/genlabs-wholesale.png',
  'https://www.yourmuscleshop.com',
  (SELECT id FROM forums WHERE slug = 'supplements' LIMIT 1),
  0,
  true
WHERE NOT EXISTS (
  SELECT 1
  FROM sponsor_banners
  WHERE name = 'GenLabs Wholesale'
     OR image_url LIKE '%/sponsors/genlabs-wholesale.png'
);

UPDATE sponsor_banners
SET
  name = 'GenLabs Wholesale',
  image_url = '/sponsors/genlabs-wholesale.png',
  link_url = 'https://www.yourmuscleshop.com',
  forum_id = (SELECT id FROM forums WHERE slug = 'supplements' LIMIT 1),
  sort_order = 0,
  is_active = true
WHERE name = 'GenLabs Wholesale'
   OR image_url LIKE '%/sponsors/genlabs-wholesale.png';
