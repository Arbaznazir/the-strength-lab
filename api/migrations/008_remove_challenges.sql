-- Remove Challenges & Raffles category and its forums
DELETE FROM posts
WHERE thread_id IN (
    SELECT t.id
    FROM threads t
    JOIN forums f ON f.id = t.forum_id
    WHERE f.slug IN ('weekly-challenges', 'raffles')
);

DELETE FROM threads
WHERE forum_id IN (
    SELECT id FROM forums WHERE slug IN ('weekly-challenges', 'raffles')
);

UPDATE sponsor_banners
SET forum_id = NULL
WHERE forum_id IN (
    SELECT id FROM forums WHERE slug IN ('weekly-challenges', 'raffles')
);

DELETE FROM forums WHERE slug IN ('weekly-challenges', 'raffles');
DELETE FROM categories WHERE slug = 'challenges';
