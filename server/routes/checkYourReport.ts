import { Response, Router } from 'express'
import { DateTimeFormatter } from '@js-joda/core'
import AuditService, { Page } from '../services/auditService'
import BreachNoticeApiClient, { BreachNotice, ErrorMessages } from '../data/breachNoticeApiClient'
import { HmppsAuthClient } from '../data'
import SnsService from '../services/snsService'
import CommonUtils from '../services/commonUtils'
import { HmppsDomainEvent } from '../data/hmppsSnsClient'

export default function checkYourReportRoutes(
  router: Router,
  auditService: AuditService,
  hmppsAuthClient: HmppsAuthClient,
  snsService: SnsService,
  commonUtils: CommonUtils,
): Router {
  router.get('/check-your-report/:id', async (req, res, next) => {
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
      contact.contactTimeString = toUserTime(it.contactDate)
    })

    const basicDetailsDateOfLetter: string = toUserDate(breachNotice.dateOfLetter)
    const responseRequiredByDate: string = toUserDate(breachNotice.responseRequiredByDate)
    const nextAppointmentDate: string = toUserDateFromDateTime(breachNotice.nextAppointmentDate)
    const nextAppointmentTime: string = toUserTime(breachNotice.nextAppointmentDate)

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

  router.post('/check-your-report/:id', async (req, res, next) => {
    await auditService.logPageView(Page.CHECK_YOUR_REPORT, { who: res.locals.user.username, correlationId: req.id })
    const breachNoticeApiClient = new BreachNoticeApiClient(
      await hmppsAuthClient.getSystemClientToken(res.locals.user.username),
    )
    const { id } = req.params
    const breachNotice = await breachNoticeApiClient.getBreachNoticeById(id as string)

    if (await commonUtils.redirectRequired(breachNotice, res)) return

    breachNotice.completedDate = new Date()
    await breachNoticeApiClient.updateBreachNotice(id, breachNotice)

    const event: HmppsDomainEvent = {
      eventType: 'probation-case.breach-notice.created',
      version: 1,
      description: 'A breach notice has been completed for a person on probation',
      detailUrl: `/pdf/${breachNotice.id}`,
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

    res.render('pages/report-completed', {
      breachNotice,
    })
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
      breachNotice.responseRequiredByDate != null &&
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

  function toUserDate(str: string): string {
    if (str) {
      return DateTimeFormatter.ofPattern('d/M/yyyy').format(DateTimeFormatter.ISO_LOCAL_DATE.parse(str))
    }
    return ''
  }

  function toUserTime(str: Date): string {
    if (str) {
      return DateTimeFormatter.ofPattern('HH:mm').format(DateTimeFormatter.ISO_LOCAL_DATE_TIME.parse(str.toString()))
    }
    return ''
  }

  function toUserDateFromDateTime(str: Date): string {
    if (str) {
      return DateTimeFormatter.ofPattern('d/M/yyyy').format(DateTimeFormatter.ISO_LOCAL_DATE_TIME.parse(str.toString()))
    }
    return ''
  }

  return router
}
