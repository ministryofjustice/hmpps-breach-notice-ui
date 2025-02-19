import { Router } from 'express'
import AuditService, { Page } from '../services/auditService'

export default function warningTypeRoutes(router: Router, auditService: AuditService): Router {
  router.get('/warning-type/:id', async (req, res, next) => {
    await auditService.logPageView(Page.WARNING_TYPE, { who: res.locals.user.username, correlationId: req.id })
    res.render('pages/warning-type')
  })
  return router
}
