import { sql, db_client } from './db'

interface GetStatsParams {
  campaignId: string
  userId: string
}

export const getStats = async ({ params }: { params: GetStatsParams }) => {
  const client = db_client()
  const { campaignId, userId } = params
  if (!Number.isInteger(Number(campaignId))) {
    return new Response(`Invalid campaign ID ${campaignId}`, { status: 400 })
  }
  if (!Number.isInteger(Number(userId))) {
    return new Response(`Invalid user ID ${userId}`, { status: 400 })
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
    const response = new Response(JSON.stringify(resp), {
      headers: {
        'content-type': 'application/json;charset=UTF-8'
      }
    })
    response.headers.set("Access-Control-Allow-Origin", 'http://localhost:8080')
    response.headers.append("Vary", "Origin")
    return response
  } else {
    return new Response('Not Found', { status: 404 })
  }
}

interface IndexStatsParams {
  campaignId: string
  limit?: string
  offset?: string
}

const parseNumberInRange = (description: string, str: string | null, min: number, max: number, defaultVal: number) => {
  const parsed = Number(str)
  const res = !str || isNaN(parsed) ? defaultVal : parsed
  if (res > max) {
    throw(`${description} ${res} greater than max allowed (${max})`)
  }
  if (res < min) {
    throw(`${description} ${res} less than min allowed (${min})`)
  }
  return res
}

export const indexStats = async ({ params, url }: { params: IndexStatsParams; url: string }) => {
  const client = db_client()
  const campaignId = Number(params.campaignId)
  if (!Number.isInteger(campaignId) || campaignId < 0) {
    return new Response(`Invalid campaign ID ${campaignId}`, { status: 400 })
  }

  const { searchParams } = new URL(url)
  const filter = searchParams.get('filter')

  let limit, offset
  try {
    limit = parseNumberInRange('Limit', searchParams.get('limit'), 1, 100, 10)
    offset = parseNumberInRange('Offset', searchParams.get('offset'), 0, Infinity, 0)
  } catch (e) {
    return new Response(e as string, { status: 400 })
  }

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
    ORDER BY total_donated DESC
    LIMIT ${limit} OFFSET ${offset}
  `)
  const { records } = await client.send(call)

  if (records) {
    const resp = records.map((record: any) => ({
      user_id: record[0].longValue,
      email: record[1].stringValue,
      name: record[2].stringValue,
      eth_address: record[3].stringValue,
      total_donated: Number(record[4].stringValue),
      total_referred: Number(record[5].stringValue)
    }))
    const response = new Response(JSON.stringify(resp), {
      headers: {
        'content-type': 'application/json;charset=UTF-8'
      }
    })
    response.headers.set("Access-Control-Allow-Origin", 'http://localhost:8080')
    response.headers.append("Vary", "Origin")
    return response
  } else {
    return new Response('Error fetching from DB', { status: 500 })
  }
}
