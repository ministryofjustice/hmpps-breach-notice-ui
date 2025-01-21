import { type RequestHandler, Router } from 'express'

import asyncMiddleware from '../middleware/asyncMiddleware'
import type { Services } from '../services'
import { Page } from '../services/auditService'
import BreachNoticeApiClient, { Address, BasicDetails, BreachNotice, Name } from '../data/breachNoticeApiClient'

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export default function routes({ auditService, hmppsAuthClient }: Services): Router {
  const router = Router()
  const get = (path: string | string[], handler: RequestHandler) => router.get(path, asyncMiddleware(handler))

  get('/', async (req, res, next) => {
    await auditService.logPageView(Page.EXAMPLE_PAGE, { who: res.locals.user.username, correlationId: req.id })
    const breachNoticeApiClient = new BreachNoticeApiClient(await hmppsAuthClient.getSystemClientToken())
    await breachNoticeApiClient.getBreachNoticeById('14b526a6-dec8-4a44-9c1c-435fa024820c')
    const breachNotice = await breachNoticeApiClient.getBreachNoticeById('14b526a6-dec8-4a44-9c1c-435fa024820c')
    res.render('pages/basic-details', { breachNotice })
  })

  get('/breach-notice', async (req, res, next) => {
    await auditService.logPageView(Page.EXAMPLE_PAGE, { who: res.locals.user.username, correlationId: req.id })
    const breachNoticeApiClient = new BreachNoticeApiClient(await hmppsAuthClient.getSystemClientToken())
    const breachNoticeId = req.query.uuid
    const basicDetails: BasicDetails = createDummyBasicDetails()
    let breachNotice: BreachNotice = null
    breachNotice = await breachNoticeApiClient.getBreachNoticeById(breachNoticeId as string)
    res.render('pages/basic-details', { breachNotice, basicDetails })
  })

  get('/warning-details', async (req, res, next) => {
    await auditService.logPageView(Page.EXAMPLE_PAGE, { who: res.locals.user.username, correlationId: req.id })
    const breachNoticeApiClient = new BreachNoticeApiClient(await hmppsAuthClient.getSystemClientToken())
    const breachNotice = await breachNoticeApiClient.getBreachNoticeById('14b526a6-dec8-4a44-9c1c-435fa024820c')
    res.render('pages/warning-details', { breachNotice })
  })

  get('/warning-type', async (req, res, next) => {
    await auditService.logPageView(Page.EXAMPLE_PAGE, { who: res.locals.user.username, correlationId: req.id })
    const breachNoticeApiClient = new BreachNoticeApiClient(await hmppsAuthClient.getSystemClientToken())
    const breachNotice = await breachNoticeApiClient.getBreachNoticeById('14b526a6-dec8-4a44-9c1c-435fa024820c')
    res.render('pages/warning-type', { breachNotice })
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

  function createDummyBasicDetails(): BasicDetails {
    return {
      title: 'Mr',
      name: createDummyName(),
      addresses: createDummyAddressList(),
      replyAddresses: createDummyAddressList(),
    }
  }

  function createDummyAddressList(): Array<Address> {
    const dummyAddress: Address = {
      buildingName: 'BuildName',
      buildingNumber: '666',
      county: 'Some County',
      district: 'Some District',
      postcode: 'NE30 3AB',
      streetName: 'The Street',
      townCity: 'Newcastle',
    }

    return [dummyAddress]
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
