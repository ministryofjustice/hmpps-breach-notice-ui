import { Router } from 'express'
import AuditService, { Page } from '../services/auditService'
import BreachNoticeApiClient, { BreachNotice } from '../data/breachNoticeApiClient'
import { HmppsAuthClient } from '../data'

export default function reportCompletedRoutes(
  router: Router,
  auditService: AuditService,
  hmppsAuthClient: HmppsAuthClient,
): Router {
  router.get('/report-completed/:id', async (req, res, next) => {
    await auditService.logPageView(Page.REPORT_COMPLETED, { who: res.locals.user.username, correlationId: req.id })
    const breachNoticeApiClient = new BreachNoticeApiClient(
      await hmppsAuthClient.getSystemClientToken(res.locals.user.username),
    )
    const breachNoticeId = req.params.id
    let breachNotice: BreachNotice = null
    breachNotice = await breachNoticeApiClient.getBreachNoticeById(breachNoticeId as string)
    res.render('pages/report-completed', {
      breachNotice,
    })
  })

  router.get('/report-completed', async (req, res, next) => {
    await auditService.logPageView(Page.REPORT_COMPLETED, { who: res.locals.user.username, correlationId: req.id })
    const breachNoticeApiClient = new BreachNoticeApiClient(
      await hmppsAuthClient.getSystemClientToken(res.locals.user.username),
    )
    // const breachNoticeId = req.params.id
    const breachNoticeId = '91992e76-54bc-4530-8775-fd8031d982c0'
    const stream: ArrayBuffer = await breachNoticeApiClient.getPdfById(breachNoticeId as string)

    await auditService.logPageView(Page.REPORT_DELETED, {
      who: res.locals.user.username,
      correlationId: req.id,
      details: stream,
    })

    let breachNotice: BreachNotice = null
    breachNotice = await breachNoticeApiClient.getBreachNoticeById(breachNoticeId as string)
    res.render('pages/report-completed', {
      breachNotice,
    })
  })

  return router
}
