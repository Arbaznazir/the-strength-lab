-- GenLabs price-drop banner + sponsor hub entry
INSERT INTO trusted_stores(
  id, name, slug, tag_label, tag_color, banner_url, link_url, description, forum_id, sort_order, is_active
)
SELECT
  gen_random_uuid(),
  'GenLabs Price Drop',
  'genlabs-price-drop',
  'Trusted Source',
  '#e85d5d',
  '/sponsors/genlabs-price-drop.png',
  'https://www.genlabs.st',
  'THE PRICE DROP CONTINUES 🔥 | LOOT SALE IS STILL LIVE | PREMIUM PRODUCTS. BETTER PRICES',
  (SELECT id FROM forums WHERE slug = 'supplements' LIMIT 1),
  1,
  true
WHERE NOT EXISTS (
  SELECT 1 FROM trusted_stores WHERE slug = 'genlabs-price-drop'
);

UPDATE trusted_stores
SET
  name = 'GenLabs Price Drop',
  banner_url = '/sponsors/genlabs-price-drop.png',
  link_url = 'https://www.genlabs.st',
  description = 'THE PRICE DROP CONTINUES 🔥 | LOOT SALE IS STILL LIVE | PREMIUM PRODUCTS. BETTER PRICES',
  sort_order = 1,
  is_active = true
WHERE slug = 'genlabs-price-drop';

INSERT INTO sponsor_banners(id, name, image_url, link_url, forum_id, sort_order, is_active)
SELECT
  gen_random_uuid(),
  'GenLabs Price Drop',
  '/sponsors/genlabs-price-drop.png',
  'https://www.genlabs.st',
  (SELECT id FROM forums WHERE slug = 'supplements' LIMIT 1),
  1,
  true
WHERE NOT EXISTS (
  SELECT 1
  FROM sponsor_banners
  WHERE name = 'GenLabs Price Drop'
     OR image_url LIKE '%/sponsors/genlabs-price-drop.png'
);

UPDATE sponsor_banners
SET
  name = 'GenLabs Price Drop',
  image_url = '/sponsors/genlabs-price-drop.png',
  link_url = 'https://www.genlabs.st',
  forum_id = (SELECT id FROM forums WHERE slug = 'supplements' LIMIT 1),
  sort_order = 1,
  is_active = true
WHERE name = 'GenLabs Price Drop'
   OR image_url LIKE '%/sponsors/genlabs-price-drop.png';
