import { type RequestHandler, Router } from 'express'

import { convert, DateTimeFormatter, LocalDate } from '@js-joda/core'
import asyncMiddleware from '../middleware/asyncMiddleware'
import type { Services } from '../services'
import { Page } from '../services/auditService'
import BreachNoticeApiClient, {
  Address,
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
    // await auditService.logPageView(Page.EXAMPLE_PAGE, { who: res.locals.user.username, correlationId: req.id })
    // const breachNoticeApiClient = new BreachNoticeApiClient(await hmppsAuthClient.getSystemClientToken())
    // await breachNoticeApiClient.getBreachNoticeById('14b526a6-dec8-4a44-9c1c-435fa024820c')
    // const breachNotice = await breachNoticeApiClient.getBreachNoticeById('14b526a6-dec8-4a44-9c1c-435fa024820c')
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
    const alternateAddressOptions = initiatePostalAddressSelectItemList(basicDetails)
    // const replyAddressList: Array<Address> = [] as Array<SelectItem>
    res.render('pages/basic-details', { breachNotice, basicDetails, alternateAddressOptions })
  })

  post('/basic-details/:id', async (req, res, next) => {
    await auditService.logPageView(Page.EXAMPLE_PAGE, { who: res.locals.user.username, correlationId: req.id })
    const breachNoticeApiClient = new BreachNoticeApiClient(await hmppsAuthClient.getSystemClientToken())
    const breachNoticeId = req.params.id
    const basicDetails: BasicDetails = createDummyBasicDetails()
    let breachNotice: BreachNotice = null
    breachNotice = await breachNoticeApiClient.getBreachNoticeById(breachNoticeId as string)
    checkBreachNoticeAndApplyDefaults(breachNotice, basicDetails)

    console.log(`${req.body}`)
    // breachNotice.offenderAddress = req.body.alternateAddress ?? breachNotice.offenderAddress
    breachNotice.dateOfLetter = convert(
      LocalDate.parse(req.body.dateOfLetter, DateTimeFormatter.ofPattern('d/M/yyyy')),
    ).toDate()
    breachNotice.referenceNumber = req.body.officeReference
    breachNotice.basicDetailsSaved = true
    await breachNoticeApiClient.updateBreachNotice(breachNoticeId, breachNotice)
    res.redirect(`/warning-type/${req.params.id}`)
  })

  get('/warning-details', async (req, res, next) => {
    await auditService.logPageView(Page.EXAMPLE_PAGE, { who: res.locals.user.username, correlationId: req.id })
    // const breachNoticeApiClient = new BreachNoticeApiClient(await hmppsAuthClient.getSystemClientToken())
    // const breachNotice = await breachNoticeApiClient.getBreachNoticeById('14b526a6-dec8-4a44-9c1c-435fa024820c')
    res.render('pages/warning-details')
  })

  get('/warning-type/:id', async (req, res, next) => {
    // await auditService.logPageView(Page.EXAMPLE_PAGE, { who: res.locals.user.username, correlationId: req.id })
    // const breachNoticeApiClient = new BreachNoticeApiClient(await hmppsAuthClient.getSystemClientToken())
    // const breachNotice = await breachNoticeApiClient.getBreachNoticeById('14b526a6-dec8-4a44-9c1c-435fa024820c')
    // const breachNoticeId = req.params.id
    res.render('pages/warning-type')
  })

  get('/next-appointment', async (req, res, next) => {
    await auditService.logPageView(Page.EXAMPLE_PAGE, { who: res.locals.user.username, correlationId: req.id })
    const breachNoticeApiClient = new BreachNoticeApiClient(await hmppsAuthClient.getSystemClientToken())
    const breachNotice = await breachNoticeApiClient.getBreachNoticeById('14b526a6-dec8-4a44-9c1c-435fa024820c')
    res.render('pages/next-appointment', { breachNotice })
  })

  get('/check-your-report', async (req, res, next) => {
    await auditService.logPageView(Page.EXAMPLE_PAGE, { who: res.locals.user.username, correlationId: req.id })
    const breachNoticeApiClient = new BreachNoticeApiClient(await hmppsAuthClient.getSystemClientToken())
    const breachNotice = await breachNoticeApiClient.getBreachNoticeById('14b526a6-dec8-4a44-9c1c-435fa024820c')
    res.render('pages/check-your-report', { breachNotice })
  })

  get('/basic-details', async (req, res, next) => {
    await auditService.logPageView(Page.EXAMPLE_PAGE, { who: res.locals.user.username, correlationId: req.id })
    const breachNoticeApiClient = new BreachNoticeApiClient(await hmppsAuthClient.getSystemClientToken())
    const breachNotice = await breachNoticeApiClient.getBreachNoticeById('14b526a6-dec8-4a44-9c1c-435fa024820c')
    res.render('pages/basic-details', { breachNotice })
  })

  get('/report-completed', async (req, res, next) => {
    await auditService.logPageView(Page.EXAMPLE_PAGE, { who: res.locals.user.username, correlationId: req.id })
    const breachNoticeApiClient = new BreachNoticeApiClient(await hmppsAuthClient.getSystemClientToken())
    const breachNotice = await breachNoticeApiClient.getBreachNoticeById('14b526a6-dec8-4a44-9c1c-435fa024820c')
    res.render('pages/report-completed', { breachNotice })
  })

  get('/report-deleted', async (req, res, next) => {
    await auditService.logPageView(Page.EXAMPLE_PAGE, { who: res.locals.user.username, correlationId: req.id })
    res.render('pages/report-deleted')
  })

  // if its not in there populate it
  function checkBreachNoticeAndApplyDefaults(breachNotice: BreachNotice, basicDetails: BasicDetails) {
    if (breachNotice.titleAndFullName === null) {
      const fullname: string = `${basicDetails.title} ${basicDetails.name.forename} ${basicDetails.name.middleName} ${
        basicDetails.name.surname
      }`

      // eslint-disable-next-line no-param-reassign
      breachNotice.titleAndFullName = fullname
    }

    if (breachNotice.offenderAddress === null) {
      const offenderPostalAddress: Address = findDefaultAddressInAddressList(basicDetails.addresses)
      // eslint-disable-next-line no-param-reassign
      breachNotice.offenderAddress = offenderPostalAddress
    }
  }

  function initiatePostalAddressSelectItemList(basicDetails: BasicDetails): SelectItem[] {
    return [
      {
        text: 'Please Select',
        value: '-1',
        selected: true,
      },
      ...basicDetails.addresses.map(address => ({
        text: [address.townCity, address.streetName].filter(item => item).join(', '),
        value: '1',
        selected: false,
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

  function createDummyBasicDetails(): BasicDetails {
    return {
      title: 'Mr',
      name: createDummyName(),
      addresses: createDummyAddressList(),
      replyAddresses: createDummyAddressList(),
    }
  }

  function createDummyAddressList(): Array<Address> {
    const postalAddress: Address = {
      type: 'Postal',
      buildingName: 'PostalName',
      buildingNumber: '666',
      county: 'Some County',
      district: 'Some District',
      postcode: 'NE30 3AB',
      streetName: 'The Street',
      townCity: 'Newcastle',
    }

    const mainAddress: Address = {
      type: 'Main',
      buildingName: 'MainBuildingName',
      buildingNumber: '666',
      county: 'Some County',
      district: 'Some District',
      postcode: 'NE30 3AB',
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
