import { Router } from 'express'
import AuditService, { Page } from '../services/auditService'

export default function warningDetailsRoutes(router: Router, auditService: AuditService): Router {
  router.get('/warning-details/:id', async (req, res, next) => {
    await auditService.logPageView(Page.WARNING_DETAILS, { who: res.locals.user.username, correlationId: req.id })
    res.render(`pages/warning-details`)
  })
  return router
}
