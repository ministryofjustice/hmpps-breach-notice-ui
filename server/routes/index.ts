import { type RequestHandler, Router } from 'express'
import asyncMiddleware from '../middleware/asyncMiddleware'
import type { Services } from '../services'
import basicDetailsRoutes from './basicDetails'
import warningTypeRoutes from './warningType'

export default function routes({ auditService, hmppsAuthClient }: Services): Router {
  const router = Router()
  const get = (path: string | string[], handler: RequestHandler) => router.get(path, asyncMiddleware(handler))

  get('/', async (req, res, next) => {
    res.render('pages/index')
  })

  get('/breach-notice/:id', async (req, res, next) => {
    res.redirect(`/basic-details/${req.params.id}`)
  })

  basicDetailsRoutes(router, auditService, hmppsAuthClient)
  warningTypeRoutes(router, auditService, hmppsAuthClient)
  return router
}
