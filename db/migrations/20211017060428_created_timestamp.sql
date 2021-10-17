-- migrate:up
ALTER TABLE users
ADD column created timestamp DEFAULT now();
ALTER TABLE campaigns
ADD column created timestamp DEFAULT now();
ALTER TABLE impact
ADD column created timestamp DEFAULT now();


-- migrate:down
ALTER TABLE users
DROP column created;
ALTER TABLE campaigns
DROP column created;
ALTER TABLE impact
DROP column created;
