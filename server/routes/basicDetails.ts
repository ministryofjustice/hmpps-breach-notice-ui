import { type Response, Router } from 'express'
import { LocalDate, LocalDateTime } from '@js-joda/core'
import AuditService, { Page } from '../services/auditService'
import BreachNoticeApiClient, {
  Address,
  AddressList,
  BasicDetails,
  BreachNotice,
  ErrorMessages,
  Name,
  SelectItem,
} from '../data/breachNoticeApiClient'
import { fromUserDate, toUserDate } from '../utils/dateUtils'
import { HmppsAuthClient } from '../data'

export default function basicDetailsRoutes(
  router: Router,
  auditService: AuditService,
  hmppsAuthClient: HmppsAuthClient,
): Router {
  router.get('/basic-details/:id', async (req, res, next) => {
    await auditService.logPageView(Page.BASIC_DETAILS, { who: res.locals.user.username, correlationId: req.id })
    const breachNoticeApiClient = new BreachNoticeApiClient(
      await hmppsAuthClient.getSystemClientToken(res.locals.user.username),
    )
    const { id } = req.params
    const basicDetails = createDummyBasicDetails()
    const breachNotice = applyDefaults(await breachNoticeApiClient.getBreachNoticeById(id as string), basicDetails)
    const alternateAddressOptions = addressListToSelectItemList(
      basicDetails.addresses,
      breachNotice.basicDetailsSaved,
      breachNotice.offenderAddress?.addressId,
    )
    const replyAddressOptions = addressListToSelectItemList(
      basicDetails.replyAddresses,
      breachNotice.basicDetailsSaved,
      breachNotice.replyAddress?.addressId,
    )

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

  router.post('/basic-details/:id', async (req, res, next) => {
    const breachNoticeApiClient = new BreachNoticeApiClient(
      await hmppsAuthClient.getSystemClientToken(res.locals.user.username),
    )
    const { id } = req.params
    const basicDetails = createDummyBasicDetails()
    const breachNotice = applyDefaults(await breachNoticeApiClient.getBreachNoticeById(id as string), basicDetails)
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
    let hasErrors: boolean = Object.keys(errorMessages).length > 0

    if (!hasErrors) {
      // mark that a USER has saved the document at least once
      breachNotice.basicDetailsSaved = true
      await breachNoticeApiClient.updateBreachNotice(id, breachNotice)

      if (req.body.action === 'viewDraft') {
        try {
          await showDraftPdf(breachNotice.id, res)
        } catch {
          // Render the page with the new error
          errorMessages.pdfRenderError = {
            text: 'There was an issue generating the draft report. Please try again or contact support.',
          }

          hasErrors = true
        }
      } else if (req.body.action === 'saveProgressAndClose') {
        res.send(`<script nonce="${res.locals.cspNonce}">window.close()</script>`)
      } else {
        res.redirect(`/warning-type/${req.params.id}`)
      }
    }

    if (hasErrors) {
      const alternateAddressOptions = addressListToSelectItemList(
        basicDetails.addresses,
        breachNotice.basicDetailsSaved,
        breachNotice.offenderAddress?.addressId,
      )
      const replyAddressOptions = addressListToSelectItemList(
        basicDetails.replyAddresses,
        breachNotice.basicDetailsSaved,
        breachNotice.replyAddress?.addressId,
      )

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
  })

  function validateBasicDetails(breachNotice: BreachNotice, userEnteredDateOfLetter: string): ErrorMessages {
    const errorMessages: ErrorMessages = {}
    const currentDateAtStartOfTheDay: LocalDateTime = LocalDate.now().atStartOfDay()
    if (breachNotice.referenceNumber && breachNotice.referenceNumber.trim().length > 30) {
      errorMessages.officeReferenceNumber = {
        text: 'The Office Reference entered is greater than the 30 character limit.',
      }
    }

    try {
      // eslint-disable-next-line no-param-reassign
      breachNotice.dateOfLetter = fromUserDate(userEnteredDateOfLetter)
    } catch {
      // eslint-disable-next-line no-param-reassign
      breachNotice.dateOfLetter = userEnteredDateOfLetter
      errorMessages.dateOfLetter = {
        text: 'The proposed date for this letter is in an invalid format, please use the correct format e.g 17/5/2024',
      }
      // we cant continue with date validation
      return errorMessages
    }

    if (breachNotice) {
      // only perform date validation if the user has entered a value
      if (breachNotice.dateOfLetter) {
        // check date of letter is not before today
        const localDateOfLetterAtStartOfDay = LocalDate.parse(breachNotice.dateOfLetter).atStartOfDay()
        if (localDateOfLetterAtStartOfDay.isBefore(currentDateAtStartOfTheDay)) {
          errorMessages.dateOfLetter = {
            text: 'The letter has not been completed and so the date cannot be before today.',
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

  // if this page hasnt been saved we want to go through and apply defaults otherwise dont do this
  function applyDefaults(breachNotice: BreachNotice, basicDetails: BasicDetails) {
    if (!breachNotice.basicDetailsSaved) {
      // only apply the defaults if basic details has NOT been saved by a USER
      return {
        ...breachNotice,
        titleAndFullName: `${basicDetails.title} ${basicDetails.name.forename} ${basicDetails.name.middleName} ${basicDetails.name.surname}`,
        useDefaultAddress: true,
        useDefaultReplyAddress: true,
      }
    }
    return breachNotice
  }

  function addressListToSelectItemList(
    addresses: AddressList,
    breachNoticeSaved: boolean,
    selectedAddressId: number,
  ): SelectItem[] {
    return [
      {
        text: 'Please Select',
        value: '-1',
        selected: true,
      },
      ...addresses.map(address => ({
        text: [
          address.buildingName,
          `${address.addressNumber} ${address.streetName}`.trim(),
          address.district,
          address.townCity,
          address.county,
          address.postcode,
        ]
          .filter(item => item)
          .join(', '),
        value: `${address.addressId}`,
        selected: breachNoticeSaved && address.addressId === selectedAddressId,
      })),
    ]
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

  async function showDraftPdf(id: string, res: Response) {
    res.redirect(`/pdf/${id}`)
  }

  return router
}
