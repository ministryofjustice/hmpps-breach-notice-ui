import { type RequestHandler, Router, Response } from 'express'
import { DateTimeFormatter, LocalDate, LocalDateTime, TemporalQueries } from '@js-joda/core'
import asyncMiddleware from '../middleware/asyncMiddleware'
import type { Services } from '../services'
import { Page } from '../services/auditService'
import BreachNoticeApiClient, {
  Address,
  AddressList,
  BasicDetails,
  BreachNotice,
  BreachNoticeContact,
  BreachNoticeRequirement,
  EnforceableContact,
  EnforceableContactList,
  EnforceableContactRadioButton,
  EnforceableContactRadioButtonList,
  ErrorMessages,
  Name,
  RadioButton,
  RadioButtonList,
  ReferenceData,
  ReferenceDataList,
  Requirement,
  RequirementList,
  SelectItem,
  SelectItemList,
  SentenceType,
  SentenceTypeList,
  WarningDetails,
  WarningDetailsRequirementSelectItem,
  WarningDetailsRequirementSelectItemsList,
  WarningTypeDetails,
} from '../data/breachNoticeApiClient'
import localDate = TemporalQueries.localDate

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export default function routes({ auditService, hmppsAuthClient }: Services): Router {
  const router = Router()
  const get = (path: string | string[], handler: RequestHandler) => router.get(path, asyncMiddleware(handler))
  const post = (path: string | string[], handler: RequestHandler) => router.post(path, asyncMiddleware(handler))

  get('/', async (req, res, next) => {
    res.render('pages/error')
  })

  get('/breach-notice/:id', async (req, res, next) => {
    res.redirect(`/basic-details/${req.params.id}`)
  })

  get('/basic-details/:id', async (req, res, next) => {
    await auditService.logPageView(Page.BASIC_DETAILS, { who: res.locals.user.username, correlationId: req.id })
    const breachNoticeApiClient = new BreachNoticeApiClient(
      await hmppsAuthClient.getSystemClientToken(res.locals.user.username),
    )
    const { id } = req.params
    const basicDetails = createDummyBasicDetails()
    const breachNotice = await breachNoticeApiClient.getBreachNoticeById(id)
    checkBreachNoticeAndApplyDefaults(breachNotice, basicDetails)
    const alternateAddressOptions = initiateAlternateAddressSelectItemList(basicDetails, breachNotice)
    const replyAddressOptions = initiateReplyAddressSelectItemList(basicDetails, breachNotice)
    const defaultOffenderAddress: Address = findDefaultAddressInAddressList(basicDetails.addresses)
    const defaultReplyAddress: Address = findDefaultAddressInAddressList(basicDetails.replyAddresses)
    const basicDetailsDateOfLetter: string = toUserDate(breachNotice.dateOfLetter)
    res.render('pages/basic-details', {
      breachNotice,
      basicDetails,
      alternateAddressOptions,
      replyAddressOptions,
      defaultOffenderAddress,
      defaultReplyAddress,
      basicDetailsDateOfLetter,
    })
  })

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

  post('/basic-details/:id', async (req, res, next) => {
    const breachNoticeApiClient = new BreachNoticeApiClient(
      await hmppsAuthClient.getSystemClientToken(res.locals.user.username),
    )
    const breachNoticeId = req.params.id
    const basicDetails: BasicDetails = createDummyBasicDetails()
    let breachNotice: BreachNotice = null
    breachNotice = await breachNoticeApiClient.getBreachNoticeById(breachNoticeId as string)
    checkBreachNoticeAndApplyDefaults(breachNotice, basicDetails)
    const defaultOffenderAddress: Address = findDefaultAddressInAddressList(basicDetails.addresses)
    const defaultReplyAddress: Address = findDefaultAddressInAddressList(basicDetails.replyAddresses)
    breachNotice.referenceNumber = req.body.officeReference
    if (req.body.offenderAddressSelectOne === 'No') {
      // we are using a selected address. Find it in the list
      breachNotice.offenderAddress = getSelectedAddress(basicDetails.addresses, req.body.alternateAddress)
      breachNotice.useDefaultAddress = false
    } else if (req.body.offenderAddressSelectOne === 'Yes') {
      // otherwise use default
      breachNotice.offenderAddress = defaultOffenderAddress
      breachNotice.useDefaultAddress = true
    } else {
      breachNotice.useDefaultAddress = null
    }
    // reply address
    if (req.body.replyAddressSelectOne === 'No') {
      breachNotice.replyAddress = getSelectedAddress(basicDetails.replyAddresses, req.body.alternateReplyAddress)
      breachNotice.useDefaultReplyAddress = false
    } else if (req.body.replyAddressSelectOne === 'Yes') {
      breachNotice.replyAddress = defaultReplyAddress
      breachNotice.useDefaultReplyAddress = true
    } else {
      breachNotice.useDefaultReplyAddress = null
    }

    const combinedName: string = `${basicDetails.title} ${basicDetails.name.forename} ${basicDetails.name.middleName} ${basicDetails.name.surname}`
    breachNotice.titleAndFullName = combinedName.trim().replace('  ', ' ')

    // validation
    const errorMessages: ErrorMessages = validateBasicDetails(breachNotice, req.body.dateOfLetter)
    const hasErrors: boolean = Object.keys(errorMessages).length > 0

    if (hasErrors) {
      const alternateAddressOptions = initiateAlternateAddressSelectItemList(basicDetails, breachNotice)
      const replyAddressOptions = initiateReplyAddressSelectItemList(basicDetails, breachNotice)
      const basicDetailsDateOfLetter: string = req.body.dateOfLetter
      res.render(`pages/basic-details`, {
        errorMessages,
        breachNotice,
        basicDetails,
        defaultOffenderAddress,
        defaultReplyAddress,
        alternateAddressOptions,
        replyAddressOptions,
        basicDetailsDateOfLetter,
      })
    } else {
      // mark that a USER has saved the document at least once
      breachNotice.basicDetailsSaved = true
      await breachNoticeApiClient.updateBreachNotice(breachNoticeId, breachNotice)

      if (req.body.action === 'viewDraft') {
        try {
          await showDraftPdf(breachNotice, res, breachNoticeApiClient)
        } catch (err) {
          // Render the page with the new error
          errorMessages.pdfRenderError = {
            text: 'There was an issue generating the draft report. Please try again or contact support.',
          }

          const alternateAddressOptions = initiateAlternateAddressSelectItemList(basicDetails, breachNotice)
          const replyAddressOptions = initiateReplyAddressSelectItemList(basicDetails, breachNotice)
          const basicDetailsDateOfLetter: string = req.body.dateOfLetter
          res.render(`pages/basic-details`, {
            errorMessages,
            breachNotice,
            basicDetails,
            defaultOffenderAddress,
            defaultReplyAddress,
            alternateAddressOptions,
            replyAddressOptions,
            basicDetailsDateOfLetter,
          })
        }
      } else {
        res.redirect(`/warning-type/${req.params.id}`)
      }
    }
  })

  async function showDraftPdf(breachNotice: BreachNotice, res: Response, breachNoticeApiClient: BreachNoticeApiClient) {
    res.redirect(`/pdf/${breachNotice.id}`)
  }

  async function downloadDraftPdf(
    breachNotice: BreachNotice,
    res: Response,
    breachNoticeApiClient: BreachNoticeApiClient,
  ) {
    const stream: ArrayBuffer = await breachNoticeApiClient.getDraftPdfById(breachNotice.id as string)

    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="breach_notice_${breachNotice.crn}_${breachNotice.referenceNumber}_draft.pdf"`,
    )
    res.send(stream)
  }

  post('/warning-details/:id', async (req, res, next) => {
    const breachNoticeApiClient = new BreachNoticeApiClient(
      await hmppsAuthClient.getSystemClientToken(res.locals.user.username),
    )

    console.log('params')
    console.log(req.body)
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

  function validateBasicDetails(breachNotice: BreachNotice, userEnteredDateOfLetter: string): ErrorMessages {
    const errorMessages: ErrorMessages = {}
    const currentDateAtStartOfTheDay: LocalDateTime = LocalDate.now().atStartOfDay()
    if (breachNotice.referenceNumber) {
      if (breachNotice.referenceNumber.trim().length > 30) {
        errorMessages.officeReferenceNumber = {
          text: 'The Office Reference entered is greater than the 30 character limit.',
        }
      }
    }

    try {
      // eslint-disable-next-line no-param-reassign
      breachNotice.dateOfLetter = fromUserDate(userEnteredDateOfLetter)
    } catch (error: unknown) {
      // eslint-disable-next-line no-param-reassign
      breachNotice.dateOfLetter = userEnteredDateOfLetter
      errorMessages.dateOfLetter = {
        text: 'The proposed date for this letter is in an invalid format, please use the correct format e.g 17/5/2024',
      }
      // we cant continue with date validation
      return errorMessages
    }

    if (breachNotice) {
      // check date of letter is not before today
      if (breachNotice.dateOfLetter) {
        const localDateOfLetterAtStartOfDay = LocalDate.parse(breachNotice.dateOfLetter).atStartOfDay()
        if (localDateOfLetterAtStartOfDay.isBefore(currentDateAtStartOfTheDay)) {
          errorMessages.dateOfLetter = {
            text: 'The letter has not been completed and so the date cannot be before today',
          }
        }
        if (localDateOfLetterAtStartOfDay.minusDays(7).isAfter(currentDateAtStartOfTheDay)) {
          errorMessages.dateOfLetter = {
            text: 'The proposed date for this letter is a week in the future. Breach letters need to be timely in order to allow evidence to be presented. Please complete the letter in a timely way or update the contact outcome to be acceptable.',
          }
        }
      }
    }
    return errorMessages
  }

  function getSelectedAddress(addressList: AddressList, addressIdentifier: string): Address {
    const addressIdentifierNumber: number = +addressIdentifier
    return addressList.find(address => address.addressId === addressIdentifierNumber)
  }

  get('/warning-details/:id', async (req, res, next) => {
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
    })
  })

  function convertReferenceDataListToSelectItemList(referenceDataList: ReferenceDataList): SelectItemList {
    const arrayOfSelectItems: SelectItem[] = referenceDataList.map(refData => ({
      selected: false,
      text: refData.description,
      value: refData.code,
    }))
    return arrayOfSelectItems
  }
  function createEnforceableContactRadioButtonListFromEnforceableContacts(
    enforceableContactList: EnforceableContactList,
  ): EnforceableContactRadioButtonList {
    const arrayOfRadios: EnforceableContactRadioButton[] = enforceableContactList.map(enforceableContact => ({
      datetime: enforceableContact.datetime,
      type: enforceableContact.type,
      outcome: enforceableContact.outcome,
      notes: enforceableContact.notes,
      requirement: enforceableContact.requirement,
      checked: 'checked',
      value: enforceableContact.id.toString(),
      text: enforceableContact.description,
    }))
    return arrayOfRadios
  }

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

  // this is done DO NOT TOUCH
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

  get('/warning-type/:id', async (req, res, next) => {
    await auditService.logPageView(Page.WARNING_TYPE, { who: res.locals.user.username, correlationId: req.id })
    const breachNoticeApiClient = new BreachNoticeApiClient(
      await hmppsAuthClient.getSystemClientToken(res.locals.user.username),
    )
    const breachNoticeId = req.params.id
    let breachNotice: BreachNotice = null
    const warningTypeDetails: WarningTypeDetails = createDummyWarningTypeDetails()
    breachNotice = await breachNoticeApiClient.getBreachNoticeById(breachNoticeId as string)
    // need to load in the select items for the sentence type dropdown
    // const radioButtonsFromIntegration = initiateWarningTypeRadioButtons
    const warningTypeRadioButtons: Array<RadioButton> = initiateWarningTypeRadioButtonsAndApplySavedSelections(
      warningTypeDetails,
      breachNotice,
    )

    const sentenceTypeSelectItems: Array<SelectItem> = initiateSentenceTypeSelectItemsAndApplySavedSelections(
      warningTypeDetails,
      breachNotice,
    )

    renderWarningTypes(breachNotice, res, warningTypeRadioButtons, {}, sentenceTypeSelectItems)
  })

  async function renderWarningTypes(
    breachNotice: BreachNotice,
    res: Response,
    warningTypeRadioButtons: Array<RadioButton>,
    errorMessages: ErrorMessages,
    sentenceTypeSelectItems: Array<SelectItem>,
  ) {
    res.render('pages/warning-type', {
      errorMessages,
      breachNotice,
      warningTypeRadioButtons,
      sentenceTypeSelectItems,
    })
  }

  post('/warning-type/:id', async (req, res, next) => {
    const breachNoticeApiClient = new BreachNoticeApiClient(
      await hmppsAuthClient.getSystemClientToken(res.locals.user.username),
    )
    const breachNoticeId = req.params.id
    const warningTypeDetails: WarningTypeDetails = createDummyWarningTypeDetails()
    let breachNotice: BreachNotice = null
    breachNotice = await breachNoticeApiClient.getBreachNoticeById(breachNoticeId as string)

    // add new details
    breachNotice.breachNoticeTypeCode = req.body.warningType
    breachNotice.breachSentenceTypeCode = req.body.sentenceType
    // find the warning type ref data from the integration response
    warningTypeDetails.warningTypes.forEach((radioButton: RadioButton) => {
      if (breachNotice.breachNoticeTypeCode && breachNotice.breachNoticeTypeCode === radioButton.value) {
        // eslint-disable-next-line no-param-reassign
        breachNotice.breachNoticeTypeDescription = radioButton.text
      }
    })
    // find the sentenceTypeRefData from the integration response
    warningTypeDetails.sentenceTypes.forEach((sentenceType: SentenceType) => {
      if (breachNotice.breachSentenceTypeCode && breachNotice.breachSentenceTypeCode === sentenceType.code) {
        // eslint-disable-next-line no-param-reassign
        breachNotice.breachSentenceTypeDescription = sentenceType.description
      }
    })
    // mark that a USER has saved the document at least once
    breachNotice.warningTypeSaved = true
    await breachNoticeApiClient.updateBreachNotice(breachNoticeId, breachNotice)

    if (req.body.action === 'viewDraft') {
      try {
        await showDraftPdf(breachNotice, res, breachNoticeApiClient)
      } catch (err) {
        const errorMessages: ErrorMessages = {}
        errorMessages.pdfRenderError = {
          text: 'There was an issue generating the draft report. Please try again or contact support.',
        }
        const sentenceTypeSelectItems: Array<SelectItem> = initiateSentenceTypeSelectItemsAndApplySavedSelections(
          warningTypeDetails,
          breachNotice,
        )
        renderWarningTypes(breachNotice, res, warningTypeDetails.warningTypes, errorMessages, sentenceTypeSelectItems)
      }
    } else {
      res.redirect(`/warning-details/${req.params.id}`)
    }
  })

  // receive warningTypeDetails via an integration
  // query this data against our saved breach notice
  // to see if we need to apply a previous Selection
  function initiateWarningTypeRadioButtonsAndApplySavedSelections(
    warningTypeDetails: WarningTypeDetails,
    breachNotice: BreachNotice,
  ): RadioButton[] {
    const warningTypeRadioButtons: Array<RadioButton> = warningTypeDetails.warningTypes
    // return warningTypeRadioButtons
    // find currently selected code in breach notice and apply to the radio buttons
    if (breachNotice.breachNoticeTypeCode) {
      warningTypeRadioButtons.forEach((radioButton: RadioButton) => {
        console.log('values')
        console.log(radioButton.value)
        console.log(radioButton.text)
        console.log(radioButton.checked)
        if (breachNotice.breachNoticeTypeCode && breachNotice.breachNoticeTypeCode === radioButton.value) {
          // eslint-disable-next-line no-param-reassign
          radioButton.checked = true
        }
      })
    }
    return warningTypeRadioButtons
  }

  function initiateSentenceTypeSelectItemsAndApplySavedSelections(
    warningTypeDetails: WarningTypeDetails,
    breachNotice: BreachNotice,
  ): SelectItem[] {
    const sentenceTypeSelectItems: SelectItem[] = [
      {
        text: 'Please Select',
        value: '-1',
        selected: true,
      },
      ...warningTypeDetails.sentenceTypes.map(sentenceType => ({
        text: `${sentenceType.description}`,
        value: `${sentenceType.code}`,
        selected: false,
      })),
    ]

    if (breachNotice.breachSentenceTypeCode) {
      sentenceTypeSelectItems.forEach((sentenceTypeSelectItem: SelectItem) => {
        if (
          breachNotice.breachSentenceTypeCode &&
          breachNotice.breachSentenceTypeCode === sentenceTypeSelectItem.value
        ) {
          // eslint-disable-next-line no-param-reassign
          sentenceTypeSelectItem.selected = true
        }
      })
    }

    return sentenceTypeSelectItems
  }

  get('/next-appointment/:id', async (req, res, next) => {
    console.log('########## In the next appointment section')
    await auditService.logPageView(Page.NEXT_APPOINTMENT, { who: res.locals.user.username, correlationId: req.id })
    const breachNoticeApiClient = new BreachNoticeApiClient(
      await hmppsAuthClient.getSystemClientToken(res.locals.user.username),
    )
    const breachNoticeId = req.params.id
    let breachNotice: BreachNotice = null
    breachNotice = await breachNoticeApiClient.getBreachNoticeById(breachNoticeId as string)
    renderNextAppointment(breachNotice, res, {})
  })

  async function renderNextAppointment(breachNotice: BreachNotice, res: Response, errorMessages: ErrorMessages) {
    res.render('pages/next-appointment', {
      errorMessages,
      breachNotice,
    })
  }

  post('/next-appointment/:id', async (req, res, next) => {
    const breachNoticeApiClient = new BreachNoticeApiClient(
      await hmppsAuthClient.getSystemClientToken(res.locals.user.username),
    )
    await auditService.logPageView(Page.NEXT_APPOINTMENT, { who: res.locals.user.username, correlationId: req.id })
    const breachNoticeId = req.params.id
    let breachNotice: BreachNotice = null
    breachNotice = await breachNoticeApiClient.getBreachNoticeById(breachNoticeId as string)

    // TODO Post Logic

    if (req.body.action === 'viewDraft') {
      try {
        await showDraftPdf(breachNotice, res, breachNoticeApiClient)
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

  get('/check-your-report/:id', async (req, res, next) => {
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

  post('/check-your-report/:id', async (req, res, next) => {
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
        await showDraftPdf(breachNotice, res, breachNoticeApiClient)
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

  get('/basic-details', async (req, res, next) => {
    await auditService.logPageView(Page.BASIC_DETAILS, { who: res.locals.user.username, correlationId: req.id })
    res.render('pages/basic-details')
  })

  get('/report-completed/:id', async (req, res, next) => {
    await auditService.logPageView(Page.REPORT_COMPLETED, { who: res.locals.user.username, correlationId: req.id })
    const breachNoticeApiClient = new BreachNoticeApiClient(
      await hmppsAuthClient.getSystemClientToken(res.locals.user.username),
    )
    const breachNoticeId = req.params.id
    let breachNotice: BreachNotice = null
    breachNotice = await breachNoticeApiClient.getBreachNoticeById(breachNoticeId as string)
    res.render('pages/report-completed', {
      breachNotice,
    })
  })

  get('/report-completed', async (req, res, next) => {
    await auditService.logPageView(Page.REPORT_COMPLETED, { who: res.locals.user.username, correlationId: req.id })
    const breachNoticeApiClient = new BreachNoticeApiClient(
      await hmppsAuthClient.getSystemClientToken(res.locals.user.username),
    )
    // const breachNoticeId = req.params.id
    const breachNoticeId = '91992e76-54bc-4530-8775-fd8031d982c0'
    const stream: ArrayBuffer = await breachNoticeApiClient.getPdfById(breachNoticeId as string)

    await auditService.logPageView(Page.REPORT_DELETED, {
      who: res.locals.user.username,
      correlationId: req.id,
      details: stream,
    })

    let breachNotice: BreachNotice = null
    breachNotice = await breachNoticeApiClient.getBreachNoticeById(breachNoticeId as string)
    res.render('pages/report-completed', {
      breachNotice,
    })
  })

  get('/report-deleted/:id', async (req, res, next) => {
    await auditService.logPageView(Page.REPORT_DELETED, { who: res.locals.user.username, correlationId: req.id })
    const breachNoticeApiClient = new BreachNoticeApiClient(
      await hmppsAuthClient.getSystemClientToken(res.locals.user.username),
    )
    const breachNoticeId = req.params.id
    let breachNotice: BreachNotice = null
    breachNotice = await breachNoticeApiClient.getBreachNoticeById(breachNoticeId as string)
    res.render('pages/report-deleted', {
      breachNotice,
    })
  })

  get('/pdf/:id', async (req, res, next) => {
    await auditService.logPageView(Page.REPORT_DELETED, { who: res.locals.user.username, correlationId: req.id })
    const breachNoticeApiClient = new BreachNoticeApiClient(
      await hmppsAuthClient.getSystemClientToken(res.locals.user.username),
    )
    const breachNoticeId = req.params.id
    let breachNotice: BreachNotice = null
    breachNotice = await breachNoticeApiClient.getBreachNoticeById(breachNoticeId as string)
    const stream: ArrayBuffer = await breachNoticeApiClient.getDraftPdfById(breachNotice.id as string)

    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader(
      'Content-Disposition',
      `filename="breach_notice_${breachNotice.crn}_${breachNotice.referenceNumber}_draft.pdf"`,
    )
    res.send(stream)
  })

  // if this page hasnt been saved we want to go through and apply defaults otherwise dont do this
  function checkBreachNoticeAndApplyDefaults(breachNotice: BreachNotice, basicDetails: BasicDetails) {
    // we havent saved the page yet so default
    if (!breachNotice.basicDetailsSaved) {
      // load offender name from integration details
      // eslint-disable-next-line no-param-reassign
      breachNotice.titleAndFullName = `${basicDetails.title} ${basicDetails.name.forename} ${basicDetails.name.middleName} ${basicDetails.name.surname}`
      // default the radio buttons to true
      // eslint-disable-next-line no-param-reassign
      breachNotice.useDefaultAddress = true
      // eslint-disable-next-line no-param-reassign
      breachNotice.useDefaultReplyAddress = true
    }
  }

  function initiateAlternateAddressSelectItemList(
    basicDetails: BasicDetails,
    breachNotice: BreachNotice,
  ): SelectItem[] {
    const alternateAddressSelectItemList: SelectItem[] = [
      {
        text: 'Please Select',
        value: '-1',
        selected: true,
      },
      ...basicDetails.addresses.map(address => ({
        text: [
          address.buildingName,
          address.addressNumber.concat(` ${address.streetName}`).trim(),
          address.district,
          address.townCity,
          address.county,
          address.postcode,
        ]
          .filter(item => item)
          .join(', '),
        value: `${address.addressId}`,
        selected: false,
      })),
    ]

    if (breachNotice.basicDetailsSaved) {
      alternateAddressSelectItemList.forEach((selectItem: SelectItem) => {
        if (breachNotice.offenderAddress && breachNotice.offenderAddress.addressId) {
          if (breachNotice.offenderAddress.addressId !== -1) {
            const selectItemValueNumber: number = +selectItem.value
            if (breachNotice.offenderAddress.addressId === selectItemValueNumber) {
              // eslint-disable-next-line no-param-reassign
              selectItem.selected = true
            } else {
              // eslint-disable-next-line no-param-reassign
              selectItem.selected = false
            }
          }
        }
      })
    }

    return alternateAddressSelectItemList
  }

  function initiateReplyAddressSelectItemList(basicDetails: BasicDetails, breachNotice: BreachNotice): SelectItem[] {
    const alternateReplyAddressSelectItemList: SelectItem[] = [
      {
        text: 'Please Select',
        value: '-1',
        selected: true,
      },
      ...basicDetails.replyAddresses.map(address => ({
        text: [
          address.buildingName,
          address.addressNumber.concat(` ${address.streetName}`).trim(),
          address.district,
          address.townCity,
          address.county,
          address.postcode,
        ]
          .filter(item => item)
          .join(', '),
        value: `${address.addressId}`,
        selected: false,
      })),
    ]

    if (breachNotice.basicDetailsSaved) {
      alternateReplyAddressSelectItemList.forEach((selectItem: SelectItem) => {
        if (breachNotice.replyAddress && breachNotice.replyAddress.addressId) {
          if (breachNotice.replyAddress.addressId !== -1) {
            const selectItemValueNumber: number = +selectItem.value
            if (breachNotice.replyAddress.addressId === selectItemValueNumber) {
              // eslint-disable-next-line no-param-reassign
              selectItem.selected = true
            } else {
              // eslint-disable-next-line no-param-reassign
              selectItem.selected = false
            }
          }
        }
      })
    }

    return alternateReplyAddressSelectItemList
  }

  function findDefaultAddressInAddressList(addressList: Array<Address>): Address {
    let defaultAddress: Address = null

    addressList.forEach((address: Address) => {
      if (address.type === 'Postal') {
        defaultAddress = address
      }

      if (defaultAddress === null) {
        if (address.type === 'Main') {
          defaultAddress = address
        }
      }
    })
    return defaultAddress
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
  function createDummyReferenceData(): ReferenceData {
    return {
      code: 'DUM1',
      description: 'Dummy 1',
    }
  }
  function createDummySentenceType(): SentenceType {
    return {
      code: `SEN${Math.random()}`,
      description: 'sentenceType1',
      conditionBeingEnforced: 'Test Condition',
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

  // Will call integration point once available
  function createDummyBasicDetails(): BasicDetails {
    return {
      title: 'Mr',
      name: createDummyName(),
      addresses: createDummyAddressList(),
      replyAddresses: createDummyReplyAddressList(),
    }
  }

  // Will call integration point once available
  function createDummyWarningTypeDetails(): WarningTypeDetails {
    const warningTypeDetails: WarningTypeDetails = {
      warningTypes: createDummyWarningTypeList(),
      sentenceTypes: createDummySentenceTypeList(),
    }
    return warningTypeDetails
  }

  function createDummyRequirement(): Requirement {
    return {
      id: 1,
      type: createDummyReferenceData(),
      subType: createDummyReferenceData(),
    }
  }

  function createDummyWarningTypeList(): RadioButtonList {
    const breachWarning: RadioButton = {
      value: 'BW',
      text: 'Breach Warning',
      checked: false,
    }

    const finalWarning: RadioButton = {
      value: 'FW',
      text: 'Final Warning',
      checked: false,
    }

    const formalWarning: RadioButton = {
      value: 'FOW',
      text: 'Formal Warning',
      checked: false,
    }

    return [breachWarning, finalWarning, formalWarning]
  }

  function createDummyAddressList(): Array<Address> {
    const postalAddress: Address = {
      addressId: 12345,
      type: 'Postal',
      buildingName: null,
      addressNumber: '21',
      county: 'Postal County',
      district: 'Postal District',
      postcode: 'NE30 3ZZ',
      streetName: 'Postal Street',
      townCity: 'PostCity',
    }

    const mainAddress: Address = {
      addressId: 67891,
      type: 'Main',
      buildingName: null,
      addressNumber: '666',
      county: 'Some County',
      district: 'Some District',
      postcode: 'NE30 3AB',
      streetName: 'The Street',
      townCity: 'Newcastle',
    }

    return [postalAddress, mainAddress]
  }

  function createDummyReplyAddressList(): Array<Address> {
    const postalAddress: Address = {
      addressId: 33333,
      type: 'Postal',
      buildingName: null,
      addressNumber: '21',
      county: 'Reply County',
      district: 'Reply District',
      postcode: 'NE22 3AA',
      streetName: 'Reply Street',
      townCity: 'Reply City',
    }

    const mainAddress: Address = {
      addressId: 44444,
      type: 'Main',
      buildingName: null,
      addressNumber: '77',
      county: 'Tyne and Wear',
      district: 'Lake District',
      postcode: 'NE30 3CC',
      streetName: 'The Street',
      townCity: 'Newcastle',
    }

    return [postalAddress, mainAddress]
  }

  function createDummyName(): Name {
    const dummyName: Name = {
      forename: 'Billy',
      middleName: 'The',
      surname: 'Kid',
    }
    return dummyName
  }

  return router
}
