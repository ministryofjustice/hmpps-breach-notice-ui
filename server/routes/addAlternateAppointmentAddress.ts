import { Router } from 'express'
import AuditService, { Page } from '../services/auditService'
import BreachNoticeApiClient, { BreachNotice, BreachNoticeAddress } from '../data/breachNoticeApiClient'
import { HmppsAuthClient } from '../data'
import { ErrorMessages } from '../data/uiModels'
import { handleIntegrationErrors } from '../utils/utils'

export default function addAlternateAppointmentAddressRoutes(
  router: Router,
  auditService: AuditService,
  hmppsAuthClient: HmppsAuthClient,
): Router {
  router.get('/add-alternate-appointment-address/:breachNoticeId', async (req, res) => {
    await auditService.logPageView(Page.ADD_ADDRESS, { who: res.locals.user.username, correlationId: req.id })
    const { breachNoticeId } = req.params

    const token = await hmppsAuthClient.getSystemClientToken(res.locals.user.username)
    const breachNoticeApiClient = new BreachNoticeApiClient(token)
    let breachNotice: BreachNotice = null
    let address: BreachNoticeAddress = null

    try {
      breachNotice = await breachNoticeApiClient.getBreachNoticeById(breachNoticeId)
    } catch (error) {
      const errorMessages: ErrorMessages = handleIntegrationErrors(error.status, error.data?.message, 'Breach Notice')
      const showEmbeddedError = true
      // always stay on page and display the error when there are isssues retrieving the breach notice
      res.render(`pages/add-alternate-appointment-address`, { errorMessages, showEmbeddedError })
      return
    }

    address = breachNotice.alternateNextAppointmentLocation
    res.render('pages/add-alternate-appointment-address', { address })
  })

  router.post('/add-alternate-appointment-address/:breachNoticeId', async (req, res) => {
    const token = await hmppsAuthClient.getSystemClientToken(res.locals.user.username)
    const breachNoticeApiClient = new BreachNoticeApiClient(token)
    const { breachNoticeId } = req.params
    let breachNotice: BreachNotice = null

    // if cancel selected skip right back
    if (req.body.action === 'cancel') {
      res.redirect(`/next-appointment/${breachNoticeId}`)
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
          breachNotice = await breachNoticeApiClient.getBreachNoticeById(breachNoticeId)

          if (breachNotice.alternateNextAppointmentLocation) {
            address.id = breachNotice.alternateNextAppointmentLocation.id
          }

          breachNotice.alternateNextAppointmentLocation = address
          breachNotice.alternateNextAppointmentLocationSelected = true
          await breachNoticeApiClient.updateBreachNotice(breachNoticeId, breachNotice)
          res.redirect(`/next-appointment/${breachNoticeId}`)
        } catch (error) {
          const integrationErrorMessages = handleIntegrationErrors(error.status, error.data?.message, 'Breach Notice')
          const showEmbeddedError = true
          // always stay on page and display the error when there are isssues retrieving the breach notice
          res.render(`pages/add-alternate-appointment-address`, {
            errorMessages,
            showEmbeddedError,
            integrationErrorMessages,
          })
        }
      } else {
        res.render('pages/add-alternate-appointment-address', { errorMessages, address })
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

    // not entered when required
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
