import { Response, Router } from 'express'
import { DateTimeFormatter, LocalDate, LocalDateTime } from '@js-joda/core'
import AuditService, { Page } from '../services/auditService'
import BreachNoticeApiClient, { BreachNotice, ErrorMessages } from '../data/breachNoticeApiClient'
import { HmppsAuthClient } from '../data'
import SnsService from '../services/snsService'
import CommonUtils from '../services/commonUtils'

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
    const breachNoticeId = req.params.id
    let breachNotice: BreachNotice = null
    breachNotice = await breachNoticeApiClient.getBreachNoticeById(breachNoticeId as string)

    const redirect = await commonUtils.redirectOnStatusChange(breachNotice, res)
    if (redirect) {
      return
    }

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
    const breachNoticeId = req.params.id
    let breachNotice: BreachNotice = null
    breachNotice = await breachNoticeApiClient.getBreachNoticeById(breachNoticeId as string)

    const redirect = await commonUtils.redirectOnStatusChange(breachNotice, res)
    if (redirect) {
      return
    }

    breachNotice.completedDate = new Date()
    await breachNoticeApiClient.updateBreachNotice(breachNoticeId, breachNotice)

    snsService.sendMessage({ crn: breachNotice.crn, id: breachNotice.id })

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

  function fromUserDate(str: string): string {
    if (str) {
      return DateTimeFormatter.ISO_LOCAL_DATE.format(DateTimeFormatter.ofPattern('d/M/yyyy').parse(str))
    }
    return ''
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
