-- Your Muscle Shop sponsor banner + trusted store hub
INSERT INTO trusted_stores(
  id, name, slug, tag_label, tag_color, banner_url, link_url, description, forum_id, sort_order, is_active
)
SELECT
  gen_random_uuid(),
  'Your Muscle Shop',
  'your-muscle-shop',
  'Trusted Source',
  '#f0c14b',
  '/sponsors/your-muscle-shop.jpg',
  'https://www.yourmuscleshopforum.com/index.php',
  'Your Muscle Shop + GenLabs — Bitcoin promo and community forum partner.',
  (SELECT id FROM forums WHERE slug = 'supplements' LIMIT 1),
  8,
  true
WHERE NOT EXISTS (
  SELECT 1 FROM trusted_stores WHERE slug = 'your-muscle-shop'
);

UPDATE trusted_stores
SET
  name = 'Your Muscle Shop',
  banner_url = '/sponsors/your-muscle-shop.jpg',
  link_url = 'https://www.yourmuscleshopforum.com/index.php',
  description = 'Your Muscle Shop + GenLabs — Bitcoin promo and community forum partner.',
  is_active = true
WHERE slug = 'your-muscle-shop';

INSERT INTO sponsor_banners(id, name, image_url, link_url, sort_order, is_active)
SELECT
  gen_random_uuid(),
  'Your Muscle Shop',
  '/sponsors/your-muscle-shop.jpg',
  'https://www.yourmuscleshopforum.com/index.php',
  4,
  true
WHERE NOT EXISTS (
  SELECT 1 FROM sponsor_banners
  WHERE name ILIKE '%your muscle shop%'
     OR image_url LIKE '%/sponsors/your-muscle-shop.jpg'
);

UPDATE sponsor_banners
SET
  name = 'Your Muscle Shop',
  image_url = '/sponsors/your-muscle-shop.jpg',
  link_url = 'https://www.yourmuscleshopforum.com/index.php',
  is_active = true
WHERE name ILIKE '%your muscle shop%'
   OR image_url LIKE '%/sponsors/your-muscle-shop.jpg';
