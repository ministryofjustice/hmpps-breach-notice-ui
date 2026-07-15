import { Router } from 'express'
import { AuthenticationClient } from '@ministryofjustice/hmpps-auth-clients'
import AuditService, { Page } from '../services/auditService'
import BreachNoticeApiClient from '../data/breachNoticeApiClient'

export default function reportCompletedRoutes(
  router: Router,
  auditService: AuditService,
  authenticationClient: AuthenticationClient,
): Router {
  router.get('/report-completed/:id', async (req, res) => {
    await auditService.logPageView(Page.REPORT_COMPLETED, { who: res.locals.user.username, correlationId: req.id })
    const breachNoticeApiClient = new BreachNoticeApiClient(authenticationClient)
    const { id } = req.params
    const breachNotice = await breachNoticeApiClient.getBreachNoticeById(id as string, res.locals.user.username)
    res.render('pages/report-completed', {
      breachNotice,
    })
  })
  return router
}
