ALTER TABLE "engagement_jobs"
  ADD COLUMN "message_category" varchar(20) NOT NULL DEFAULT 'transactional',
  ADD COLUMN "skip_reason" text;

UPDATE "engagement_jobs"
SET "message_category" = 'promotional'
WHERE "type" IN (
  'review_request',
  'birthday',
  'win_back_30',
  'win_back_60',
  'win_back_90'
);
