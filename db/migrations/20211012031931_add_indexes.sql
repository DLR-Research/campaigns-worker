-- migrate:up
CREATE EXTENSION pg_trgm;
ALTER TABLE users
ALTER COLUMN name TYPE TEXT,
ALTER COLUMN email TYPE TEXT,
ALTER COLUMN eth_address TYPE TEXT;
CREATE INDEX users_name_trgm_idx ON users USING gin (name gin_trgm_ops);
CREATE INDEX users_email_trgm_idx ON users USING gin (email gin_trgm_ops);
CREATE INDEX users_eth_trgm_idx ON users USING gin (eth_address gin_trgm_ops);
CREATE INDEX impact_total_donated_idx ON impact USING btree (total_donated);



-- migrate:down
DROP INDEX users_name_trgm_idx;
DROP INDEX users_email_trgm_idx;
DROP INDEX users_eth_trgm_idx;
DROP INDEX impact_total_donated_idx;
ALTER TABLE users
ALTER COLUMN name TYPE VARCHAR,
ALTER COLUMN email TYPE VARCHAR,
ALTER COLUMN eth_address TYPE VARCHAR;
DROP EXTENSION pg_trgm;
