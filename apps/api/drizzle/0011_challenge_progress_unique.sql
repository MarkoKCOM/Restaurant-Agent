DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM challenge_progress
    GROUP BY guest_id, challenge_id
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Cannot add challenge_progress_guest_challenge_unique while duplicate guest/challenge progress rows exist';
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "challenge_progress_guest_challenge_unique"
  ON "challenge_progress" ("guest_id", "challenge_id");
