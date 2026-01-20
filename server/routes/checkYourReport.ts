import {Response, Router} from 'express'
import {ZonedDateTime, ZoneId} from '@js-joda/core'
import '@js-joda/timezone'
import AuditService, {Page} from '../services/auditService'
import BreachNoticeApiClient, {
  BreachNotice,
  BreachNoticeContact,
  WarningDetailsWholeSentenceAndRequirement
} from '../data/breachNoticeApiClient'
import {HmppsAuthClient} from '../data'
import CommonUtils from '../services/commonUtils'
import {toUserDate, toUserDateFromDateTime, toUserTimeFromDateTime} from '../utils/dateUtils'
import {ErrorMessages} from '../data/uiModels'
import {createBlankBreachNoticeWithId, handleIntegrationErrors} from '../utils/utils'

export default function checkYourReportRoutes(
  router: Router,
  auditService: AuditService,
  hmppsAuthClient: HmppsAuthClient,
  commonUtils: CommonUtils,
): Router {
  router.get('/check-your-report/:id', async (req, res) => {
    await auditService.logPageView(Page.CHECK_YOUR_REPORT, { who: res.locals.user.username, correlationId: req.id })
    const breachNoticeApiClient = new BreachNoticeApiClient(
      await hmppsAuthClient.getSystemClientToken(res.locals.user.username),
    )
    const { id } = req.params
    let breachNotice: BreachNotice
    let breachNoticeWholeSentenceContacts: BreachNoticeContact[] = []
    let warningDetailsFailureList: WarningDetailsWholeSentenceAndRequirement[] = []

    try {
      breachNotice = await breachNoticeApiClient.getBreachNoticeById(id as string)

      if(breachNotice.breachNoticeContactList && Object.keys(breachNotice.breachNoticeContactList).length > 0) {
        breachNoticeWholeSentenceContacts = breachNotice.breachNoticeContactList.filter(bnc => bnc.wholeSentence === true)
      }

      if(breachNoticeWholeSentenceContacts && Object.keys(breachNoticeWholeSentenceContacts).length > 0) {
        //contact date, contact type, contact outcome - rejection reason (whole sentence)
        breachNoticeWholeSentenceContacts?.forEach(it => {
          if(it.rejectionReason) {
            const desc: string = (toUserDateFromDateTime(it.contactDate))
              .concat(it.contactType? ", "+it.contactType : "")
              .concat(it.contactOutcome? ", "+it.contactOutcome : "")
              .concat(it.rejectionReason? " - "+it.rejectionReason : "")
              .concat(" (whole sentence)")
            warningDetailsFailureList.push({
              description: desc,
              wholeSentence: it.wholeSentence
            })
          }
        })
      }

      //add standard requirement failures to the list
      if(breachNotice.breachNoticeRequirementList && Object.keys(breachNotice.breachNoticeContactList).length > 0) {
        breachNotice.breachNoticeRequirementList.forEach(it => {

          if(it.rejectionReason) {
            console.log("REJECTION REASON: "+it.rejectionReason)
            console.log("Main Descriptiuon: "+it.requirementTypeMainCategoryDescription)
            console.log("Sub Descriptiuon: "+it.requirementTypeSubCategoryDescription)
            const recDesc: string = it.requirementTypeMainCategoryDescription
              . concat(it.requirementTypeSubCategoryDescription? ", "+it.requirementTypeSubCategoryDescription : "")
              . concat(" - "+it.rejectionReason)

            warningDetailsFailureList.push({
              description: recDesc,
              wholeSentence: false
            })
          }
        })
      }
    } catch (error) {
      const errorMessages: ErrorMessages = handleIntegrationErrors(error.status, error.data?.message, 'Breach Notice')
      const showEmbeddedError = true
      breachNotice = createBlankBreachNoticeWithId(req.params.id)
      // always stay on page and display the error when there are isssues retrieving the breach notice
      res.render(`pages/check-your-report`, { errorMessages, showEmbeddedError, breachNotice })
      return
    }

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
      breachNoticeWholeSentenceContacts,
      warningDetailsFailureList,
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
    breachNoticeWholeSentenceContacts: BreachNoticeContact[],
    warningDetailsFailureList: WarningDetailsWholeSentenceAndRequirement[],
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
      breachNoticeWholeSentenceContacts,
      warningDetailsFailureList,
      dateOfLetter,
      responseRequiredByDate,
      nextAppointmentDate,
      nextAppointmentTime,
      reportValidated,
      currentPage,
    })
  }

  router.post('/check-your-report/:id', async (req, res) => {
    await auditService.logPageView(Page.CHECK_YOUR_REPORT, { who: res.locals.user.username, correlationId: req.id })
    const breachNoticeApiClient = new BreachNoticeApiClient(
      await hmppsAuthClient.getSystemClientToken(res.locals.user.username),
    )
    const { id } = req.params
    const breachNotice = await breachNoticeApiClient.getBreachNoticeById(id as string)
    if (await commonUtils.redirectRequired(breachNotice, res)) return
    breachNotice.completedDate = ZonedDateTime.now(ZoneId.of('Europe/London'))
    await breachNoticeApiClient.updateBreachNotice(id, breachNotice)
    res.redirect(`/report-completed/${req.params.id}`)
  })

  function validateCheckYourReport(breachNotice: BreachNotice): boolean {
    return (
      breachNotice.crn != null &&
      breachNotice.titleAndFullName != null &&
      breachNotice.offenderAddress != null &&
      breachNotice.dateOfLetter != null &&
      breachNotice.replyAddress != null &&
      breachNotice.breachNoticeTypeDescription != null &&
      breachNotice.breachSentenceTypeDescription &&
      breachNotice.breachNoticeRequirementList != null &&
      breachNotice.breachNoticeRequirementList.length > 0 &&
      breachNotice.responseRequiredDate != null &&
      breachNotice.responsibleOfficer != null &&
      breachNotice.contactNumber != null
    )
  }

  return router
}
