import { Router } from 'express'

import type { Services } from '../services'
import basicDetailsRoutes from './basicDetails'
import warningTypeRoutes from './warningType'
import checkYourReportRoutes from './checkYourReport'
import pdfMaintenanceRoutes from './pdfMaintenance'
import reportDeletedRoutes from './reportDeleted'
import reportCompletedRoutes from './reportCompleted'
import warningDetailsRoutes from './warningDetails'
import nextAppointmentRoutes from './nextAppointment'
import addAddressRoutes from './addAddress'

export default function routes({ auditService, hmppsAuthClient, commonUtils }: Services): Router {
  const router = Router()

  router.get('/', async (req, res, next) => {
    res.render('pages/index')
  })

  router.get('/breach-notice/:id', async (req, res, next) => {
    res.redirect(`/basic-details/${req.params.id}`)
  })

  router.get('/close', async (req, res, next) => {
    res.send(
      `<p>You can now safely close this window</p><script nonce="${res.locals.cspNonce}">window.close()</script>`,
    )
  })

  basicDetailsRoutes(router, auditService, hmppsAuthClient, commonUtils)
  warningTypeRoutes(router, auditService, hmppsAuthClient, commonUtils)
  warningDetailsRoutes(router, auditService, hmppsAuthClient, commonUtils)
  checkYourReportRoutes(router, auditService, hmppsAuthClient, commonUtils)
  pdfMaintenanceRoutes(router, auditService, hmppsAuthClient, commonUtils)
  reportDeletedRoutes(router, auditService, hmppsAuthClient)
  reportCompletedRoutes(router, auditService, hmppsAuthClient)
  nextAppointmentRoutes(router, auditService, hmppsAuthClient, commonUtils)
  addAddressRoutes(router, auditService)
  return router
}
