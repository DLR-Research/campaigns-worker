-- migrate:up
CREATE TABLE users (
    user_id serial PRIMARY KEY,
    name VARCHAR UNIQUE,
    email VARCHAR(320) UNIQUE,
    eth_address CHAR(42) UNIQUE
);

CREATE TABLE campaigns (
    campaign_id serial PRIMARY KEY,
    stripe_endpoint VARCHAR,
    stripe_api_key VARCHAR,
    coinbase_endpoint VARCHAR,
    coinbase_api_key VARCHAR,
    graph_endpoint VARCHAR,
    graph_api_key VARCHAR
);

CREATE TABLE impact (
    campaign_id INT NOT NULL,
    user_id INT NOT NULL,
    total_donated NUMERIC,
    total_referred NUMERIC,
    PRIMARY KEY (user_id, campaign_id),
    FOREIGN KEY (user_id)
        REFERENCES users (user_id),
    FOREIGN KEY (campaign_id)
        REFERENCES campaigns (campaign_id)
);

-- migrate:down
DROP TABLE impact;
DROP TABLE users;
DROP TABLE campaigns;
