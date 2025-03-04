import { type RequestHandler, Router } from 'express'
import { LocalDate, LocalDateTime } from '@js-joda/core'
import BreachNoticeApiClient, {
  BreachNotice,
  BreachNoticeContact,
  BreachNoticeRequirement,
  ErrorMessages,
  ReferenceData,
  ReferenceDataList,
  SelectItem,
  SelectItemList,
  WarningDetailsRequirementSelectItem,
} from '../data/breachNoticeApiClient'
import AuditService, { Page } from '../services/auditService'
import { fromUserDate, toUserDate } from '../utils/dateUtils'
import { HmppsAuthClient } from '../data'
import CommonUtils from '../services/commonUtils'
import asyncMiddleware from '../middleware/asyncMiddleware'
import asArray from '../utils/utils'
import NdeliusIntegrationApiClient, {
  EnforceableContact,
  EnforceableContactList,
  WarningDetails,
} from '../data/ndeliusIntegrationApiClient'

export default function warningDetailsRoutes(
  router: Router,
  auditService: AuditService,
  hmppsAuthClient: HmppsAuthClient,
  commonUtils: CommonUtils,
): Router {
  const currentPage = 'warning-details'
  const get = (path: string | string[], handler: RequestHandler) => router.get(path, asyncMiddleware(handler))
  const post = (path: string | string[], handler: RequestHandler) => router.post(path, asyncMiddleware(handler))

  post('/warning-details/:id', async (req, res, next) => {
    const { id } = req.params
    const breachNoticeApiClient = new BreachNoticeApiClient(
      await hmppsAuthClient.getSystemClientToken(res.locals.user.username),
    )

    const ndeliusIntegrationApiClient = new NdeliusIntegrationApiClient(
      await hmppsAuthClient.getSystemClientToken(res.locals.user.username),
    )

    const breachNotice: BreachNotice = await breachNoticeApiClient.getBreachNoticeById(id as string)

    if (await commonUtils.redirectRequired(breachNotice, res)) return

    // const basicDetails = await ndeliusIntegrationApiClient.getBasicDetails(breachNotice.crn, req.user.username)
    const warningDetails: WarningDetails = await ndeliusIntegrationApiClient.getWarningDetails(
      breachNotice.crn,
      breachNotice.id,
    )

    // failures recorded on this order
    // list of contacts
    const contactList: BreachNoticeContact[] = []
    // select the failures being enforced
    // list of requirements
    const requirementList: BreachNoticeRequirement[] = []

    // for final warning theres only 1 of these for first warning screen
    const failureRecordedContactId: string = req.body.failureRecordedContact

    // lookup the contact and push to the list of contacts to be saved
    const enforceableContact: EnforceableContact = warningDetails.enforceableContacts.find(
      contact => contact.id.toString() === failureRecordedContactId,
    )

    if (enforceableContact) {
      contactList.push({
        id: null,
        contactId: enforceableContact.id,
        breachNoticeId: breachNotice.id,
        contactDate: enforceableContact.datetime.toString(),
        contactType: enforceableContact.type.description,
        contactOutcome: enforceableContact.outcome.description,
      })
    }

    // add the list of contacts to out breach notice
    breachNotice.breachNoticeContactList = contactList

    // lookup the requirements
    // this can come in an array or singular
    const selectedFailureRequirements = asArray(req.body.failuresBeingEnforcedRequirements)

    selectedFailureRequirements.forEach((requirementId: string) => {
      const enforceableContactWithRequirement: EnforceableContact = warningDetails.enforceableContacts.find(
        contact => contact.requirement.id.toString() === requirementId,
      )
      const bodyParamBreachReason: string = `breachreason${requirementId}`

      const currentRequirement: BreachNoticeRequirement = {
        id: null,
        breachNoticeId: breachNotice.id,
        requirementId: enforceableContactWithRequirement.requirement.id,
        requirementTypeMainCategoryDescription: enforceableContactWithRequirement.requirement.type.description,
        requirementTypeSubCategoryDescription: enforceableContactWithRequirement.requirement.subType.description,
        rejectionReason: req.body[bodyParamBreachReason],
        fromDate: null,
        toDate: null,
      }

      requirementList.push(applyContactDateRangesToRequirement(currentRequirement, warningDetails.enforceableContacts))
    })

    breachNotice.breachNoticeRequirementList = requirementList
    const errorMessages: ErrorMessages = validateWarningDetails(breachNotice, req.body.responseRequiredByDate)

    const hasErrors: boolean = Object.keys(errorMessages).length > 0

    // if we dont have validation errors navigate to ...next screen
    if (!hasErrors) {
      breachNotice.warningDetailsSaved = true
      await breachNoticeApiClient.updateBreachNotice(id, breachNotice)
      if (req.body.action === 'saveProgressAndClose') {
        res.send(`<script nonce="${res.locals.cspNonce}">window.close()</script>`)
      } else if (req.body.action === 'refreshFromNdelius') {
        // redirect to warning details to force a reload
        res.redirect(`/warning-details/${id}`)
      } else {
        res.redirect(`/next-appointment/${id}`)
      }
    } else {
      const failuresRecorded: SelectItemList = createSelectItemListFromEnforceableContacts(
        warningDetails.enforceableContacts,
      )
      const breachReasons = convertReferenceDataListToSelectItemList(warningDetails.breachReasons)
      const requirementsList = createFailuresBeingEnforcedRequirementSelectList(
        warningDetails.enforceableContacts,
        warningDetails.breachReasons,
        breachNotice,
      )

      res.render(`pages/warning-details`, {
        breachNotice,
        warningDetails,
        failuresRecorded,
        breachReasons,
        requirementsList,
        currentPage,
        errorMessages,
      })
    }
  })

  function applyContactDateRangesToRequirement(
    breachNoticeRequirement: BreachNoticeRequirement,
    enforceableContactList: EnforceableContact[],
  ): BreachNoticeRequirement {
    const dateList: string[] = []
    enforceableContactList.forEach((enforcebleContact: EnforceableContact) => {
      if (enforcebleContact.requirement) {
        if (enforcebleContact.requirement.id.toString() === breachNoticeRequirement.requirementId.toString()) {
          if (enforcebleContact.datetime) {
            dateList.push(enforcebleContact.datetime.toString())
          }
        }
      }
    })

    const maxDate = dateList.reduce((a, b) => (a > b ? a : b))
    const minDate = dateList.reduce((a, b) => (a < b ? a : b))
    // eslint-disable-next-line no-param-reassign
    breachNoticeRequirement.toDate = maxDate
    // eslint-disable-next-line no-param-reassign
    breachNoticeRequirement.fromDate = minDate
    return breachNoticeRequirement
  }

  function validateWarningDetails(breachNotice: BreachNotice, responseRequiredByDate: string): ErrorMessages {
    const errorMessages: ErrorMessages = {}
    const currentDateAtStartOfTheDay: LocalDateTime = LocalDate.now().atStartOfDay()
    try {
      // eslint-disable-next-line no-param-reassign
      breachNotice.responseRequiredDate = fromUserDate(responseRequiredByDate)
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (error: unknown) {
      // eslint-disable-next-line no-param-reassign
      breachNotice.responseRequiredDate = responseRequiredByDate
      errorMessages.responseRequiredByDate = {
        text: 'The proposed date for this letter is in an invalid format, please use the correct format e.g 17/5/2024',
      }
      // we cant continue with date validation
      return errorMessages
    }

    if (breachNotice) {
      // check date of letter is not before today
      if (breachNotice.responseRequiredDate) {
        const localDateOfResponseRequiredByDate = LocalDate.parse(breachNotice.responseRequiredDate).atStartOfDay()
        if (localDateOfResponseRequiredByDate.isBefore(currentDateAtStartOfTheDay)) {
          errorMessages.responseRequiredByDate = {
            text: 'The Response Required By Date can not be before today',
          }
        }
      }
    }
    return errorMessages
  }

  get('/warning-details/:id', async (req, res, next) => {
    await auditService.logPageView(Page.WARNING_DETAILS, { who: res.locals.user.username, correlationId: req.id })
    const breachNoticeApiClient = new BreachNoticeApiClient(
      await hmppsAuthClient.getSystemClientToken(res.locals.user.username),
    )
    const breachNoticeId = req.params.id
    const breachNotice = await breachNoticeApiClient.getBreachNoticeById(breachNoticeId as string)
    if (await commonUtils.redirectRequired(breachNotice, res)) return
    const ndeliusIntegrationApiClient = new NdeliusIntegrationApiClient(
      await hmppsAuthClient.getSystemClientToken(res.locals.user.username),
    )

    const warningDetails: WarningDetails = await ndeliusIntegrationApiClient.getWarningDetails(
      breachNotice.crn,
      breachNotice.id,
    )

    const warningDetailsResponseRequiredDate: string = toUserDate(breachNotice.responseRequiredDate)
    const breachReasons = convertReferenceDataListToSelectItemList(warningDetails.breachReasons)
    const requirementsList = createFailuresBeingEnforcedRequirementSelectList(
      warningDetails.enforceableContacts,
      warningDetails.breachReasons,
      breachNotice,
    )

    const failuresRecorded: SelectItemList = createSelectItemListFromEnforceableContacts(
      warningDetails.enforceableContacts,
    )
    res.render(`pages/warning-details`, {
      breachNotice,
      warningDetails,
      failuresRecorded,
      breachReasons,
      requirementsList,
      currentPage,
      warningDetailsResponseRequiredDate,
    })
  })

  function createFailuresBeingEnforcedRequirementSelectList(
    enforceableContactList: EnforceableContactList,
    breachReasons: ReferenceDataList,
    breachNotice: BreachNotice,
  ): WarningDetailsRequirementSelectItem[] {
    if (enforceableContactList) {
      return enforceableContactList.map((enforceableContact: EnforceableContact) => {
        const { requirement } = enforceableContact
        let breachNoticeRequirement: BreachNoticeRequirement = null
        if (breachNotice.breachNoticeRequirementList) {
          breachNoticeRequirement = breachNotice.breachNoticeRequirementList.find(
            savedRequirement => savedRequirement.requirementId?.toString() === requirement.id?.toString(),
          )
        }
        const breachReasonSelectItems = craftTheBreachReasonSelectItems(breachReasons, breachNoticeRequirement)
        return {
          text: `${requirement.type.description} - ${requirement.subType.description}`,
          value: requirement.id.toString(),
          checked: !!breachNoticeRequirement,
          conditional: {
            html: `<div class="govuk-form-group">
              <label class="govuk-label" for="breachreason${requirement.id}">Why is this being enforced?</label>
              <select class="govuk-select" id="breachreason${requirement.id}" name="breachreason${requirement.id}">
              ${breachReasonSelectItems.map(item => `<option value="${item.value}" ${item.selected ? 'selected' : ''}>${item.text}</option>`).join()}
              </select>
            </div>`,
          },
        }
      })
    }
    return []
  }

  function createSelectItemListFromEnforceableContacts(enforceableContactList: EnforceableContactList): SelectItemList {
    const selectItemList: SelectItem[] = []
    if (enforceableContactList) {
      enforceableContactList.forEach((enforceableContact: EnforceableContact) => {
        const selectItem: SelectItem = {
          text: enforceableContact.description,
          value: enforceableContact.id.toString(),
          selected: false,
        }
        selectItemList.push(selectItem)
      })
    }
    return selectItemList
  }

  function craftTheBreachReasonSelectItems(
    refDataList: ReferenceDataList,
    requirement: BreachNoticeRequirement,
  ): SelectItemList {
    return refDataList.map((referenceData: ReferenceData) => {
      return {
        text: referenceData.description,
        value: referenceData.code,
        selected: requirement && requirement?.rejectionReason === referenceData.code,
      }
    })
  }

  function convertReferenceDataListToSelectItemList(referenceDataList: ReferenceDataList): SelectItemList {
    return referenceDataList.map(refData => ({
      selected: false,
      text: refData.description,
      value: refData.code,
    }))
  }

  return router
}
