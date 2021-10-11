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
    const { name, email } = event.data.object.billing_details
    console.log(`delta of ${netDelta} for ${name} (${email}) in campaign $ {campaignId}`)
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
              if (body.data.length > 0) {
                const nextUri = `https://api.stripe.com/v1/events?types%5B0%5D=charge.refunded&types%5B1%5D=charge.succeeded&limit=100&ending_before=${body.data[0].id}`
                console.log(nextUri)
              }
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

const processCoinbaseEvents = (campaignId, eventsList) => {
  eventsList.forEach(({ type, data }) => {
    if (type == 'charge:confirmed') {
      let paidAmt = 0
      data.payments.forEach(payment => {
        paidAmt += Number(payment.net.local.amount)
      })
      const { name, email, custom: referrer } = data.metadata
      console.log(`${name} (${email}) gave ${paidAmt} referred by ${referrer}`)
    }
  })
}

const handleCoinbase = (campaignId, url, apiKey) => {
  const req = https.get(
    url,
    { headers: { 'X-CC-Api-Key': apiKey, 'X-CC-Version': '2018-03-22' } },
    function(res) {
      var body = []
      res.on('data', function(chunk) {
          body.push(chunk)
      })
      res.on('end', function() {
          try {
              body = JSON.parse(Buffer.concat(body).toString())
              const nextUri = body.pagination.next_uri
              console.log(nextUri)
              processCoinbaseEvents(campaignId, body.data)
          } catch(e) {
              console.log("error parsing coinbase resp")
          }
      })
    }
  )
  req.on('error', (e) => {
    console.log('Error in Coinbase Commerce API call');
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
      const stripeUrl = record[1].stringValue
      const stripeKey = record[2].stringValue
      const coinbaseUrl = record[3].stringValue
      const coinbaseKey = record[4].stringValue
      handleStripe(campaignId, stripeUrl, stripeKey)
      handleCoinbase(campaignId, coinbaseUrl, coinbaseKey)
    })
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


