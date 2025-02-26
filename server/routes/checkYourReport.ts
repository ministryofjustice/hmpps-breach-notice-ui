import { type RequestHandler, Response, Router } from 'express'
import AuditService, { Page } from '../services/auditService'
import BreachNoticeApiClient, { BreachNotice, ErrorMessages } from '../data/breachNoticeApiClient'
import { HmppsAuthClient } from '../data'
import SnsService from '../services/snsService'
import CommonUtils from '../services/commonUtils'
import { HmppsDomainEvent } from '../data/hmppsSnsClient'
import config from '../config'
import { toUserDate, toUserDateFromDateTime, toUserTimeFromDateTime } from '../utils/dateUtils'
import asyncMiddleware from '../middleware/asyncMiddleware'

export default function checkYourReportRoutes(
  router: Router,
  auditService: AuditService,
  hmppsAuthClient: HmppsAuthClient,
  snsService: SnsService,
  commonUtils: CommonUtils,
): Router {
  const get = (path: string | string[], handler: RequestHandler) => router.get(path, asyncMiddleware(handler))
  const post = (path: string | string[], handler: RequestHandler) => router.post(path, asyncMiddleware(handler))
  get('/check-your-report/:id', async (req, res, next) => {
    await auditService.logPageView(Page.CHECK_YOUR_REPORT, { who: res.locals.user.username, correlationId: req.id })
    const breachNoticeApiClient = new BreachNoticeApiClient(
      await hmppsAuthClient.getSystemClientToken(res.locals.user.username),
    )
    const { id } = req.params
    const breachNotice = await breachNoticeApiClient.getBreachNoticeById(id as string)

    if (await commonUtils.redirectRequired(breachNotice, res)) return

    breachNotice.breachNoticeContactList?.forEach(it => {
      const contact = it
      contact.contactDateString = toUserDateFromDateTime(it.contactDate)
      contact.contactTimeString = toUserTimeFromDateTime(it.contactDate)
    })

    const basicDetailsDateOfLetter: string = toUserDate(breachNotice.dateOfLetter)
    const responseRequiredByDate: string = toUserDate(breachNotice.responseRequiredDate)
    const nextAppointmentDate: string = toUserDateFromDateTime(breachNotice.nextAppointmentDate)
    const nextAppointmentTime: string = toUserTimeFromDateTime(breachNotice.nextAppointmentDate)

    await renderCheckYourReport(
      breachNotice,
      res,
      {},
      basicDetailsDateOfLetter,
      responseRequiredByDate,
      nextAppointmentDate,
      nextAppointmentTime,
    )
  })

  async function renderCheckYourReport(
    breachNotice: BreachNotice,
    res: Response,
    errorMessages: ErrorMessages,
    dateOfLetter: string,
    responseRequiredByDate: string,
    nextAppointmentDate: string,
    nextAppointmentTime: string,
  ) {
    const reportValidated = validateCheckYourReport(breachNotice)
    const currentPage = 'check-your-report'
    res.render('pages/check-your-report', {
      errorMessages,
      breachNotice,
      dateOfLetter,
      responseRequiredByDate,
      nextAppointmentDate,
      nextAppointmentTime,
      reportValidated,
      currentPage,
    })
  }

  post('/check-your-report/:id', async (req, res, next) => {
    await auditService.logPageView(Page.CHECK_YOUR_REPORT, { who: res.locals.user.username, correlationId: req.id })
    const breachNoticeApiClient = new BreachNoticeApiClient(
      await hmppsAuthClient.getSystemClientToken(res.locals.user.username),
    )
    const { id } = req.params
    const breachNotice = await breachNoticeApiClient.getBreachNoticeById(id as string)

    if (await commonUtils.redirectRequired(breachNotice, res)) return

    breachNotice.completedDate = new Date()
    await breachNoticeApiClient.updateBreachNotice(id, breachNotice)

    const baseUrl: string = config.apis.breachNotice.url
    const event: HmppsDomainEvent = {
      eventType: 'probation-case.breach-notice.created',
      version: 1,
      description: 'A breach notice has been completed for a person on probation',
      detailUrl: `${baseUrl}/pdf/${breachNotice.id}`,
      occurredAt: new Date().toISOString(),
      additionalInformation: {
        breachNoticeId: `${breachNotice.id}`,
      },
      personReference: {
        identifiers: [
          {
            type: 'CRN',
            value: `${breachNotice.crn}`,
          },
        ],
      },
    }

    snsService.sendMessage(event)

    res.redirect(`/report-completed/${req.params.id}`)
  })

  function validateCheckYourReport(breachNotice: BreachNotice): boolean {
    if (
      breachNotice.crn != null &&
      breachNotice.titleAndFullName != null &&
      breachNotice.offenderAddress != null &&
      breachNotice.dateOfLetter != null &&
      breachNotice.replyAddress != null &&
      breachNotice.breachNoticeTypeDescription != null &&
      breachNotice.breachSentenceTypeDescription &&
      breachNotice.breachNoticeContactList != null &&
      breachNotice.breachNoticeContactList.length > 0 &&
      breachNotice.breachNoticeRequirementList != null &&
      breachNotice.breachNoticeRequirementList.length > 0 &&
      breachNotice.responseRequiredDate != null &&
      breachNotice.nextAppointmentType != null &&
      breachNotice.nextAppointmentDate != null &&
      breachNotice.nextAppointmentLocation != null &&
      breachNotice.nextAppointmentOfficer != null &&
      breachNotice.responsibleOfficer != null
    ) {
      return true
    }
    return false
  }

  return router
}
