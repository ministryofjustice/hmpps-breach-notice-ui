import { type RequestHandler, Router } from 'express'
import AuditService, { Page } from '../services/auditService'
import BreachNoticeApiClient from '../data/breachNoticeApiClient'
import asyncMiddleware from '../middleware/asyncMiddleware'
import { HmppsAuthClient } from '../data'

export default function reportDeletedRoutes(
  router: Router,
  auditService: AuditService,
  hmppsAuthClient: HmppsAuthClient,
): Router {
  const get = (path: string | string[], handler: RequestHandler) => router.get(path, asyncMiddleware(handler))
  get('/report-deleted/:id', async (req, res, next) => {
    await auditService.logPageView(Page.REPORT_DELETED, { who: res.locals.user.username, correlationId: req.id })
    const breachNoticeApiClient = new BreachNoticeApiClient(
      await hmppsAuthClient.getSystemClientToken(res.locals.user.username),
    )
    const { id } = req.params
    await breachNoticeApiClient.deleteBreachNotice(id as string)

    res.render('pages/report-deleted')
  })
  return router
}
