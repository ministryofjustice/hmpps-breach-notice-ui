import { type RequestHandler, Router } from 'express'
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
import CommonUtils from '../services/commonUtils'
import asyncMiddleware from '../middleware/asyncMiddleware'

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
    const breachNoticeApiClient = new BreachNoticeApiClient(
      await hmppsAuthClient.getSystemClientToken(res.locals.user.username),
    )

    const { id } = req.params
    const warningDetails: WarningDetails = createDummyWarningDetails()
    const breachNotice: BreachNotice = await breachNoticeApiClient.getBreachNoticeById(id as string)

    if (await commonUtils.redirectRequired(breachNotice, res)) return

    // failures recorded on this order
    // list of contacts
    const contactList: BreachNoticeContact[] = []
    // select the failures being enforced
    // list of requirements
    const requirementList: BreachNoticeRequirement[] = []

    // for final warning theres only 1 of these for first warning screen
    const failureRecordedContactId: string = req.body.failureRecordedContact

    // lookup the contact and push to the list of contacts to be saved
    const enforceableContact: EnforceableContact = warningDetails.enforceableContactList.find(
      contact => contact.id.toString() === failureRecordedContactId,
    )

    if (enforceableContact) {
      contactList.push({
        id: null,
        contactId: enforceableContact.id,
        breachNoticeId: breachNotice.id,
        contactDate: enforceableContact.datetime,
        contactType: enforceableContact.type.description,
        contactOutcome: enforceableContact.outcome.description,
      })
    }

    // add the list of contacts to out breach notice
    breachNotice.breachNoticeContactList = contactList

    // lookup the requirements
    const selectedRequirements: string[] = req.body.failuresBeingEnforcedRequirements

    // we have contacts and requirements in here: warningDetails.enforceableContactList
    // to get the full requirement info we will need to loop through the contacts until
    // we find the one with the requirement to get the details
    selectedRequirements.forEach((requirementId: string) => {
      const enforceableContactWithRequirement: EnforceableContact = warningDetails.enforceableContactList.find(
        contact => contact.requirement.id.toString() === requirementId,
      )
      const bodyParamBreachReason: string = `breachreason${requirementId}`
      requirementList.push({
        id: null,
        breachNoticeId: breachNotice.id,
        requirementId: enforceableContactWithRequirement.requirement.id,
        requirementTypeMainCategoryDescription: enforceableContactWithRequirement.requirement.type.description,
        requirementTypeSubCategoryDescription: enforceableContactWithRequirement.requirement.subType.description,
        rejectionReason: req.body[bodyParamBreachReason],
      })
    })

    breachNotice.breachNoticeRequirementList = requirementList
    console.log('response required by')
    console.log(req.body.responseRequiredByDate)

    const warningDetailsErrorMessages: ErrorMessages = validateWarningDetails(
      breachNotice,
      req.body.responseRequiredByDate,
    )

    const hasErrors: boolean = Object.keys(warningDetailsErrorMessages).length > 0

    // if we dont have validation errors navigate to ...next screen
    if (!hasErrors) {
      breachNotice.warningDetailsSaved = true
      await breachNoticeApiClient.updateBreachNotice(id, breachNotice)
      res.redirect(`/next-appointment/${id}`)
    } else {
      const failuresRecorded: SelectItemList = createSelectItemListFromEnforceableContacts(
        warningDetails.enforceableContactList,
      )
      const enforceableContactRadioButtonList = createEnforceableContactRadioButtonListFromEnforceableContacts(
        // enforceable contact list is the lkist that remains the same
        // breach notice contains a list of contacts we are ionterested in
        warningDetails.enforceableContactList,
        breachNotice,
      )

      const breachReasons = convertReferenceDataListToSelectItemList(warningDetails.breachReasons)
      const requirementsList = createFailuresBeingEnforcedRequirementSelectList(
        warningDetails.enforceableContactList,
        warningDetails.breachReasons,
      )

      res.render(`pages/warning-details`, {
        breachNotice,
        warningDetails,
        failuresRecorded,
        enforceableContactRadioButtonList,
        breachReasons,
        requirementsList,
        currentPage,
      })
    }
  })

  function validateWarningDetails(breachNotice: BreachNotice, responseRequiredByDate: string): ErrorMessages {
    const errorMessages: ErrorMessages = {}
    const currentDateAtStartOfTheDay: LocalDateTime = LocalDate.now().atStartOfDay()

    try {
      // eslint-disable-next-line no-param-reassign
      breachNotice.responseRequiredDate = fromUserDate(responseRequiredByDate)
    } catch (error: unknown) {
      // eslint-disable-next-line no-param-reassign
      breachNotice.responseRequiredDate = responseRequiredByDate
      errorMessages.dateOfLetter = {
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

    const warningDetails: WarningDetails = createDummyWarningDetails()
    const enforceableContactRadioButtonList = createEnforceableContactRadioButtonListFromEnforceableContacts(
      warningDetails.enforceableContactList,
      breachNotice,
    )
    const breachReasons = convertReferenceDataListToSelectItemList(warningDetails.breachReasons)
    const requirementsList = createFailuresBeingEnforcedRequirementSelectList(
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
      requirementsList,
      currentPage,
    })
  })

  // Generate the requirement list. to do this we loop through the enforceable contact
  // list and take the requirement associated with each contact into a list
  // we have a list of breach reasons to also associate with the requirements
  function createFailuresBeingEnforcedRequirementSelectList(
    enforceableContactList: EnforceableContactList,
    breachReasons: ReferenceDataList,
  ): WarningDetailsRequirementSelectItem[] {
    const breachReasonSelectItems: SelectItemList = craftTheBreachReasonSelectItems(breachReasons)
    const returnItems: WarningDetailsRequirementSelectItem[] = []

    enforceableContactList.forEach((enforceableContact: EnforceableContact) => {
      const { requirement } = enforceableContact
      const linkedSelectItem: WarningDetailsRequirementSelectItem = {
        text: `${requirement.type.description} - ${requirement.subType.description}`,
        value: requirement.id.toString(),
        selected: false,
        breachReasons: breachReasonSelectItems,
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
    breachNotice: BreachNotice,
  ): EnforceableContactRadioButtonList {
    return enforceableContactList.map(enforceableContact => ({
      datetime: enforceableContact.datetime,
      type: enforceableContact.type,
      outcome: enforceableContact.outcome,
      notes: enforceableContact.notes,
      requirement: enforceableContact.requirement,
      checked: breachNotice.breachNoticeContactList.some(
        contact => contact.contactId?.toString() === enforceableContact.id?.toString(),
      ),
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
        '02/10/2024, Contact 1 - Rehabilitation Activity Requirement (RAR), Planned Office Visit (NS), Unacceptable absence',
      datetime: LocalDateTime.now().toString(),
      id: 1,
      notes: 'Lorem 1 ipsum dolor sit amet, consectetur adipiscing elit. Contact 1',
      outcome: createDummyOutcome(),
      type: createDummyType(),
      requirement: createDummyRequirement(1),
    }

    const enforceableContact2: EnforceableContact = {
      description: '01/08/2024, Contact 2 - Regular, CP/UPW Appointment (NS), Sent Home (behavior)',
      datetime: LocalDateTime.now().toString(),
      id: 2,
      notes: 'Lorem 2 ipsum dolor sit amet, consectetur adipiscing elit, sed do Contact 2',
      outcome: createDummyOutcome(),
      type: createDummySubType(),
      requirement: createDummyRequirement(2),
    }

    return [enforceableContact1, enforceableContact2]
  }

  function createDummyType(): ReferenceData {
    return {
      code: 'REQ1',
      description: 'Requirement Type',
    }
  }

  function createDummySubType(): ReferenceData {
    return {
      code: 'REQ2',
      description: 'Requirement Sub Type',
    }
  }

  function createDummyOutcome(): ReferenceData {
    return {
      code: 'Outcom1',
      description: 'Dummy Outcome',
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

  function createDummyRequirement(idVar: number): Requirement {
    return {
      id: idVar,
      type: createDummyType(),
      subType: createDummySubType(),
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
    return referenceDataList.map(refData => ({
      selected: false,
      text: refData.description,
      value: refData.code,
    }))
  }

  return router
}
