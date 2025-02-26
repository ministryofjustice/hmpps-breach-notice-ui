import { type RequestHandler, Router } from 'express'
import asyncMiddleware from '../middleware/asyncMiddleware'
import type { Services } from '../services'
import basicDetailsRoutes from './basicDetails'
import warningTypeRoutes from './warningType'
import checkYourReportRoutes from './checkYourReport'
import pdfMaintenanceRoutes from './pdfMaintenance'
import reportDeletedRoutes from './reportDeleted'
import reportCompletedRoutes from './reportCompleted'
import warningDetailsRoutes from './warningDetails'
import nextAppointmentRoutes from './nextAppointment'
import BreachNoticeApiClient from '../data/breachNoticeApiClient'

export default function routes({ auditService, hmppsAuthClient, snsService, commonUtils }: Services): Router {
  const router = Router()
  const get = (path: string | string[], handler: RequestHandler) => router.get(path, asyncMiddleware(handler))

  get('/', async (req, res, next) => {
    res.render('pages/index')
  })

  get('/breach-notice/:id', async (req, res, next) => {
    const breachNoticeApiClient = new BreachNoticeApiClient(
      await hmppsAuthClient.getSystemClientToken(res.locals.user.username),
    )
    const { id } = req.params
    const breachNotice = await breachNoticeApiClient.getBreachNoticeById(id as string)

    if (breachNotice.nextAppointmentSaved) {
      res.redirect(`/check-your-report/${req.params.id}`)
      return
    }
    if (breachNotice.warningDetailsSaved) {
      res.redirect(`/next-appointment/${req.params.id}`)
      return
    }
    if (breachNotice.warningTypeSaved) {
      res.redirect(`/warning-details/${req.params.id}`)
      return
    }
    if (breachNotice.basicDetailsSaved) {
      res.redirect(`/warning-type/${req.params.id}`)
      return
    }

    res.redirect(`/basic-details/${req.params.id}`)
  })

  get('/close', async (req, res, next) => {
    res.send(`<script nonce="${res.locals.cspNonce}">window.close()</script>`)
  })

  basicDetailsRoutes(router, auditService, hmppsAuthClient, commonUtils)
  warningTypeRoutes(router, auditService, hmppsAuthClient, commonUtils)
  warningDetailsRoutes(router, auditService)
  checkYourReportRoutes(router, auditService, hmppsAuthClient, snsService, commonUtils)
  pdfMaintenanceRoutes(router, auditService, hmppsAuthClient)
  reportDeletedRoutes(router, auditService, hmppsAuthClient)
  reportCompletedRoutes(router, auditService, hmppsAuthClient)
  nextAppointmentRoutes(router, auditService, hmppsAuthClient, commonUtils)
  return router
}
