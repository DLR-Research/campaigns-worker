-- migrate:up
ALTER TABLE users DROP CONSTRAINT users_name_key;
CREATE INDEX users_name_key ON users (name);


-- migrate:down
DROP INDEX users_name_key;
CREATE UNIQUE INDEX users_name_key ON users (name);
