import { Router } from 'express'
import AuditService, { Page } from '../services/auditService'
import { HmppsAuthClient } from '../data'

export default function reportCompletedRoutes(
  router: Router,
  auditService: AuditService,
  hmppsAuthClient: HmppsAuthClient,
): Router {
  router.get('/report-completed/:id', async (req, res, next) => {
    await auditService.logPageView(Page.REPORT_COMPLETED, { who: res.locals.user.username, correlationId: req.id })
    await hmppsAuthClient.getSystemClientToken(res.locals.user.username)
    res.render('pages/report-completed')
  })
  return router
}
