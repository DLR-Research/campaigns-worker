-- migrate:up
ALTER TABLE campaigns
ADD COLUMN contribution_total NUMERIC NOT NULL DEFAULT 0


-- migrate:down
ALTER TABLE campaigns
DROP COLUMN contribution_total
