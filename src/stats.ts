import { sql, client } from 'db'

interface GetStatsParams {
  campaignId: string
  userId: string
}

export const getStats = async ({ params }: { params: GetStatsParams }) => {
  const { campaignId, userId } = params
  if (!Number.isInteger(Number(campaignId))) {
    return new Response('Invalid campaign ID', { status: 403 })
  }
  if (!Number.isInteger(Number(userId))) {
    return new Response('Invalid user ID', { status: 403 })
  }

  const statsCall = sql(`
    SELECT total_donated, total_referred
    FROM impact
    WHERE campaign_id = ${campaignId} AND user_id = ${userId}
  `)
  const statsRes = (await client.send(statsCall)).records
  const userCall = sql(`
    SELECT email, name, eth_address
    FROM users
    WHERE user_id = ${userId}
  `)
  const userRes = (await client.send(userCall)).records

  if (userRes?.length && statsRes?.length) {
    const user = userRes[0]
    const stats = statsRes[0]
    const resp = {
      user_id: Number(userId),
      email: user[0].stringValue,
      name: user[1].stringValue,
      eth_address: user[2].stringValue,
      total_donated: Number(stats[0].stringValue),
      total_referred: Number(stats[1].stringValue)
    }
    return new Response(JSON.stringify(resp), {
      headers: {
        'content-type': 'application/json;charset=UTF-8'
      }
    })
  } else {
    return new Response('Not Found', { status: 404 })
  }
}

interface IndexStatsParams {
  campaignId: string
}

export const indexStats = async ({ params, url }: { params: IndexStatsParams; url: string }) => {
  const { campaignId } = params
  if (!Number.isInteger(Number(campaignId))) {
    return new Response('Invalid campaign ID', { status: 403 })
  }
  const { searchParams } = new URL(url)
  const filter = searchParams.get('filter')

  const call = sql(`
    SELECT user_id, email, name, eth_address, total_donated, total_referred
    FROM impact INNER JOIN users USING(user_id)
    WHERE impact.campaign_id = ${campaignId}
    ${
      filter
        ? `AND (
          users.email ILIKE '%${filter}%'
          OR users.name ILIKE '%${filter}%'
          OR users.eth_address ILIKE '%${filter}%'
        )`
        : ''
    }
  `)
  const { records } = await client.send(call)

  if (records) {
    const resp = records.map((record: any) => ({
      user_id: Number(record[0].stringValue),
      email: record[1].stringValue,
      name: record[2].stringValue,
      eth_address: record[3].stringValue,
      total_donated: Number(record[4].stringValue),
      total_referred: Number(record[5].stringValue)
    }))
    return new Response(JSON.stringify(resp), {
      headers: {
        'content-type': 'application/json;charset=UTF-8'
      }
    })
  } else {
    return new Response('Error fetching from DB', { status: 500 })
  }
}
