-- GenLabs Loot Sale — wide banner sponsor + trusted store hub
INSERT INTO trusted_stores(
  id, name, slug, tag_label, tag_color, banner_url, link_url, description, forum_id, sort_order, is_active
)
SELECT
  gen_random_uuid(),
  'GenLabs Loot Sale',
  'genlabs-loot-sale',
  'Trusted Source',
  '#e85d5d',
  '/sponsors/genlabs-loot-sale.png',
  'https://www.genlabs.st',
  'THE GENLABS LOOT SALE IS LIVE | BIG SALE. BIGGER CHOICES | SHOP NOW OR MISS THEM',
  (SELECT id FROM forums WHERE slug = 'supplements' LIMIT 1),
  0,
  true
WHERE NOT EXISTS (
  SELECT 1 FROM trusted_stores WHERE slug = 'genlabs-loot-sale'
);

UPDATE trusted_stores
SET
  name = 'GenLabs Loot Sale',
  banner_url = '/sponsors/genlabs-loot-sale.png',
  link_url = 'https://www.genlabs.st',
  description = 'THE GENLABS LOOT SALE IS LIVE | BIG SALE. BIGGER CHOICES | SHOP NOW OR MISS THEM',
  sort_order = 0,
  is_active = true
WHERE slug = 'genlabs-loot-sale';

INSERT INTO sponsor_banners(id, name, image_url, link_url, forum_id, sort_order, is_active)
SELECT
  gen_random_uuid(),
  'GenLabs Loot Sale',
  '/sponsors/genlabs-loot-sale.png',
  'https://www.genlabs.st',
  (SELECT id FROM forums WHERE slug = 'supplements' LIMIT 1),
  0,
  true
WHERE NOT EXISTS (
  SELECT 1 FROM sponsor_banners
  WHERE name ILIKE '%genlabs loot%'
     OR image_url LIKE '%/sponsors/genlabs-loot-sale.png'
);

UPDATE sponsor_banners
SET
  name = 'GenLabs Loot Sale',
  image_url = '/sponsors/genlabs-loot-sale.png',
  link_url = 'https://www.genlabs.st',
  forum_id = (SELECT id FROM forums WHERE slug = 'supplements' LIMIT 1),
  sort_order = 0,
  is_active = true
WHERE name ILIKE '%genlabs loot%'
   OR image_url LIKE '%/sponsors/genlabs-loot-sale.png';
