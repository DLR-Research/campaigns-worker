-- migrate:up
CREATE INDEX campaigns_campaign_id_idx ON campaigns USING btree (campaign_id)

-- migrate:down
DROP INDEX campaigns_campaign_id_idx
