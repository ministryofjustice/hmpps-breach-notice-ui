import { Router } from 'express'
import AuditService, { Page } from '../services/auditService'
import BreachNoticeApiClient, { BreachNotice, BreachNoticeAddress } from '../data/breachNoticeApiClient'
import { HmppsAuthClient } from '../data'
import { ErrorMessages } from '../data/uiModels'
import { handleIntegrationErrors } from '../utils/utils'

export default function addAddressRoutes(
  router: Router,
  auditService: AuditService,
  hmppsAuthClient: HmppsAuthClient,
): Router {
  router.get('/add-address/:id', async (req, res, next) => {
    await auditService.logPageView(Page.ADD_ADDRESS, { who: res.locals.user.username, correlationId: req.id })
    const token = await hmppsAuthClient.getSystemClientToken(res.locals.user.username)
    const breachNoticeApiClient = new BreachNoticeApiClient(token)
    const address: BreachNoticeAddress = null

    try {
      // get the existing breach notice
      await breachNoticeApiClient.getBreachNoticeById(req.params.id as string)
    } catch (error) {
      const errorMessages: ErrorMessages = handleIntegrationErrors(error.status, error.data?.message, 'Breach Notice')
      const showEmbeddedError = true
      // always stay on page and display the error when there are isssues retrieving the breach notice
      res.render(`pages/add-address`, { errorMessages, showEmbeddedError })
      return
    }

    res.render('pages/add-address', { address })
  })

  router.post('/add-address/:id', async (req, res, next) => {
    const token = await hmppsAuthClient.getSystemClientToken(res.locals.user.username)
    const breachNoticeApiClient = new BreachNoticeApiClient(token)
    const { id } = req.params

    // if cancel selected skip right back
    if (req.body.action === 'cancel') {
      res.redirect(`/basic-details/${id}`)
    } else {
      const address: BreachNoticeAddress = {
        addressId: -1,
        officeDescription: req.body.officeDescription,
        buildingName: req.body.buildingName,
        buildingNumber: req.body.buildingNumber,
        county: req.body.county,
        district: req.body.district,
        postcode: req.body.postcode,
        status: 'Default',
        streetName: req.body.streetName,
        townCity: req.body.townCity,
      }

      const errorMessages: ErrorMessages = validateAddress(address)
      const hasErrors: boolean = Object.keys(errorMessages).length > 0

      if (!hasErrors) {
        try {
          const breachNotice: BreachNotice = await breachNoticeApiClient.getBreachNoticeById(id as string)
          breachNotice.replyAddress = address
          await breachNoticeApiClient.updateBreachNotice(id, breachNotice)
          res.redirect(`/basic-details/${id}`)
        } catch (error) {
          const integrationErrorMessages = handleIntegrationErrors(error.status, error.data?.message, 'Breach Notice')
          const showEmbeddedError = true
          // always stay on page and display the error when there are isssues retrieving the breach notice
          res.render(`pages/add-address`, { errorMessages, showEmbeddedError, integrationErrorMessages })
        }
      } else {
        res.render('pages/add-address', { errorMessages, address })
      }
    }
  })

  function validateAddress(address: BreachNoticeAddress): ErrorMessages {
    const errorMessages: ErrorMessages = {}

    if (
      (!address.officeDescription || address.officeDescription.trim() === '') &&
      (!address.buildingName || address.buildingName.trim() === '') &&
      (!address.buildingNumber || address.buildingNumber.trim() === '')
    ) {
      errorMessages.identifier = {
        text: 'At least 1 out of [Description, Building Name, House Number] must be present',
      }
    }

    if (!address.streetName || address.streetName.trim() === '') {
      errorMessages.streetName = {
        text: 'Street Name : This is a required value, please enter a value',
      }
    }

    if (!address.townCity || address.townCity.trim() === '') {
      errorMessages.townCity = {
        text: 'Town/City : This is a required value, please enter a value',
      }
    }

    if (!address.county || address.county.trim() === '') {
      errorMessages.county = {
        text: 'County : This is a required value, please enter a value',
      }
    }

    if (!address.postcode || address.postcode.trim() === '') {
      errorMessages.postcode = {
        text: 'Postcode : This is a required value, please enter a value',
      }
    }

    return errorMessages
  }

  return router
}
