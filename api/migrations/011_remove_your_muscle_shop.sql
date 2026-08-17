-- Remove Your Muscle Shop from trusted stores
DELETE FROM trusted_stores
WHERE slug = 'your-muscle-shop'
   OR name ILIKE 'your muscle shop';
