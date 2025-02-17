import { Response, Router } from 'express'
import { LocalDate, LocalDateTime } from '@js-joda/core'
import BreachNoticeApiClient, {
  BreachNotice,
  BreachNoticeContact,
  BreachNoticeRequirement,
  EnforceableContact,
  EnforceableContactList,
  EnforceableContactRadioButtonList,
  ErrorMessages,
  ReferenceData,
  ReferenceDataList,
  Requirement,
  SelectItem,
  SelectItemList,
  SentenceType,
  SentenceTypeList,
  WarningDetails,
  WarningDetailsRequirementSelectItem,
} from '../data/breachNoticeApiClient'
import AuditService, { Page } from '../services/auditService'
import { fromUserDate } from '../utils/dateUtils'
import { HmppsAuthClient } from '../data'

export default function warningDetailsRoutes(
  router: Router,
  auditService: AuditService,
  hmppsAuthClient: HmppsAuthClient,
): Router {
  const currentPage = 'warning-details'

  router.post('/warning-details/:id', async (req, res, next) => {
    const breachNoticeApiClient = new BreachNoticeApiClient(
      await hmppsAuthClient.getSystemClientToken(res.locals.user.username),
    )

    const breachNoticeId = req.params.id
    const warningDetails: WarningDetails = createDummyWarningDetails()
    const breachNotice: BreachNotice = await breachNoticeApiClient.getBreachNoticeById(breachNoticeId as string)
    // failures recorded on this order
    const contactList: BreachNoticeContact[] = []
    // select the failures being enforced
    const requirementList: BreachNoticeRequirement[] = []

    // for final warning theres only 1 of these for first warning screen
    const failureRecordedContactId: string = req.body.failureRecordedContact
    if (failureRecordedContactId) {
      // loop through the original contact list
      warningDetails.enforceableContactList.forEach((enforceableContact: EnforceableContact) => {
        const breachNoticeContact: BreachNoticeContact = {
          id: null,
          breachNoticeId: breachNotice.id,
          contactDate: enforceableContact.datetime,
          contactType: enforceableContact.type.description,
          contactOutcome: enforceableContact.outcome.description,
          contactId: enforceableContact.id,
        }
        contactList.push(breachNoticeContact)
      })
    }

    // we have failures recorded found at this point
    // we need to deal with requirements now from screen (failures being enforced)
    breachNotice.breachNoticeContactList = contactList

    // we need to create requirements
    // this is actually a list of contacts the requirements belong to
    // get failuresBeingEnforcedRequirements from body
    const { failuresBeingEnforcedRequirements } = req.body
    // for each contact in the list get the requirements, set the breach reason then add to our list
    failuresBeingEnforcedRequirements.forEach((contactId: string) => {
      // first find the contact

      // go through the original list again
      warningDetails.enforceableContactList.forEach((enforceableContact: EnforceableContact) => {
        if (enforceableContact.id.toString() === contactId) {
          const bodyParamBreachReason: string = `breachreason${contactId}`
          const contactRequirement = enforceableContact.requirement
          const breachNoticeRequirement: BreachNoticeRequirement = {
            id: null,
            breachNoticeId: breachNotice.id,
            requirementId: contactRequirement.id,
            mainCategoryDescription: contactRequirement.type.description,
            subCategoryDescription: contactRequirement.subType.description,
            rejectionReason: req.body[bodyParamBreachReason],
          }
          requirementList.push(breachNoticeRequirement)
        }
      })
    })

    breachNotice.breachNoticeRequirementList = requirementList
    const warningDetailsErrorMessages: ErrorMessages = validateWarningDetails(
      breachNotice,
      req.body.responseRequiredByDate,
    )

    const warningDetailsHasErrors: boolean = Object.keys(warningDetailsErrorMessages).length > 0
    if (warningDetailsHasErrors) {
      const failuresRecorded: SelectItemList = createSelectItemListFromEnforceableContacts(
        warningDetails.enforceableContactList,
      )
      const enforceableContactRadioButtonList = createEnforceableContactRadioButtonListFromEnforceableContacts(
        warningDetails.enforceableContactList,
      )

      const breachReasons = convertReferenceDataListToSelectItemList(warningDetails.breachReasons)
      const failuresBeingEnforcedList = createFailuresBeingEnforcedRequirementSelectList(
        warningDetails.enforceableContactList,
        warningDetails.breachReasons,
      )
      res.render(`pages/basic-details`, {
        breachNotice,
        warningDetails,
        failuresRecorded,
        enforceableContactRadioButtonList,
        breachReasons,
        failuresBeingEnforcedList,
        currentPage,
      })
    } else {
      // mark that a USER has saved the document at least once
      breachNotice.warningDetailsSaved = true
      await breachNoticeApiClient.updateBreachNotice(breachNoticeId, breachNotice)
      // we need to create requirements

      if (req.body.action === 'viewDraft') {
        try {
          await showDraftPdf(breachNotice, res, breachNoticeApiClient)
        } catch (err) {
          const errorMessages: ErrorMessages = {}
          errorMessages.pdfRenderError = {
            text: 'There was an issue generating the draft report. Please try again or contact support.',
          }

          const failuresRecorded: SelectItemList = createSelectItemListFromEnforceableContacts(
            warningDetails.enforceableContactList,
          )
          const enforceableContactRadioButtonList = createEnforceableContactRadioButtonListFromEnforceableContacts(
            warningDetails.enforceableContactList,
          )

          const breachReasons = convertReferenceDataListToSelectItemList(warningDetails.breachReasons)
          const failuresBeingEnforcedList = createFailuresBeingEnforcedRequirementSelectList(
            warningDetails.enforceableContactList,
            warningDetails.breachReasons,
          )

          res.render(`pages/basic-details`, {
            errorMessages,
            breachNotice,
            warningDetails,
            failuresRecorded,
            enforceableContactRadioButtonList,
            breachReasons,
            failuresBeingEnforcedList,
            currentPage,
          })
        }
      } else {
        res.redirect(`/next-appointment/${req.params.id}`)
      }

      res.redirect(`/next-appointment/${req.params.id}`)
    }
  })

  function validateWarningDetails(breachNotice: BreachNotice, responseRequiredByDate: string): ErrorMessages {
    const errorMessages: ErrorMessages = {}
    const currentDateAtStartOfTheDay: LocalDateTime = LocalDate.now().atStartOfDay()

    try {
      // eslint-disable-next-line no-param-reassign
      breachNotice.responseRequiredByDate = fromUserDate(responseRequiredByDate)
    } catch (error: unknown) {
      // eslint-disable-next-line no-param-reassign
      breachNotice.responseRequiredByDate = responseRequiredByDate
      errorMessages.dateOfLetter = {
        text: 'The proposed date for this letter is in an invalid format, please use the correct format e.g 17/5/2024',
      }
      // we cant continue with date validation
      return errorMessages
    }

    if (breachNotice) {
      // check date of letter is not before today
      if (breachNotice.responseRequiredByDate) {
        const localDateOfResponseRequiredByDate = LocalDate.parse(breachNotice.responseRequiredByDate).atStartOfDay()
        if (localDateOfResponseRequiredByDate.isBefore(currentDateAtStartOfTheDay)) {
          errorMessages.responseRequiredByDate = {
            text: 'The Response Required By Date can not be before today',
          }
        }
      }
    }
    return errorMessages
  }

  router.get('/warning-details/:id', async (req, res, next) => {
    await auditService.logPageView(Page.WARNING_DETAILS, { who: res.locals.user.username, correlationId: req.id })
    const breachNoticeApiClient = new BreachNoticeApiClient(
      await hmppsAuthClient.getSystemClientToken(res.locals.user.username),
    )
    const breachNoticeId = req.params.id
    let breachNotice: BreachNotice = null
    breachNotice = await breachNoticeApiClient.getBreachNoticeById(breachNoticeId as string)

    const warningDetails: WarningDetails = createDummyWarningDetails()
    const enforceableContactRadioButtonList = createEnforceableContactRadioButtonListFromEnforceableContacts(
      warningDetails.enforceableContactList,
    )
    const breachReasons = convertReferenceDataListToSelectItemList(warningDetails.breachReasons)
    const failuresBeingEnforcedList = createFailuresBeingEnforcedRequirementSelectList(
      warningDetails.enforceableContactList,
      warningDetails.breachReasons,
    )

    const failuresRecorded: SelectItemList = createSelectItemListFromEnforceableContacts(
      warningDetails.enforceableContactList,
    )
    res.render(`pages/warning-details`, {
      breachNotice,
      warningDetails,
      failuresRecorded,
      enforceableContactRadioButtonList,
      breachReasons,
      failuresBeingEnforcedList,
      currentPage,
    })
  })

  // we need this to return a list of WarningDetailsRequirementSelectItem wselect items with cusdtomised requirement list
  function createFailuresBeingEnforcedRequirementSelectList(
    enforceableContactList: EnforceableContactList,
    breachReasons: ReferenceDataList,
  ): WarningDetailsRequirementSelectItem[] {
    const breachReasonSelectItems: SelectItemList = craftTheBreachReasonSelectItems(breachReasons)
    const returnItems: WarningDetailsRequirementSelectItem[] = []
    enforceableContactList.forEach((enforceableContact: EnforceableContact) => {
      const linkedSelectItem: WarningDetailsRequirementSelectItem = {
        text: enforceableContact.description,
        value: enforceableContact.id.toString(),
        selected: false,
        requirements: breachReasonSelectItems,
      }
      returnItems.push(linkedSelectItem)
    })
    return returnItems
  }

  function createSelectItemListFromEnforceableContacts(enforceableContactList: EnforceableContactList): SelectItemList {
    const selectItemList: SelectItem[] = []
    enforceableContactList.forEach((enforceableContact: EnforceableContact) => {
      const selectItem: SelectItem = {
        text: enforceableContact.description,
        value: enforceableContact.id.toString(),
        selected: false,
      }
      selectItemList.push(selectItem)
    })
    return selectItemList
  }

  function craftTheBreachReasonSelectItems(refDataList: ReferenceDataList): SelectItemList {
    const selectItemListToReturn: SelectItem[] = []
    refDataList.forEach((referenceData: ReferenceData) => {
      const selectItem: SelectItem = {
        text: referenceData.description,
        value: referenceData.code,
        selected: false,
      }
      selectItemListToReturn.push(selectItem)
    })
    return selectItemListToReturn
  }

  function createEnforceableContactRadioButtonListFromEnforceableContacts(
    enforceableContactList: EnforceableContactList,
  ): EnforceableContactRadioButtonList {
    return enforceableContactList.map(enforceableContact => ({
      datetime: enforceableContact.datetime,
      type: enforceableContact.type,
      outcome: enforceableContact.outcome,
      notes: enforceableContact.notes,
      requirement: enforceableContact.requirement,
      checked: 'checked',
      value: enforceableContact.id.toString(),
      text: enforceableContact.description,
    }))
  }

  // Will call integration point once available
  function createDummyWarningDetails(): WarningDetails {
    return {
      breachReasons: createDummyBreachReasonList(),
      defaultSentenceTypeCode: 'BR1',
      enforceableContactList: createDummyEnforceableContactList(),
      sentenceTypes: createDummySentenceTypeList(),
    }
  }

  function createDummyEnforceableContactList() {
    const enforceableContact1: EnforceableContact = {
      description:
        '02/10/2024, Rehabilitation Activity Requirement (RAR) - Rehabilitation Activity Requirement (RAR), Planned Office Visit (NS), Unacceptable absence',
      datetime: LocalDateTime.now(),
      id: 1,
      notes:
        'Lorem 1 ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum',
      outcome: createDummyReferenceData(),
      type: createDummyReferenceData(),
      requirement: createDummyRequirement(),
    }

    const enforceableContact2: EnforceableContact = {
      description: '01/08/2024, Unpaid Work - Regular, CP/UPW Appointment (NS), Sent Home (behavior)',
      datetime: LocalDateTime.now(),
      id: 2,
      notes:
        'Lorem 2 ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum',
      outcome: createDummyReferenceData(),
      type: createDummyReferenceData(),
      requirement: createDummyRequirement(),
    }

    return [enforceableContact1, enforceableContact2]
  }

  function createDummyReferenceData(): ReferenceData {
    return {
      code: 'DUM1',
      description: 'Dummy 1',
    }
  }

  function createDummyBreachReasonList() {
    const breachReason1: ReferenceData = {
      code: '2IN12',
      description: '2 occasions in a 12 month period',
    }

    const breachReason2: ReferenceData = {
      code: '3TOTAL',
      description: '3 occasions during your supervision period',
    }

    return [breachReason1, breachReason2]
  }

  function createDummyRequirement(): Requirement {
    return {
      id: 1,
      type: createDummyReferenceData(),
      subType: createDummyReferenceData(),
    }
  }

  function createDummySentenceTypeList(): SentenceTypeList {
    const sentenceType1: SentenceType = {
      code: `CO`,
      description: 'Community Order(s)',
      conditionBeingEnforced: 'Test Condition CO',
    }
    const sentenceType2: SentenceType = {
      code: `SSO`,
      description: 'Suspended Supervision Order(s)',
      conditionBeingEnforced: 'Test Condition SSO',
    }
    return [sentenceType1, sentenceType2]
  }

  function convertReferenceDataListToSelectItemList(referenceDataList: ReferenceDataList): SelectItemList {
    const arrayOfSelectItems: SelectItem[] = referenceDataList.map(refData => ({
      selected: false,
      text: refData.description,
      value: refData.code,
    }))
    return arrayOfSelectItems
  }

  async function showDraftPdf(breachNotice: BreachNotice, res: Response, breachNoticeApiClient: BreachNoticeApiClient) {
    res.redirect(`/pdf/${breachNotice.id}`)
  }

  return router
}
