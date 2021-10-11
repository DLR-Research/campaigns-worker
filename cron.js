const AWS = require('aws-sdk')
const rdsDataService = new AWS.RDSDataService()

const sql = (query) => ({
  sql: query,
  secretArn: process.env.SECRET_ARN,
  resourceArn: process.env.RDS_ARN,
  database: 'campaigns',
})

const campaignsLoaded = (err, data) => {
  if (err) {
    console.log(err)
  } else {
    console.log(data)
  }
}

exports.handler = (event, context, callback) => {
  const campaignQuery = sql(`
    SELECT
      stripe_endpoint,
      stripe_api_key,
      coinbase_endpoint,
      coinbase_api_key,
      graph_endpoint,
      graph_api_key
    FROM campaigns
  `)
  
  rdsDataService.executeStatement(campaignQuery, campaignsLoaded)
}
