import { type RequestHandler, Response, Router } from 'express'
import { LocalDate, LocalDateTime } from '@js-joda/core'
import asyncMiddleware from '../middleware/asyncMiddleware'
import type { Services } from '../services'
import AuditService, { Page } from '../services/auditService'
import BreachNoticeApiClient, {
  BreachNotice,
  ErrorMessages,
  RadioButton,
  SelectItem,
} from '../data/breachNoticeApiClient'
import NdeliusIntegrationApiClient, {
  Address,
  AddressList,
  BasicDetails,
  Name,
} from '../data/ndeliusIntegrationApiClient'
import { fromUserDate, toUserDate } from '../utils/dateUtils'
import { HmppsAuthClient } from '../data'

export default function basicDetailsRoutes(
  router: Router,
  auditService: AuditService,
  hmppsAuthClient: HmppsAuthClient,
): Router {
  // const router = Router()
  // const get = (path: string | string[], handler: RequestHandler) => router.get(path, asyncMiddleware(handler))
  // const post = (path: string | string[], handler: RequestHandler) => router.post(path, asyncMiddleware(handler))

  const currentPage = 'basic-details'

  router.get('/basic-details/:id', async (req, res, next) => {
    await auditService.logPageView(Page.BASIC_DETAILS, { who: res.locals.user.username, correlationId: req.id })
    const breachNoticeApiClient = new BreachNoticeApiClient(
      await hmppsAuthClient.getSystemClientToken(res.locals.user.username),
    )
    const ndeliusIntegrationApiClient = new NdeliusIntegrationApiClient(
      await hmppsAuthClient.getSystemClientToken(res.locals.user.username),
    )
    const { id } = req.params
    const breachNotice = await breachNoticeApiClient.getBreachNoticeById(id)
    const basicDetails = await ndeliusIntegrationApiClient.getBasicDetails(breachNotice.crn, req.user.username)
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
      currentPage,
    })
  })

  router.post('/basic-details/:id', async (req, res, next) => {
    const breachNoticeApiClient = new BreachNoticeApiClient(
      await hmppsAuthClient.getSystemClientToken(res.locals.user.username),
    )
    const ndeliusIntegrationApiClient = new NdeliusIntegrationApiClient(
      await hmppsAuthClient.getSystemClientToken(res.locals.user.username),
    )
    const breachNoticeId = req.params.id
    let breachNotice: BreachNotice = null
    breachNotice = await breachNoticeApiClient.getBreachNoticeById(breachNoticeId as string)
    const basicDetails = await ndeliusIntegrationApiClient.getBasicDetails(breachNotice.crn, req.user.username)
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

    let combinedName: string = `${basicDetails.title} ${basicDetails.name.forename} `
    if (basicDetails.name.middleName != null) {
      combinedName += `${basicDetails.name.middleName} `
    }
    combinedName += `${basicDetails.name.surname}`
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
        currentPage,
      })
    } else {
      // mark that a USER has saved the document at least once
      breachNotice.basicDetailsSaved = true
      await breachNoticeApiClient.updateBreachNotice(breachNoticeId, breachNotice)

      if (req.body.action === 'viewDraft') {
        try {
          await showDraftPdf(breachNotice.id, res)
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
            currentPage,
          })
        }
      } else {
        res.redirect(`/warning-type/${req.params.id}`)
      }
    }
  })

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

  router.get('/basic-details', async (req, res, next) => {
    await auditService.logPageView(Page.BASIC_DETAILS, { who: res.locals.user.username, correlationId: req.id })
    res.render('pages/basic-details')
  })

  // if this page hasnt been saved we want to go through and apply defaults otherwise dont do this
  function checkBreachNoticeAndApplyDefaults(breachNotice: BreachNotice, basicDetails: BasicDetails) {
    // we havent saved the page yet so default
    if (!breachNotice.basicDetailsSaved) {
      // load offender name from integration details
      let combinedName: string = `${basicDetails.title} ${basicDetails.name.forename} `
      if (basicDetails.name.middleName != null) {
        combinedName += `${basicDetails.name.middleName} `
      }
      combinedName += `${basicDetails.name.surname}`
      // eslint-disable-next-line no-param-reassign
      breachNotice.titleAndFullName = `${combinedName}`
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
          address.buildingNumber.concat(` ${address.streetName}`).trim(),
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
          address.buildingNumber.concat(` ${address.streetName}`).trim(),
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

  async function showDraftPdf(id: string, res: Response) {
    res.redirect(`/pdf/${id}`)
  }

  return router
}
