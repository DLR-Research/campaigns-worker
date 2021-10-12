import { Router } from 'itty-router'

import { getStats, indexStats } from 'stats'

const router = Router()

router.get('/campaigns/:campaignId/stats', indexStats)
router.get('/campaigns/:campaignId/stats/:userId', getStats)

router.all('*', () => new Response('404 Not Found', { status: 404 }))

addEventListener('fetch', e => {
  const response = router.handle(e.request)
  response.headers.set("Access-Control-Allow-Origin", "https://localhost:8080")
  response.headers.append("Vary", "Origin")
  e.respondWith(response)
})
