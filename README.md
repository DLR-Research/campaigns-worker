Please DM any security disclosures to @llllvvuu

# Geting Started
[Install Brew](https://brew.sh/)

## PostgreSQL
### Setup
```
brew install postgresql
brew services start postgresql
createdb $USER
createdb campaigns
psql -c "grant all privileges on database campaigns to $USER"
brew install dbmate
```
Add the following to .env, replacing "username" with your username:
```
DATABASE_URL="postgres://username@127.0.0.1:5432/campaigns?sslmode=disable"
```
### Migrations
```
dbmate --help
```
For prod:
1. ssh into EC2 instance
2. cd into `campaigns-worker`
3. run `dbmate up`

## Worker
Prerequisite:
```
yarn global add @cloudflare/wrangler
wrangler login
```
### Setup
`yarn`
### Required Secrets
```
AWS_REGION
AWS_ACCESS_KEY_ID
AWS_SECRET_ACCESS_KEY
AWS_DB_NAME
AWS_AURORA_RESOURCE_ARN
AWS_AURORA_SECRET_ARN
```
### Run locally
`wrangler dev`
### Deploy
`wrangler publish`

## Cron
We use AWS Lambda for the cron job to keep impact stats updated. Copy `cron.js` into the in-browser Lambda code editor.
