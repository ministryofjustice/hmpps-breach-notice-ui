import { Router } from 'express'
import { AuthenticationClient } from '@ministryofjustice/hmpps-auth-clients'
import AuditService, { Page } from '../services/auditService'
import BreachNoticeApiClient, { BreachNotice, BreachNoticeAddress } from '../data/breachNoticeApiClient'
import { ErrorMessages } from '../data/uiModels'
import { handleIntegrationErrors } from '../utils/utils'

export default function addAddressRoutes(
  router: Router,
  auditService: AuditService,
  authenticationClient: AuthenticationClient,
): Router {
  router.get('/add-address/:id', async (req, res) => {
    await auditService.logPageView(Page.ADD_ADDRESS, { who: res.locals.user.username, correlationId: req.id })
    const { id } = req.params
    const breachNoticeApiClient = new BreachNoticeApiClient(authenticationClient)
    let breachNotice: BreachNotice = null

    try {
      // get the existing breach notice
      breachNotice = await breachNoticeApiClient.getBreachNoticeById(id as string, res.locals.user.username)
    } catch (error) {
      const errorMessages: ErrorMessages = handleIntegrationErrors(
        error.responseStatus,
        error.data?.message,
        'Breach Notice',
      )
      const showEmbeddedError = true
      // always stay on page and display the error when there are isssues retrieving the breach notice
      res.render(`pages/add-address`, { errorMessages, showEmbeddedError })
      return
    }

    const address = breachNotice.replyAddress
    res.render('pages/add-address', { address })
  })

  router.post('/add-address/:id', async (req, res) => {
    const breachNoticeApiClient = new BreachNoticeApiClient(authenticationClient)
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
          const breachNotice: BreachNotice = await breachNoticeApiClient.getBreachNoticeById(
            id as string,
            res.locals.user.username,
          )
          if (breachNotice.replyAddress) {
            address.id = breachNotice.replyAddress.id
          }
          breachNotice.replyAddress = address
          await breachNoticeApiClient.updateBreachNotice(id, breachNotice, res.locals.user.username)
          res.redirect(`/basic-details/${id}`)
        } catch (error) {
          const integrationErrorMessages = handleIntegrationErrors(
            error.responseStatus,
            error.data?.message,
            'Breach Notice',
          )
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

    // Over length
    if (address.officeDescription && address.officeDescription.length > 50) {
      errorMessages.description = {
        text: 'Description: The information entered is over the character limit specified for this field (50). Please edit and try again.',
      }
    }

    if (address.buildingName && address.buildingName.length > 35) {
      errorMessages.buildingName = {
        text: 'Building Name: The information entered is over the character limit specified for this field (35). Please edit and try again.',
      }
    }

    if (address.buildingNumber && address.buildingNumber.length > 35) {
      errorMessages.buildingNumber = {
        text: 'House Number: The information entered is over the character limit specified for this field (35). Please edit and try again.',
      }
    }

    if (address.streetName && address.streetName.length > 35) {
      errorMessages.streetName = {
        text: 'Street Name: The information entered is over the character limit specified for this field (35). Please edit and try again.',
      }
    }

    if (address.district && address.district.length > 35) {
      errorMessages.district = {
        text: 'District: The information entered is over the character limit specified for this field (35). Please edit and try again.',
      }
    }

    if (address.townCity && address.townCity.length > 35) {
      errorMessages.townCity = {
        text: 'Town/City: The information entered is over the character limit specified for this field (35). Please edit and try again.',
      }
    }

    if (address.county && address.county.length > 35) {
      errorMessages.county = {
        text: 'County: The information entered is over the character limit specified for this field (35). Please edit and try again.',
      }
    }

    if (address.postcode && address.postcode.length > 8) {
      errorMessages.postcode = {
        text: 'Postcode: The information entered is over the character limit specified for this field (8). Please edit and try again.',
      }
    }

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
        text: 'Street Name : This is a required field, please enter a value',
      }
    }

    if (!address.townCity || address.townCity.trim() === '') {
      errorMessages.townCity = {
        text: 'Town/City : This is a required field, please enter a value',
      }
    }

    if (!address.county || address.county.trim() === '') {
      errorMessages.county = {
        text: 'County : This is a required field, please enter a value',
      }
    }

    if (!address.postcode || address.postcode.trim() === '') {
      errorMessages.postcode = {
        text: 'Postcode : This is a required field, please enter a value',
      }
    }

    return errorMessages
  }

  return router
}
