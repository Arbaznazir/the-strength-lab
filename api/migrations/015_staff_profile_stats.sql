ALTER TABLE users ADD COLUMN IF NOT EXISTS follower_count INT NOT NULL DEFAULT 0;

-- Established demo staff profiles (varied so they don't look copy-pasted).
UPDATE users SET
  message_count = 2847,
  reaction_score = 4128,
  trophy_points = 3654,
  follower_count = 1847
WHERE lower(username) = 'coach';

UPDATE users SET
  message_count = 1923,
  reaction_score = 2784,
  trophy_points = 2416,
  follower_count = 1243
WHERE lower(username) = 'spotter';

UPDATE users SET
  message_count = 1156,
  reaction_score = 1892,
  trophy_points = 1428,
  follower_count = 687
WHERE lower(username) = 'lifter';
