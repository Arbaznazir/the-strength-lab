-- GenLabs sponsor banner + trusted store hub (first in rotation)
INSERT INTO trusted_stores(
  id, name, slug, tag_label, tag_color, banner_url, link_url, description, forum_id, sort_order, is_active
)
SELECT
  gen_random_uuid(),
  'GenLabs',
  'genlabs',
  'Trusted Source',
  '#e85d5d',
  '/sponsors/genlabs.jpg',
  'https://www.genlabs.st',
  'Biggest GenLabs price drop — injectables, peptides, SARMs, orals, HGH/HMG, insulin, and fat burners.',
  (SELECT id FROM forums WHERE slug = 'supplements' LIMIT 1),
  0,
  true
WHERE NOT EXISTS (
  SELECT 1 FROM trusted_stores WHERE slug = 'genlabs'
);

UPDATE trusted_stores
SET
  name = 'GenLabs',
  banner_url = '/sponsors/genlabs.jpg',
  link_url = 'https://www.genlabs.st',
  description = 'Biggest GenLabs price drop — injectables, peptides, SARMs, orals, HGH/HMG, insulin, and fat burners.',
  sort_order = 0,
  is_active = true
WHERE slug = 'genlabs';

INSERT INTO sponsor_banners(id, name, image_url, link_url, sort_order, is_active)
SELECT
  gen_random_uuid(),
  'GenLabs',
  '/sponsors/genlabs.jpg',
  'https://www.genlabs.st',
  0,
  true
WHERE NOT EXISTS (
  SELECT 1 FROM sponsor_banners
  WHERE name ILIKE '%genlabs%'
     OR image_url LIKE '%/sponsors/genlabs.jpg'
);

UPDATE sponsor_banners
SET
  name = 'GenLabs',
  image_url = '/sponsors/genlabs.jpg',
  link_url = 'https://www.genlabs.st',
  sort_order = 0,
  is_active = true
WHERE name ILIKE '%genlabs%'
   OR image_url LIKE '%/sponsors/genlabs.jpg';
