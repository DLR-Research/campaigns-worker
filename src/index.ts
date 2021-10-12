import { Router } from 'itty-router'

import { getStats, indexStats } from 'stats'

const router = Router()

router.get('/campaigns/:campaignId/stats', indexStats)
router.get('/campaigns/:campaignId/stats/:userId', getStats)

router.all('*', () => new Response('404 Not Found', { status: 404 }))

addEventListener('fetch', e => {
  e.respondWith(router.handle(e.request))
})
