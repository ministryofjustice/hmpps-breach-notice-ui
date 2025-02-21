import { type RequestHandler, Router } from 'express'
import asyncMiddleware from '../middleware/asyncMiddleware'
import type { Services } from '../services'
import basicDetailsRoutes from './basicDetails'
import warningTypeRoutes from './warningType'
import checkYourReportRoutes from './checkYourReport'
import pdfMaintenanceRoutes from './pdfMaintenance'
import reportDeletedRoutes from './reportDeleted'
import reportCompletedRoutes from './reportCompleted'
import nextAppointmentRoutes from './nextAppointment'

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export default function routes({ auditService, hmppsAuthClient, snsService, commonUtils }: Services): Router {
  const router = Router()
  const get = (path: string | string[], handler: RequestHandler) => router.get(path, asyncMiddleware(handler))

  get('/', async (req, res, next) => {
    res.render('pages/index')
  })

  get('/breach-notice/:id', async (req, res, next) => {
    res.redirect(`/basic-details/${req.params.id}`)
  })

  get('/close', async (req, res, next) => {
    res.send(`<script nonce="${res.locals.cspNonce}">window.close()</script>`)
  })

  basicDetailsRoutes(router, auditService, hmppsAuthClient, commonUtils)
  warningTypeRoutes(router, auditService)
  checkYourReportRoutes(router, auditService, hmppsAuthClient, snsService, commonUtils)
  pdfMaintenanceRoutes(router, auditService, hmppsAuthClient)
  reportDeletedRoutes(router, auditService)
  reportCompletedRoutes(router, auditService, hmppsAuthClient)
  nextAppointmentRoutes(router, auditService, hmppsAuthClient, commonUtils)
  return router
}
