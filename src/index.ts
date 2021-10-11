import { Router } from 'itty-router'
import { RDSDataClient } from '@aws-sdk/client-rds-data'

import { AWS_OPTS, sql } from 'db'

const router = Router()

router.get('/', async () => {
  const client = new RDSDataClient(AWS_OPTS)
  const call = sql(`SELECT * FROM impact`)
  const results = await client.send(call)
  return new Response(JSON.stringify(results))
})

router.all('*', () => new Response('404 Not Found', { status: 404 }))

addEventListener('fetch', e => {
  e.respondWith(router.handle(e.request))
})
