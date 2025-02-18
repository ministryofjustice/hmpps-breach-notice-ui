import { type RequestHandler, Router } from 'express'
import asyncMiddleware from '../middleware/asyncMiddleware'
import type { Services } from '../services'
import basicDetailsRoutes from './basicDetails'
import checkYourReportRoutes from './checkYourReport'
import nextAppointmentRoutes from './nextAppointment'
import pdfMaintenanceRoutes from './pdfMaintenance'
import reportCompletedRoutes from './reportCompleted'
import reportDeletedRoutes from './reportDeleted'
import warningDetailsRoutes from './warningDetails'
import warningTypeRoutes from './warningType'

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export default function routes({ auditService, hmppsAuthClient, snsService, commonUtils }: Services): Router {
  const router = Router()
  const get = (path: string | string[], handler: RequestHandler) => router.get(path, asyncMiddleware(handler))

  get('/', async (req, res, next) => {
    res.render('pages/error')
  })

  get('/breach-notice/:id', async (req, res, next) => {
    res.redirect(`/basic-details/${req.params.id}`)
  })

  basicDetailsRoutes(router, auditService, hmppsAuthClient, commonUtils)
  checkYourReportRoutes(router, auditService, hmppsAuthClient, snsService, commonUtils)
  nextAppointmentRoutes(router, auditService, hmppsAuthClient, commonUtils)
  pdfMaintenanceRoutes(router, auditService, hmppsAuthClient)
  reportCompletedRoutes(router, auditService, hmppsAuthClient)
  reportDeletedRoutes(router, auditService, hmppsAuthClient)
  warningDetailsRoutes(router, auditService, hmppsAuthClient, commonUtils)
  warningTypeRoutes(router, auditService, hmppsAuthClient, commonUtils)

  return router
}
