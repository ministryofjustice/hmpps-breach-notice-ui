import { Router } from 'express'
import { AuthenticationClient } from '@ministryofjustice/hmpps-auth-clients'
import AuditService, { Page } from '../services/auditService'
import BreachNoticeApiClient from '../data/breachNoticeApiClient'
import CommonUtils from '../services/commonUtils'

export default function pdfMaintenanceRoutes(
  router: Router,
  auditService: AuditService,
  authenticationClient: AuthenticationClient,
  commonUtils: CommonUtils,
): Router {
  router.get('/pdf/:id', async (req, res) => {
    await auditService.logPageView(Page.REPORT_DELETED, { who: res.locals.user.username, correlationId: req.id })
    const breachNoticeApiClient = new BreachNoticeApiClient(authenticationClient)
    const { id } = req.params
    const breachNotice = await breachNoticeApiClient.getBreachNoticeById(id as string, res.locals.user.username)

    if (await commonUtils.redirectRequiredForLao(breachNotice, res)) return

    const stream: ArrayBuffer = await breachNoticeApiClient.getDraftPdfById(id as string, res.locals.user.username)

    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader(
      'Content-Disposition',
      `filename="breach_notice_${breachNotice.crn}_${breachNotice.referenceNumber}_draft.pdf"`,
    )
    res.send(stream)
  })

  return router
}
