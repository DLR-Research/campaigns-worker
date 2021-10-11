const AWS = require('aws-sdk')
const https = require('https')
const rdsDataService = new AWS.RDSDataService()

const sql = (query) => ({
  sql: query,
  secretArn: process.env.SECRET_ARN,
  resourceArn: process.env.RDS_ARN,
  database: 'campaigns',
})

const processStripeEvents = (campaignId, eventsList) => {
  eventsList.reverse().forEach(event => {
    const prev = event.data.previous_attributes
    const cur = event.data.object
    const capturedDelta = prev == null ? cur.amount_captured : (prev.amount_captured == null ? 0 : cur.amount_captured - prev.amount_captured)
    const refundedDelta = prev == null ? cur.amount_refunded : (prev.amount_refunded == null ? 0 : cur.amount_refunded - prev.amount_refunded)
    const netDelta = capturedDelta - refundedDelta
    const user = event.data.object.billing_details.email
    console.log(`delta of ${netDelta} for ${user} in campaign ${campaignId}`)
  })
}

const handleStripe = (campaignId, url, apiKey) => {
  const authHeader = 'Basic ' + Buffer.from(apiKey + ':').toString('base64');
  const req = https.get(
    url,
    { headers: { Authorization: authHeader } },
    function(res) {
      var body = []
      res.on('data', function(chunk) {
          body.push(chunk)
      })
      res.on('end', function() {
          try {
              body = JSON.parse(Buffer.concat(body).toString())
              processStripeEvents(campaignId, body.data)
          } catch(e) {
              console.log("error parsing stripe resp")
          }
      })
    }
  )
  req.on('error', (e) => {
    console.log('Error in Stripe API call');
    console.log(e);
  })
  req.end()
}


const campaignsLoaded = (err, data) => {
  if (err) {
    console.log(err)
  } else {
    const records = data.records
    records.forEach(record => {
      const campaignId = record[0].longValue
      const STRIPE_URL = record[1].stringValue
      const STRIPE_KEY = record[2].stringValue
      const COINBASE_URL = record[3].stringValue
      const COINBASE_KEY = record[4].stringValue
      handleStripe(campaignId, STRIPE_URL, STRIPE_KEY)
      console.log(campaignId)
      console.log(STRIPE_URL)
      console.log(STRIPE_KEY)
      console.log(COINBASE_URL)
      console.log(COINBASE_KEY)
    })
    console.log(JSON.stringify(data,null,2))
  }
}

exports.handler = (event, context, callback) => {
  const campaignQuery = sql(`
    SELECT
      campaign_id,
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
