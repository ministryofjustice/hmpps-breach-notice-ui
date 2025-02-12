import { type RequestHandler, Router, Response } from 'express'
import { DateTimeFormatter, LocalDate, LocalDateTime } from '@js-joda/core'
import asyncMiddleware from '../middleware/asyncMiddleware'
import type { Services } from '../services'
import { Page } from '../services/auditService'
import BreachNoticeApiClient, {
  Address,
  AddressList,
  BasicDetails,
  BreachNotice,
  ErrorMessages,
  Name,
  RadioButton,
  RadioButtonList,
  SelectItem,
  SelectItemList,
  WarningTypeDetails,
} from '../data/breachNoticeApiClient'

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
    const breachNoticeId = req.params.id
    const basicDetails: BasicDetails = createDummyBasicDetails()
    let breachNotice: BreachNotice = null
    breachNotice = await breachNoticeApiClient.getBreachNoticeById(breachNoticeId as string)
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
    const stream: ArrayBuffer = await breachNoticeApiClient.getDraftPdfById(breachNotice.id as string)

    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="breach_notice_${breachNotice.crn}_${breachNotice.referenceNumber}_draft.pdf"`,
    )
    res.send(stream)
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
    await renderWarningDetails(breachNotice, res, {})
  })

  async function renderWarningDetails(breachNotice: BreachNotice, res: Response, errorMessages: ErrorMessages) {
    res.render(`pages/warning-details`, {
      errorMessages,
      breachNotice,
    })
  }

  post('/warning-details/:id', async (req, res, next) => {
    const breachNoticeApiClient = new BreachNoticeApiClient(
      await hmppsAuthClient.getSystemClientToken(res.locals.user.username),
    )
    await auditService.logPageView(Page.WARNING_DETAILS, { who: res.locals.user.username, correlationId: req.id })
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
        await renderWarningDetails(breachNotice, res, errorMessages)
      }
    } else {
      res.redirect(`/next-appointment/${req.params.id}`)
    }
  })

  get('/warning-type/:id', async (req, res, next) => {
    await auditService.logPageView(Page.WARNING_TYPE, { who: res.locals.user.username, correlationId: req.id })
    const breachNoticeApiClient = new BreachNoticeApiClient(
      await hmppsAuthClient.getSystemClientToken(res.locals.user.username),
    )
    const breachNoticeId = req.params.id
    let breachNotice: BreachNotice = null
    breachNotice = await breachNoticeApiClient.getBreachNoticeById(breachNoticeId as string)
    // const radioButtonsFromIntegration = initiateWarningTypeRadioButtons
    const warningTypeRadioButtons: Array<RadioButton> = initiateWarningTypeRadioButtonsAndApplySavedSelections(
      createDummyWarningTypeDetails(),
      breachNotice,
    )

    renderWarningTypes(breachNotice, res, warningTypeRadioButtons, {})
  })

  async function renderWarningTypes(
    breachNotice: BreachNotice,
    res: Response,
    warningTypeRadioButtons: Array<RadioButton>,
    errorMessages: ErrorMessages,
  ) {
    res.render('pages/warning-type', {
      errorMessages,
      breachNotice,
      warningTypeRadioButtons,
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
    // find the ref data from the integration response
    warningTypeDetails.warningTypes.forEach((radioButton: RadioButton) => {
      if (breachNotice.breachNoticeTypeCode && breachNotice.breachNoticeTypeCode === radioButton.value) {
        // eslint-disable-next-line no-param-reassign
        breachNotice.breachNoticeTypeDescription = radioButton.text
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
        renderWarningTypes(breachNotice, res, warningTypeDetails.warningTypes, errorMessages)
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

  get('/next-appointment/:id', async (req, res, next) => {
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
    }
    return warningTypeDetails
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
