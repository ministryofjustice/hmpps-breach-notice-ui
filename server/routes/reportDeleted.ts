import { Router } from 'express'
import AuditService, { Page } from '../services/auditService'
import BreachNoticeApiClient from '../data/breachNoticeApiClient'
import { HmppsAuthClient } from '../data'

export default function reportDeletedRoutes(
  router: Router,
  auditService: AuditService,
  hmppsAuthClient: HmppsAuthClient,
): Router {
  router.get('/report-deleted/:id', async (req, res, next) => {
    await auditService.logPageView(Page.REPORT_DELETED, { who: res.locals.user.username, correlationId: req.id })
    const breachNoticeApiClient = new BreachNoticeApiClient(
      await hmppsAuthClient.getSystemClientToken(res.locals.user.username),
    )
    const breachNoticeId = req.params.id
    const breachNotice = await breachNoticeApiClient.getBreachNoticeById(breachNoticeId as string)
    await breachNoticeApiClient.deleteBreachNotice(breachNoticeId as string)
    // Add Delete from ND
    // Add Delete from Alfresco
    res.render('pages/report-deleted', {
      breachNotice,
    })
  })
  return router
}
