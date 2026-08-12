-- Sponsor banner outbound links (forum-row MP4 banners)
UPDATE sponsor_banners
SET name = 'Steroidify', link_url = 'https://steroidify.ltd/'
WHERE image_url = '/sponsors/1.mp4' OR image_url LIKE '%/sponsors/1.mp4';

UPDATE sponsor_banners
SET name = 'Dragon Pharma Store', link_url = 'https://dragonpharmastore.to/'
WHERE image_url = '/sponsors/2.mp4' OR image_url LIKE '%/sponsors/2.mp4';

UPDATE sponsor_banners
SET name = 'DMK Labs USA', link_url = 'https://dmklabsusa.com/'
WHERE image_url = '/sponsors/3.mp4' OR image_url LIKE '%/sponsors/3.mp4';

-- Trusted stores section links
UPDATE trusted_stores
SET name = 'Anabolic Dragon',
    slug = 'anabolic-dragon',
    link_url = 'https://anabolic-dragon.com/dr/',
    description = 'Pharmaceutical-grade compounds and peptides.'
WHERE sort_order = 1;

UPDATE trusted_stores
SET name = 'NapsGear',
    slug = 'napsgear',
    link_url = 'https://www.napsgear.org/',
    description = 'Established source with worldwide shipping.'
WHERE sort_order = 2;

UPDATE trusted_stores
SET name = 'DMK Labs USA',
    slug = 'dmk-labs-usa',
    link_url = 'https://dmklabsusa.com/',
    description = 'Quality raw materials and finished products.'
WHERE sort_order = 3;

UPDATE trusted_stores
SET name = 'Your Muscle Shop',
    slug = 'your-muscle-shop',
    link_url = 'https://www.yourmuscleshop.org/',
    description = 'Trusted supplier for serious lifters.'
WHERE sort_order = 4;
