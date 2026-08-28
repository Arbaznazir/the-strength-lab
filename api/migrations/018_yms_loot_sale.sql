-- Your Muscle Shop LOOT SALE sponsor banner + trusted store hub
INSERT INTO trusted_stores(
  id, name, slug, tag_label, tag_color, banner_url, link_url, description, forum_id, sort_order, is_active
)
SELECT
  gen_random_uuid(),
  'YMS Loot Sale',
  'yms-loot-sale',
  'Trusted Source',
  '#e85d5d',
  '/sponsors/yms-loot-sale.jpg',
  'https://www.yourmuscleshop.com',
  'LOOT SALE — prices just dropped on GenLabs injectables, peptides, orals, HGH/HMG, and more. Only 24 hours left!',
  (SELECT id FROM forums WHERE slug = 'introductions' LIMIT 1),
  1,
  true
WHERE NOT EXISTS (
  SELECT 1 FROM trusted_stores WHERE slug = 'yms-loot-sale'
);

UPDATE trusted_stores
SET
  name = 'YMS Loot Sale',
  banner_url = '/sponsors/yms-loot-sale.jpg',
  link_url = 'https://www.yourmuscleshop.com',
  description = 'LOOT SALE — prices just dropped on GenLabs injectables, peptides, orals, HGH/HMG, and more. Only 24 hours left!',
  is_active = true
WHERE slug = 'yms-loot-sale';

INSERT INTO sponsor_banners(id, name, image_url, link_url, forum_id, sort_order, is_active)
SELECT
  gen_random_uuid(),
  'YMS Loot Sale',
  '/sponsors/yms-loot-sale.jpg',
  'https://www.yourmuscleshop.com',
  (SELECT id FROM forums WHERE slug = 'introductions' LIMIT 1),
  1,
  true
WHERE NOT EXISTS (
  SELECT 1 FROM sponsor_banners
  WHERE name ILIKE '%loot sale%'
     OR image_url LIKE '%/sponsors/yms-loot-sale.jpg'
);

UPDATE sponsor_banners
SET
  name = 'YMS Loot Sale',
  image_url = '/sponsors/yms-loot-sale.jpg',
  link_url = 'https://www.yourmuscleshop.com',
  forum_id = (SELECT id FROM forums WHERE slug = 'introductions' LIMIT 1),
  sort_order = 1,
  is_active = true
WHERE name ILIKE '%loot sale%'
   OR image_url LIKE '%/sponsors/yms-loot-sale.jpg';
