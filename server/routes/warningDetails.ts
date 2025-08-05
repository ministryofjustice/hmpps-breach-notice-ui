import { Router } from 'express'
import { LocalDate, LocalDateTime } from '@js-joda/core'
import BreachNoticeApiClient, {
  BreachNotice,
  BreachNoticeContact,
  BreachNoticeRequirement,
  WarningDetailsRequirementSelectItem,
} from '../data/breachNoticeApiClient'
import AuditService, { Page } from '../services/auditService'
import { fromUserDate, toUserDate } from '../utils/dateUtils'
import { HmppsAuthClient } from '../data'
import CommonUtils from '../services/commonUtils'
import asArray, { createBlankBreachNoticeWithId, handleIntegrationErrors } from '../utils/utils'
import NdeliusIntegrationApiClient, {
  EnforceableContact,
  EnforceableContactList,
  ReferenceData,
  Requirement,
  RequirementList,
  WarningDetails,
} from '../data/ndeliusIntegrationApiClient'
import { ErrorMessages, SelectItem } from '../data/uiModels'
import config from '../config'

export default function warningDetailsRoutes(
  router: Router,
  auditService: AuditService,
  hmppsAuthClient: HmppsAuthClient,
  commonUtils: CommonUtils,
): Router {
  const currentPage = 'warning-details'

  router.get(['/warning-details/:id', '/warning-details/:id/:callingscreen'], async (req, res, next) => {
    await auditService.logPageView(Page.WARNING_DETAILS, { who: res.locals.user.username, correlationId: req.id })
    const breachNoticeApiClient = new BreachNoticeApiClient(
      await hmppsAuthClient.getSystemClientToken(res.locals.user.username),
    )

    let breachNotice: BreachNotice = null
    let warningDetails: WarningDetails = null

    try {
      // get the existing breach notice
      breachNotice = await breachNoticeApiClient.getBreachNoticeById(req.params.id as string)
    } catch (error) {
      const errorMessages: ErrorMessages = handleIntegrationErrors(error.status, error.data?.message, 'Breach Notice')
      const showEmbeddedError = true
      breachNotice = createBlankBreachNoticeWithId(req.params.id)
      // always stay on page and display the error when there are isssues retrieving the breach notice
      res.render(`pages/warning-details`, { errorMessages, showEmbeddedError, breachNotice })
      return
    }

    if (await commonUtils.redirectRequired(breachNotice, res)) return
    const ndeliusIntegrationApiClient = new NdeliusIntegrationApiClient(
      await hmppsAuthClient.getSystemClientToken(res.locals.user.username),
    )

    try {
      // get details from the integration service
      warningDetails = await ndeliusIntegrationApiClient.getWarningDetails(breachNotice.crn, breachNotice.id)
    } catch (error) {
      const errorMessages: ErrorMessages = handleIntegrationErrors(
        error.status,
        error.data?.message,
        'NDelius Integration',
      )
      // take the user to detailed error page for 400 type errors
      if (error.status === 400) {
        res.render(`pages/detailed-error`, { errorMessages })
        return
      }
      // stay on the current page for 500 errors
      if (error.status === 500) {
        const showEmbeddedError = true
        breachNotice = createBlankBreachNoticeWithId(req.params.id)
        res.render(`pages/warning-details`, { errorMessages, showEmbeddedError, breachNotice })
        return
      }
      res.render(`pages/detailed-error`, { errorMessages })
      return
    }

    const warningDetailsResponseRequiredDate: string = toUserDate(breachNotice.responseRequiredDate)
    const breachReasons = convertReferenceDataListToSelectItemList(warningDetails.breachReasons)
    const requirementsList = createFailuresBeingEnforcedRequirementSelectList(
      warningDetails.requirements,
      warningDetails.breachReasons,
      breachNotice,
    )

    const failuresRecorded = createSelectItemListFromEnforceableContacts(warningDetails.enforceableContacts)
    const contactListDeeplink = `${config.ndeliusDeeplink.url}?component=ContactList&CRN=${breachNotice.crn}`
    const { furtherReasonDetails } = breachNotice
    res.render(`pages/warning-details`, {
      breachNotice,
      warningDetails,
      failuresRecorded,
      breachReasons,
      requirementsList,
      currentPage,
      warningDetailsResponseRequiredDate,
      contactListDeeplink,
      furtherReasonDetails,
    })
  })

  router.post('/warning-details/:id', async (req, res, next) => {
    const { id } = req.params
    const token = await hmppsAuthClient.getSystemClientToken(res.locals.user.username)
    const breachNoticeApiClient = new BreachNoticeApiClient(token)
    const ndeliusIntegrationApiClient = new NdeliusIntegrationApiClient(token)
    let breachNotice: BreachNotice = null
    let warningDetails: WarningDetails = null
    const callingScreen: string = req.query.returnTo as string

    try {
      // get the existing breach notice
      breachNotice = await breachNoticeApiClient.getBreachNoticeById(id as string)
    } catch (error) {
      const errorMessages: ErrorMessages = handleIntegrationErrors(error.status, error.data?.message, 'Breach Notice')
      const showEmbeddedError = true
      breachNotice = createBlankBreachNoticeWithId(req.params.id)
      // always stay on page and display the error when there are isssues retrieving the breach notice
      res.render(`pages/warning-details`, { errorMessages, showEmbeddedError, breachNotice })
      return
    }

    try {
      warningDetails = await ndeliusIntegrationApiClient.getWarningDetails(breachNotice.crn, breachNotice.id)
    } catch (error) {
      const errorMessages: ErrorMessages = handleIntegrationErrors(
        error.status,
        error.data?.message,
        'NDelius Integration',
      )
      // take the user to detailed error page for 400 type errors
      if (error.status === 400) {
        res.render(`pages/detailed-error`, { errorMessages })
        return
      }
      // stay on the current page for 500 errors
      if (error.status === 500) {
        const showEmbeddedError = true
        breachNotice = createBlankBreachNoticeWithId(req.params.id)
        res.render(`pages/warning-details`, { errorMessages, showEmbeddedError, breachNotice })
        return
      }
      res.render(`pages/detailed-error`, { errorMessages })
      return
    }

    if (await commonUtils.redirectRequired(breachNotice, res)) return

    // failures recorded on this order
    // list of contacts
    const contactList: BreachNoticeContact[] = []

    // for final warning theres only 1 of these for first warning screen
    const failureRecordedContactId: string = req.body.failureRecordedContact

    let enforceableContact: EnforceableContact = null
    // lookup the contact and push to the list of contacts to be saved
    // if we have enforceable contacts
    if (warningDetails.enforceableContacts) {
      enforceableContact = warningDetails.enforceableContacts.find(
        contact => contact.id.toString() === failureRecordedContactId,
      )
    }

    if (enforceableContact) {
      contactList.push({
        id: null,
        contactId: enforceableContact.id,
        breachNoticeId: breachNotice.id,
        contactDate: enforceableContact?.datetime?.toString(),
        contactType: enforceableContact.type?.description,
        contactOutcome: enforceableContact.outcome?.description,
      })
    }

    // add the list of contacts to out breach notice
    breachNotice.breachNoticeContactList = contactList

    // set the further reason details
    breachNotice.furtherReasonDetails = req.body.furtherReasonDetails

    // lookup the requirements
    // this can come in an array or singular
    const requirementsPassedInBody = asArray(req.body.failuresBeingEnforcedRequirements)
    let hasRequirements: boolean = false
    // we only want to map across if there have been some requirements passed in
    if (requirementsPassedInBody) {
      hasRequirements = Object.keys(requirementsPassedInBody).length > 0
      if (hasRequirements) {
        breachNotice.breachNoticeRequirementList = requirementsPassedInBody.map((requirementId: string) => {
          let matchingRequirement: Requirement = null

          // dont search if we have no requirements contacts
          if (warningDetails.requirements) {
            matchingRequirement = warningDetails.requirements.find(
              requirement => requirement?.id?.toString() === requirementId,
            )
          }

          const bodyParamBreachReason: string = `breachreason${requirementId}`
          const currentRequirement: BreachNoticeRequirement = {
            id: null,
            breachNoticeId: breachNotice.id,
            requirementId: matchingRequirement?.id,
            requirementTypeMainCategoryDescription: matchingRequirement?.type?.description,
            requirementTypeSubCategoryDescription: matchingRequirement?.subType?.description,
            rejectionReason: warningDetails.breachReasons.find(c => c.code === req.body[bodyParamBreachReason])
              ?.description,
            fromDate: null,
            toDate: null,
          }
          return applyContactDateRangesToRequirement(currentRequirement, warningDetails.enforceableContacts)
        })
      }
    }

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
      } else if (callingScreen && callingScreen === 'check-your-report') {
        res.redirect(`/check-your-report/${id}`)
      } else {
        res.redirect(`/next-appointment/${id}`)
      }
    } else {
      const failuresRecorded = createSelectItemListFromEnforceableContacts(warningDetails.enforceableContacts)
      const breachReasons = convertReferenceDataListToSelectItemList(warningDetails.breachReasons)
      const requirementsList = createFailuresBeingEnforcedRequirementSelectList(
        warningDetails.requirements,
        warningDetails.breachReasons,
        breachNotice,
      )

      const contactListDeeplink = `${config.ndeliusDeeplink.url}?component=ContactList&CRN=${breachNotice.crn}`
      const { furtherReasonDetails } = breachNotice
      res.render(`pages/warning-details`, {
        breachNotice,
        warningDetails,
        failuresRecorded,
        breachReasons,
        requirementsList,
        currentPage,
        errorMessages,
        contactListDeeplink,
        furtherReasonDetails,
      })
    }
  })

  function applyContactDateRangesToRequirement(
    breachNoticeRequirement: BreachNoticeRequirement,
    enforceableContactList: EnforceableContact[],
  ): BreachNoticeRequirement {
    if (breachNoticeRequirement && enforceableContactList) {
      const dateList = enforceableContactList.map(i => i.datetime)
      const maxDate = dateList.reduce((a, b) => (a > b ? a : b))
      const minDate = dateList.reduce((a, b) => (a < b ? a : b))
      return {
        ...breachNoticeRequirement,
        fromDate: minDate.toString(),
        toDate: maxDate.toString(),
      }
    }
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
    if (breachNotice.furtherReasonDetails && breachNotice.furtherReasonDetails.length > 4000) {
      errorMessages.furtherReasonDetails = {
        text: 'Further reason details: Please use 4000 characters or less for this field.',
      }
    }

    if (breachNotice && breachNotice.responseRequiredDate) {
      const localDateOfResponseRequiredByDate = LocalDate.parse(breachNotice.responseRequiredDate).atStartOfDay()
      if (localDateOfResponseRequiredByDate.isBefore(currentDateAtStartOfTheDay)) {
        errorMessages.responseRequiredByDate = {
          text: 'The Response Required By Date can not be before today',
        }
      }
    }
    return errorMessages
  }

  function createFailuresBeingEnforcedRequirementSelectList(
    requirements: RequirementList,
    breachReasons: ReferenceData[],
    breachNotice: BreachNotice,
  ): WarningDetailsRequirementSelectItem[] {
    if (requirements) {
      const nonUniqueRequirementList: WarningDetailsRequirementSelectItem[] = requirements.map(
        (requirement: Requirement) => {
          let breachNoticeRequirement: BreachNoticeRequirement = null
          if (breachNotice.breachNoticeRequirementList) {
            breachNoticeRequirement = breachNotice.breachNoticeRequirementList.find(
              savedRequirement => savedRequirement.requirementId?.toString() === requirement.id?.toString(),
            )
          }
          const breachReasonSelectItems = craftTheBreachReasonSelectItems(breachReasons, breachNoticeRequirement)

          const typeString: string = `${requirement?.type?.description}`
          const subTypeString: string = `${requirement?.subType?.description}`
          let typeSybtypeString: string

          if (subTypeString && subTypeString !== 'undefined') {
            typeSybtypeString = `${typeString} - ${subTypeString}`
          } else {
            typeSybtypeString = typeString
          }

          return {
            text: typeSybtypeString,
            value: requirement?.id?.toString(),
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
        },
      )
      return removeDuplicateSelectItems(nonUniqueRequirementList)
    }
    return []
  }

  function removeDuplicateSelectItems(selectItems: WarningDetailsRequirementSelectItem[]) {
    if (selectItems) {
      const uniqueSelectItems: WarningDetailsRequirementSelectItem[] = []
      const uniqueIds: string[] = []
      selectItems.forEach((warningDetailsRequirementSelectItem: WarningDetailsRequirementSelectItem) => {
        if (!uniqueIds.find(a => a === warningDetailsRequirementSelectItem.value)) {
          uniqueSelectItems.push(warningDetailsRequirementSelectItem)
          uniqueIds.push(warningDetailsRequirementSelectItem.value)
        }
      })
      return uniqueSelectItems
    }
    return selectItems
  }

  function createSelectItemListFromEnforceableContacts(enforceableContactList: EnforceableContactList): SelectItem[] {
    const selectItemList: SelectItem[] = []
    if (enforceableContactList) {
      enforceableContactList.forEach((enforceableContact: EnforceableContact) => {
        const selectItem: SelectItem = {
          text: enforceableContact?.description,
          value: enforceableContact?.id?.toString(),
          selected: false,
        }
        selectItemList.push(selectItem)
      })
    }
    return selectItemList
  }

  function craftTheBreachReasonSelectItems(
    refDataList: ReferenceData[],
    requirement: BreachNoticeRequirement,
  ): SelectItem[] {
    return refDataList.map((referenceData: ReferenceData) => {
      return {
        text: referenceData?.description,
        value: referenceData?.code,
        selected: requirement && requirement?.rejectionReason === referenceData?.description,
      }
    })
  }

  function convertReferenceDataListToSelectItemList(referenceDataList: ReferenceData[]): SelectItem[] {
    return referenceDataList.map(refData => ({
      selected: false,
      text: refData?.description,
      value: refData?.code,
    }))
  }

  return router
}
