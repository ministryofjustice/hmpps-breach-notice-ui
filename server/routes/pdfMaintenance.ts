import { type RequestHandler, Router } from 'express'
import AuditService, { Page } from '../services/auditService'
import BreachNoticeApiClient from '../data/breachNoticeApiClient'
import { HmppsAuthClient } from '../data'
import asyncMiddleware from '../middleware/asyncMiddleware'
import CommonUtils from '../services/commonUtils'

export default function pdfMaintenanceRoutes(
  router: Router,
  auditService: AuditService,
  hmppsAuthClient: HmppsAuthClient,
  commonUtils: CommonUtils,
): Router {
  const get = (path: string | string[], handler: RequestHandler) => router.get(path, asyncMiddleware(handler))

  get('/pdf/:id', async (req, res, next) => {
    await auditService.logPageView(Page.REPORT_DELETED, { who: res.locals.user.username, correlationId: req.id })
    const breachNoticeApiClient = new BreachNoticeApiClient(
      await hmppsAuthClient.getSystemClientToken(res.locals.user.username),
    )
    const { id } = req.params
    const breachNotice = await breachNoticeApiClient.getBreachNoticeById(id as string)

    if (await commonUtils.redirectRequired(breachNotice, res)) return

    const stream: ArrayBuffer = await breachNoticeApiClient.getDraftPdfById(id as string)

    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader(
      'Content-Disposition',
      `filename="breach_notice_${breachNotice.crn}_${breachNotice.referenceNumber}_draft.pdf"`,
    )
    res.send(stream)
  })

  return router
}
