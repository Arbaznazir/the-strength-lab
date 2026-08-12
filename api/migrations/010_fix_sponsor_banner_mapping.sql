-- Fix sponsor banner links (MP4 file numbers did not match brand content)
-- 3.mp4 = Steroidify, 2.mp4 = Dragon Pharma, 1.mp4 = DMK Labs

UPDATE sponsor_banners
SET name = 'Steroidify',
    link_url = 'https://steroidify.ltd/',
    image_url = '/sponsors/steroidify.mp4'
WHERE image_url LIKE '%/sponsors/3.mp4'
   OR name ILIKE '%steroidify%';

UPDATE sponsor_banners
SET name = 'Dragon Pharma Store',
    link_url = 'https://dragonpharmastore.to/',
    image_url = '/sponsors/dragon-pharma.mp4'
WHERE image_url LIKE '%/sponsors/2.mp4'
   OR (name ILIKE '%dragon%' AND link_url LIKE '%dragonpharmastore%');

UPDATE sponsor_banners
SET name = 'DMK Labs USA',
    link_url = 'https://dmklabsusa.com/',
    image_url = '/sponsors/dmk-labs.mp4'
WHERE image_url LIKE '%/sponsors/1.mp4'
   OR (name ILIKE '%dmk%' AND link_url LIKE '%dmklabsusa%');
