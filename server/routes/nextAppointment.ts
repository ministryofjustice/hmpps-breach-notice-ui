import { Response, Router } from 'express'
import AuditService, { Page } from '../services/auditService'
import BreachNoticeApiClient, { BreachNotice, ErrorMessages } from '../data/breachNoticeApiClient'
import { HmppsAuthClient } from '../data'
import CommonUtils from '../services/commonUtils'

export default function nextAppointmentRoutes(
  router: Router,
  auditService: AuditService,
  hmppsAuthClient: HmppsAuthClient,
  commonUtils: CommonUtils,
): Router {
  const currentPage = 'next-appointment'

  router.get('/next-appointment/:id', async (req, res, next) => {
    await auditService.logPageView(Page.NEXT_APPOINTMENT, { who: res.locals.user.username, correlationId: req.id })
    const breachNoticeApiClient = new BreachNoticeApiClient(
      await hmppsAuthClient.getSystemClientToken(res.locals.user.username),
    )
    const breachNoticeId = req.params.id
    let breachNotice: BreachNotice = null
    breachNotice = await breachNoticeApiClient.getBreachNoticeById(breachNoticeId as string)

    const redirect = await commonUtils.redirectOnStatusChange(breachNotice, res)
    if (redirect) {
      return
    }

    renderNextAppointment(breachNotice, res, {})
  })

  router.post('/next-appointment/:id', async (req, res, next) => {
    const breachNoticeApiClient = new BreachNoticeApiClient(
      await hmppsAuthClient.getSystemClientToken(res.locals.user.username),
    )
    await auditService.logPageView(Page.NEXT_APPOINTMENT, { who: res.locals.user.username, correlationId: req.id })
    const breachNoticeId = req.params.id
    let breachNotice: BreachNotice = null
    breachNotice = await breachNoticeApiClient.getBreachNoticeById(breachNoticeId as string)

    const redirect = await commonUtils.redirectOnStatusChange(breachNotice, res)
    if (redirect) {
      return
    }

    // TODO Post Logic

    if (req.body.action === 'viewDraft') {
      try {
        await showDraftPdf(breachNotice.id, res)
      } catch (err) {
        const errorMessages: ErrorMessages = {}
        errorMessages.pdfRenderError = {
          text: 'There was an issue generating the draft report. Please try again or contact support.',
        }
        renderNextAppointment(breachNotice, res, errorMessages)
      }
    } else {
      res.redirect(`/check-your-report/${req.params.id}`)
    }
  })

  async function renderNextAppointment(breachNotice: BreachNotice, res: Response, errorMessages: ErrorMessages) {
    res.render('pages/next-appointment', {
      errorMessages,
      breachNotice,
      currentPage,
    })
  }

  async function showDraftPdf(id: string, res: Response) {
    res.redirect(`/pdf/${id}`)
  }
  return router
}
