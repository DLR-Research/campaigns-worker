const AWS = require('aws-sdk')
const https = require('https')
const rdsDataService = new AWS.RDSDataService()

const COMMIT_PARAMS = {
  secretArn: process.env.SECRET_ARN,
  resourceArn: process.env.RDS_ARN,
}

const TX_PARAMS = {
  ...COMMIT_PARAMS,
  database: 'campaigns',
}

const sql = (query, transactionId) => ({
  ...TX_PARAMS,
  transactionId,
  sql: query,
})

const runSql = (theSql, transactionId) => {
  return new Promise((resolve, reject) => {
    rdsDataService.executeStatement(sql(theSql, transactionId), (err, data) => {
      if (err) {
        console.log('error with the following query:')
        console.log(sql(theSql, transactionId))
        reject(err)
      } else {
        resolve(data)
      }
    })
  })
}

function apiGet(apiUrl, headers) {
  return new Promise((resolve, reject) => {
    const req = https.get(apiUrl, { headers }, (res) => {
      // reject on bad status
      if (res.statusCode < 200 || res.statusCode >= 300) {
        console.log('http error code')
        console.log(apiUrl)
        console.log(headers)
        return reject(new Error('statusCode=' + res.statusCode))
      }
      // cumulate data
      var body = []
      res.on('data', function (chunk) {
        body.push(chunk)
      })
      // resolve on end
      res.on('end', function () {
        try {
          body = JSON.parse(Buffer.concat(body).toString())
        } catch (e) {
          reject(e)
        }
        resolve(body)
      })
    })
    // reject on request error
    req.on('error', function (err) {
      // This is not a "Second reject", just a different sort of failure
      console.log('https request error')
      console.log(apiUrl)
      console.log(headers)
      reject(err)
    })
    // IMPORTANT
    req.end()
  })
}

const beginTransaction = () => {
  return new Promise((resolve, reject) => {
    rdsDataService.beginTransaction(TX_PARAMS, (err, data) => {
      if (err) {
        console.log('error beginning transaction with the following params:')
        console.log(TX_PARAMS)
        reject(err)
      } else {
        resolve(data)
      }
    })
  })
}

const commitTransaction = (transactionId) => {
  return new Promise((resolve, reject) => {
    rdsDataService.commitTransaction(
      { ...COMMIT_PARAMS, transactionId },
      (err, data) => {
        if (err) {
          console.log('error committing with the following params:')
          console.log({ ...TX_PARAMS, transactionId })
          reject(err)
        } else {
          resolve(data)
        }
      }
    )
  })
}

const rollbackTransaction = (transactionId) => {
  return new Promise((resolve, reject) => {
    rdsDataService.rollbackTransaction(
      { ...COMMIT_PARAMS, transactionId },
      (err, data) => {
        if (err) {
          console.log('error rolling back with the following params:')
          console.log({ ...TX_PARAMS, transactionId })
          reject(err)
        } else {
          resolve(data)
        }
      }
    )
  })
}

const processStripeEvents = /* async */ (
  transactionId,
  campaignId,
  eventsList
) => {
  try {
    const promises = []
    eventsList.reverse().forEach((event) => {
      const prev = event.data.previous_attributes
      const cur = event.data.object
      const capturedDelta =
        prev == null
          ? cur.amount_captured
          : prev.amount_captured == null
          ? 0
          : cur.amount_captured - prev.amount_captured
      const refundedDelta =
        prev == null
          ? cur.amount_refunded
          : prev.amount_refunded == null
          ? 0
          : cur.amount_refunded - prev.amount_refunded
      const netDelta = capturedDelta - refundedDelta
      const { name, email } = event.data.object.billing_details
      promises.push(
        runSql(
          `WITH this_user AS (
            INSERT INTO users (name, email) VALUES ('${name}', '${email}')
            ON CONFLICT(email) DO UPDATE SET name = '${name}'
            RETURNING user_id
          )
          INSERT INTO impact (campaign_id, user_id, total_donated, total_referred)
          SELECT ${campaignId}, user_id, ${netDelta}, 0 FROM this_user
          ON CONFLICT(user_id, campaign_id) DO UPDATE SET total_donated = impact.total_donated + (${netDelta})`,
          transactionId
        )
      )
    })
    return Promise.all(promises)
  } catch (e) {
    console.log("Couldn't parse Stripe charge object")
    return Promise.reject(e)
  }
}

const updateFromStripe = async (transactionId, campaignId, data, nextUri) => {
  try {
    const nextUri = `https://api.stripe.com/v1/events?types%5B0%5D=charge.refunded&types%5B1%5D=charge.succeeded&limit=100&ending_before=${data[0].id}`
    const promises = [
      processStripeEvents(transactionId, campaignId, data),
      runSql(
        `UPDATE campaigns SET stripe_endpoint = '${nextUri}' WHERE campaign_id = ${campaignId}`,
        transactionId
      ),
    ]
    await Promise.all(promises)
    await commitTransaction(transactionId)
  } catch (e) {
    console.log("Couldn't update impact from Stripe")
    await rollbackTransaction(transactionId)
    throw e
  }
}

const handleStripe = async (campaignId, url, apiKey) => {
  try {
    const authHeader = 'Basic ' + Buffer.from(apiKey + ':').toString('base64')
    const { data } = await apiGet(url, { Authorization: authHeader })
    if (data.length > 0) {
      const { transactionId } = await beginTransaction()
      await updateFromStripe(transactionId, campaignId, data)
    }
  } catch (e) {
    console.log("Couldn't handle Stripe")
    throw e
  }
}

const processCoinbaseEvents = (campaignId, eventsList) => {
  eventsList.forEach(({ type, data }) => {
    if (type == 'charge:confirmed') {
      let paidAmt = 0
      data.payments.forEach((payment) => {
        paidAmt += Number(payment.net.local.amount)
      })
      const { name, email, custom: referrer } = data.metadata
      console.log(`${name} (${email}) gave ${paidAmt} referred by ${referrer}`)
    }
  })
}

const handleCoinbase = async (campaignId, url, apiKey) => {
  try {
    const body = await apiGet(url, {
      'X-CC-Api-Key': apiKey,
      'X-CC-Version': '2018-03-22',
    })
    const nextUri = body.pagination.next_uri
    console.log(nextUri)
    processCoinbaseEvents(campaignId, body.data)
  } catch (e) {
    return Promise.reject(e)
  }
}

exports.handler = async (event, context, callback) => {
  const { records } = await runSql(`
    SELECT
      campaign_id,
      stripe_endpoint,
      stripe_api_key,
      coinbase_endpoint,
      coinbase_api_key
    FROM campaigns
  `)

  const promises = []
  records.forEach((record) => {
    const campaignId = record[0].longValue
    const stripeUrl = record[1].stringValue
    const stripeKey = record[2].stringValue
    const coinbaseUrl = record[3].stringValue
    const coinbaseKey = record[4].stringValue
    promises.push(handleStripe(campaignId, stripeUrl, stripeKey))
    promises.push(handleCoinbase(campaignId, coinbaseUrl, coinbaseKey))
  })
  await Promise.all(promises)
}

