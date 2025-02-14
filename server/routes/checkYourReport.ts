import { Response, Router } from 'express'
import AuditService, { Page } from '../services/auditService'
import BreachNoticeApiClient, { BreachNotice, ErrorMessages } from '../data/breachNoticeApiClient'
import { HmppsAuthClient } from '../data'

export default function checkYourReportRoutes(
  router: Router,
  auditService: AuditService,
  hmppsAuthClient: HmppsAuthClient,
): Router {
  router.get('/check-your-report/:id', async (req, res, next) => {
    await auditService.logPageView(Page.CHECK_YOUR_REPORT, { who: res.locals.user.username, correlationId: req.id })
    const breachNoticeApiClient = new BreachNoticeApiClient(
      await hmppsAuthClient.getSystemClientToken(res.locals.user.username),
    )
    const breachNoticeId = req.params.id
    let breachNotice: BreachNotice = null
    breachNotice = await breachNoticeApiClient.getBreachNoticeById(breachNoticeId as string)

    await renderCheckYourReport(breachNotice, res, {})
  })

  async function renderCheckYourReport(breachNotice: BreachNotice, res: Response, errorMessages: ErrorMessages) {
    res.render('pages/check-your-report', {
      errorMessages,
      breachNotice,
    })
  }

  router.post('/check-your-report/:id', async (req, res, next) => {
    await auditService.logPageView(Page.CHECK_YOUR_REPORT, { who: res.locals.user.username, correlationId: req.id })
    const breachNoticeApiClient = new BreachNoticeApiClient(
      await hmppsAuthClient.getSystemClientToken(res.locals.user.username),
    )
    const breachNoticeId = req.params.id
    let breachNotice: BreachNotice = null
    breachNotice = await breachNoticeApiClient.getBreachNoticeById(breachNoticeId as string)

    // TODO Post Logic

    if (req.body.action === 'viewDraft') {
      try {
        await showDraftPdf(breachNotice.id, res)
      } catch (err) {
        const errorMessages: ErrorMessages = {}
        errorMessages.pdfRenderError = {
          text: 'There was an issue generating the draft report. Please try again or contact support.',
        }
        await renderCheckYourReport(breachNotice, res, errorMessages)
      }
    } else {
      // Correct redirect
      res.redirect(`/check-your-report/${req.params.id}`)
    }
  })

  async function showDraftPdf(id: string, res: Response) {
    res.redirect(`/pdf/${id}`)
  }
  return router
}
