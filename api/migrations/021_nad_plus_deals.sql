-- NAD+ deals banner + trusted store hub
INSERT INTO trusted_stores(
  id, name, slug, tag_label, tag_color, banner_url, link_url, description, forum_id, sort_order, is_active
)
SELECT
  gen_random_uuid(),
  'NAD+ Deals',
  'nad-plus-deals',
  'Trusted Source',
  '#e85d5d',
  '/sponsors/nad-plus-deals.png',
  'https://www.yourmuscleshop.com',
  'NAD+ DEALS JUST DROPPED 👀 | BIGGER SAVINGS. LIMITED-TIME OFFER',
  (SELECT id FROM forums WHERE slug = 'supplements' LIMIT 1),
  0,
  true
WHERE NOT EXISTS (
  SELECT 1 FROM trusted_stores WHERE slug = 'nad-plus-deals'
);

UPDATE trusted_stores
SET
  name = 'NAD+ Deals',
  banner_url = '/sponsors/nad-plus-deals.png',
  link_url = 'https://www.yourmuscleshop.com',
  description = 'NAD+ DEALS JUST DROPPED 👀 | BIGGER SAVINGS. LIMITED-TIME OFFER',
  sort_order = 0,
  is_active = true
WHERE slug = 'nad-plus-deals';

INSERT INTO sponsor_banners(id, name, image_url, link_url, forum_id, sort_order, is_active)
SELECT
  gen_random_uuid(),
  'NAD+ Deals',
  '/sponsors/nad-plus-deals.png',
  'https://www.yourmuscleshop.com',
  (SELECT id FROM forums WHERE slug = 'supplements' LIMIT 1),
  0,
  true
WHERE NOT EXISTS (
  SELECT 1
  FROM sponsor_banners
  WHERE name = 'NAD+ Deals'
     OR image_url LIKE '%/sponsors/nad-plus-deals.png'
);

UPDATE sponsor_banners
SET
  name = 'NAD+ Deals',
  image_url = '/sponsors/nad-plus-deals.png',
  link_url = 'https://www.yourmuscleshop.com',
  forum_id = (SELECT id FROM forums WHERE slug = 'supplements' LIMIT 1),
  sort_order = 0,
  is_active = true
WHERE name = 'NAD+ Deals'
   OR image_url LIKE '%/sponsors/nad-plus-deals.png';
