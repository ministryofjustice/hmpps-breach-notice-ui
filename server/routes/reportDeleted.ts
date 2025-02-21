import { Router } from 'express'
import AuditService, { Page } from '../services/auditService'

export default function reportDeletedRoutes(router: Router, auditService: AuditService): Router {
  router.get('/report-deleted/:id', async (req, res, next) => {
    await auditService.logPageView(Page.WARNING_TYPE, { who: res.locals.user.username, correlationId: req.id })
    res.render('pages/report-deleted')
  })
  return router
}
