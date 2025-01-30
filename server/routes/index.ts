import { type RequestHandler, Router } from 'express'

import { convert, DateTimeFormatter, LocalDate } from '@js-joda/core'
import asyncMiddleware from '../middleware/asyncMiddleware'
import type { Services } from '../services'
import { Page } from '../services/auditService'
import BreachNoticeApiClient, {
  Address,
  AddressList,
  BasicDetails,
  BreachNotice,
  Name,
  SelectItem,
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
    await auditService.logPageView(Page.EXAMPLE_PAGE, { who: res.locals.user.username, correlationId: req.id })
    const breachNoticeApiClient = new BreachNoticeApiClient(await hmppsAuthClient.getSystemClientToken())
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
    await auditService.logPageView(Page.EXAMPLE_PAGE, { who: res.locals.user.username, correlationId: req.id })
    const breachNoticeApiClient = new BreachNoticeApiClient(await hmppsAuthClient.getSystemClientToken())
    const breachNoticeId = req.params.id
    const basicDetails: BasicDetails = createDummyBasicDetails()
    let breachNotice: BreachNotice = null
    breachNotice = await breachNoticeApiClient.getBreachNoticeById(breachNoticeId as string)
    checkBreachNoticeAndApplyDefaults(breachNotice, basicDetails)
    console.log(req.body)
    // input variables passed in req.body
    breachNotice.dateOfLetter = fromUserDate(req.body.dateOfLetter)
    breachNotice.referenceNumber = req.body.officeReference

    // get the selected offender postal address
    if (req.body.offenderAddressSelectOne === 'No') {
      // we are using a selected address. Find it in the list
      breachNotice.offenderAddress = getSelectedAddress(basicDetails.addresses, req.body.alternateAddress)
      breachNotice.useDefaultAddress = false
    } else if (req.body.offenderAddressSelectOne === 'Yes') {
      breachNotice.useDefaultAddress = true
    } else {
      breachNotice.useDefaultAddress = null
    }

    // reply address
    if (req.body.replyAddressSelectOne === 'No') {
      breachNotice.replyAddress = getSelectedAddress(basicDetails.replyAddresses, req.body.alternateReplyAddress)
      breachNotice.useDefaultReplyAddress = false
    } else if (req.body.replyAddressSelectOne === 'Yes') {
      breachNotice.useDefaultReplyAddress = true
    } else {
      breachNotice.useDefaultReplyAddress = null
    }
    // mark that a USER has saved the document at least once
    breachNotice.basicDetailsSaved = true
    await breachNoticeApiClient.updateBreachNotice(breachNoticeId, breachNotice)
    res.redirect(`/warning-type/${req.params.id}`)
  })

  function getSelectedAddress(addressList: AddressList, addressIdentifier: string): Address {
    const addressIdentifierNumber: number = +addressIdentifier
    return addressList.find(address => address.addressId === addressIdentifierNumber)
  }

  get('/warning-details/:id', async (req, res, next) => {
    await auditService.logPageView(Page.EXAMPLE_PAGE, { who: res.locals.user.username, correlationId: req.id })
    const breachNoticeApiClient = new BreachNoticeApiClient(await hmppsAuthClient.getSystemClientToken())
    const breachNoticeId = req.params.id
    let breachNotice: BreachNotice = null
    breachNotice = await breachNoticeApiClient.getBreachNoticeById(breachNoticeId as string)
    res.render(`pages/warning-details`, {
      breachNotice,
    })
  })

  get('/warning-type/:id', async (req, res, next) => {
    await auditService.logPageView(Page.EXAMPLE_PAGE, { who: res.locals.user.username, correlationId: req.id })
    const breachNoticeApiClient = new BreachNoticeApiClient(await hmppsAuthClient.getSystemClientToken())
    const breachNoticeId = req.params.id
    let breachNotice: BreachNotice = null
    breachNotice = await breachNoticeApiClient.getBreachNoticeById(breachNoticeId as string)
    res.render('pages/warning-type', {
      breachNotice,
    })
  })

  get('/next-appointment/:id', async (req, res, next) => {
    await auditService.logPageView(Page.EXAMPLE_PAGE, { who: res.locals.user.username, correlationId: req.id })
    const breachNoticeApiClient = new BreachNoticeApiClient(await hmppsAuthClient.getSystemClientToken())
    const breachNoticeId = req.params.id
    let breachNotice: BreachNotice = null
    breachNotice = await breachNoticeApiClient.getBreachNoticeById(breachNoticeId as string)
    res.render('pages/next-appointment', {
      breachNotice,
    })
  })

  get('/check-your-report/:id', async (req, res, next) => {
    await auditService.logPageView(Page.EXAMPLE_PAGE, { who: res.locals.user.username, correlationId: req.id })
    const breachNoticeApiClient = new BreachNoticeApiClient(await hmppsAuthClient.getSystemClientToken())
    const breachNoticeId = req.params.id
    let breachNotice: BreachNotice = null
    breachNotice = await breachNoticeApiClient.getBreachNoticeById(breachNoticeId as string)
    res.render('pages/check-your-report', {
      breachNotice,
    })
  })

  get('/basic-details', async (req, res, next) => {
    await auditService.logPageView(Page.EXAMPLE_PAGE, { who: res.locals.user.username, correlationId: req.id })
    res.render('pages/basic-details')
  })

  get('/report-completed/:id', async (req, res, next) => {
    await auditService.logPageView(Page.EXAMPLE_PAGE, { who: res.locals.user.username, correlationId: req.id })
    const breachNoticeApiClient = new BreachNoticeApiClient(await hmppsAuthClient.getSystemClientToken())
    const breachNoticeId = req.params.id
    let breachNotice: BreachNotice = null
    breachNotice = await breachNoticeApiClient.getBreachNoticeById(breachNoticeId as string)
    res.render('pages/report-completed', {
      breachNotice,
    })
  })

  get('/report-deleted/:id', async (req, res, next) => {
    await auditService.logPageView(Page.EXAMPLE_PAGE, { who: res.locals.user.username, correlationId: req.id })
    const breachNoticeApiClient = new BreachNoticeApiClient(await hmppsAuthClient.getSystemClientToken())
    const breachNoticeId = req.params.id
    let breachNotice: BreachNotice = null
    breachNotice = await breachNoticeApiClient.getBreachNoticeById(breachNoticeId as string)
    res.render('pages/report-deleted', {
      breachNotice,
    })
  })

  // if this page hasnt been saved we want to go through and apply defaults otherwise dont do this
  function checkBreachNoticeAndApplyDefaults(breachNotice: BreachNotice, basicDetails: BasicDetails) {
    // eslint-disable-next-line no-param-reassign
    breachNotice.titleAndFullName = `${basicDetails.title} ${basicDetails.name.forename} ${basicDetails.name.middleName} ${
      basicDetails.name.surname
    }`
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

  function findDefaultReplyInAddressList(addressList: Array<Address>): Address {
    // this functionality will change once we have the default reply address code
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

  return router
}
