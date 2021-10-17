const AWS = require('aws-sdk')
const https = require('https')
const rdsDataService = new AWS.RDSDataService()

// require('dotenv').config()
// const rdsDataService = new AWS.RDSDataService({
//     region: process.env.AWS_REGION,
//     credentials: {
//       accessKeyId: process.env.AWS_ACCESS_KEY_ID,
//       secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
//     }
// })

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

const NOOP = Promise.resolve(null)

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

const upsertDonation = async (subq, transactionId, campaignId, amount) => runSql(
  `WITH this_user AS (${subq})
    INSERT INTO impact (campaign_id, user_id, total_donated, total_referred)
    SELECT ${campaignId}, user_id, ${amount}, 0 FROM this_user
    ON CONFLICT(user_id, campaign_id) DO UPDATE SET total_donated = impact.total_donated + (${amount})`,
  transactionId
)

const upsertReferral = (subq, transactionId, campaignId, amount) =>
  runSql(
    `WITH this_user AS (${subq})
      INSERT INTO impact (campaign_id, user_id, total_donated, total_referred)
      SELECT ${campaignId}, user_id, 0, ${amount} FROM this_user
      ON CONFLICT(user_id, campaign_id) DO UPDATE SET total_referred = impact.total_referred + (${amount})`,
    transactionId
  )

const updateReferral = (userId, transactionId, campaignId, amount) =>
  runSql(
    `UPDATE impact
      SET total_referred = total_referred + (${amount})
      WHERE user_id = ${userId} AND campaign_id = ${campaignId}`,
    transactionId
  )

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

const processStripeEvents = async (
  transactionId,
  campaignId,
  eventsList
) => {
  try {
    let totalDelta = 0
    const emailToPromise = {}
    const emailPromises = []
    const NOOP = Promise.resolve(null)
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
      totalDelta += netDelta
      const { name, email } = event.data.object.billing_details
      const donationPromise = (emailToPromise[email] || NOOP).then(() => upsertDonation(
        `INSERT INTO users (name, email) VALUES ('${name}', '${email}')
          ON CONFLICT(email) DO UPDATE SET name = '${name}'
          RETURNING user_id`,
        transactionId,
        campaignId,
        netDelta
      ))
      emailToPromise[email] = donationPromise
      emailPromises.push(donationPromise)
    })
    await Promise.all(emailPromises)
    return totalDelta
  } catch (e) {
    console.log("Couldn't parse Stripe charge object")
    throw(e)
  }
}

const updateFromStripe = async (transactionId, campaignId, data, nextUri) => {
  try {
    const nextUri = `https://api.stripe.com/v1/events?types%5B0%5D=charge.refunded&types%5B1%5D=charge.succeeded&limit=100&ending_before=${data[0].id}`
    const nextUriPromise = runSql(
      `UPDATE campaigns SET stripe_endpoint = '${nextUri}' WHERE campaign_id = ${campaignId}`,
      transactionId
    )
    const totalDelta = await processStripeEvents(transactionId, campaignId, data)
    await nextUriPromise
    await runSql(
      `UPDATE campaigns
      SET contribution_total = contribution_total + (${totalDelta})
      WHERE campaign_id = ${campaignId}`,
      transactionId
    )
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
      await commitTransaction(transactionId)
    }
  } catch (e) {
    console.log("Couldn't handle Stripe")
    throw e
  }
}

const processCoinbaseEvents = async (
  transactionId,
  campaignId,
  eventsList
) => {
  try {
    let totalDelta = 0
    const emailPromises = []
    const emailToPromise = {}
    const idPromises = []
    const idToPromise = {}
    const idToAmount = {}
    const NOOP = Promise.resolve(null)
    eventsList.forEach(({ type, data}) => {
      if (type == 'charge:confirmed') {
        let paidAmt = 0
        data.payments.forEach((payment) => {
          paidAmt += Number(payment.net.local.amount)
        })
        paidAmt *= 100
        totalDelta += paidAmt

        const { name, email, custom } = data.metadata
        let referrerEmail, referrerId
        if (custom?.startsWith('id:')) {
          referrerId = Number(custom.replace('id:', ''))
        } else if (custom) {
          referrerEmail = custom
        }

        const donationPromise = (emailToPromise[email] || NOOP).then(() => upsertDonation(
          `INSERT INTO users (name, email) VALUES ('${name}', '${email}')
            ON CONFLICT(email) DO UPDATE SET name = '${name}'
            RETURNING user_id`,
          transactionId,
          campaignId,
          paidAmt
        ))
        emailToPromise[email] = donationPromise
        emailPromises.push(donationPromise)
        if (referrerEmail) {
          const referralPromise = (emailToPromise[email] || NOOP).then(() => upsertReferral(
            `INSERT INTO users (email) VALUES ('${referrerEmail}')
              ON CONFLICT(email) DO UPDATE SET name = users.name
              RETURNING user_id`,
            transactionId,
            campaignId,
            paidAmt
          ))
          emailToPromise[email] = referralPromise
          emailPromises.push(referralPromise)
        }
        if (referrerId) {
          idToAmount[referrerId] = paidAmt
        }
      }
    })
    await Promise.all(emailPromises)
    Object.entries(idToAmount).forEach(([id, amount]) => {
      const referralPromise = (idToPromise[id] || NOOP).then(
        () => updateReferral(referrerId, transactionId, campaignId, paidAmt)
      )
      idToPromise[id] = referralPromise
      idPromises.push(referralPromise)
    })
    await Promise.all(idPromises)
    return totalDelta
  } catch (e) {
    console.log("Couldn't parse Coinbase Commerce charge object")
    throw(e)
  }
}

const updateFromCoinbase = async (transactionId, campaignId, body, nextUri) => {
  try {
    const nextUri = body.pagination.next_uri
    const nextUriPromise = nextUri
      ? runSql(
        `UPDATE campaigns SET coinbase_endpoint = '${nextUri}' WHERE campaign_id = ${campaignId}`,
        transactionId)
      : NOOP
    const totalDelta = await processCoinbaseEvents(transactionId, campaignId, body.data)
    await nextUriPromise
    await runSql(
      `UPDATE campaigns
      SET contribution_total = contribution_total + (${totalDelta})
      WHERE campaign_id = ${campaignId}`,
      transactionId
    )
  } catch (e) {
    console.log("Couldn't update impact from Coinbase Commerce")
    await rollbackTransaction(transactionId)
    throw e
  }
}

const handleCoinbase = async (campaignId, url, apiKey) => {
  try {
    const body = await apiGet(url, {
      'X-CC-Api-Key': apiKey,
      'X-CC-Version': '2018-03-22',
    })
    if (body.data.length > 0) {
      const { transactionId } = await beginTransaction()
      await updateFromCoinbase(transactionId, campaignId, body)
      await commitTransaction(transactionId)
    }
  } catch (e) {
    console.log("Couldn't handle Coinbase Commerce")
    throw e
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
  for (let i = 0; i < records.length; i++) {
    const record = records[i]
    const campaignId = record[0].longValue
    const stripeUrl = record[1].stringValue
    const stripeKey = record[2].stringValue
    const coinbaseUrl = record[3].stringValue
    const coinbaseKey = record[4].stringValue
    await handleStripe(campaignId, stripeUrl, stripeKey)
    await handleCoinbase(campaignId, coinbaseUrl, coinbaseKey)
  }
}

// exports.handler()
