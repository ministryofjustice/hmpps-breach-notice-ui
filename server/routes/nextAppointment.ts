import { Router } from 'express'
import { LocalDate, LocalDateTime } from '@js-joda/core'
import AuditService, { Page } from '../services/auditService'
import BreachNoticeApiClient, { BreachNotice } from '../data/breachNoticeApiClient'
import { HmppsAuthClient } from '../data'
import CommonUtils from '../services/commonUtils'
import { handleIntegrationErrors } from '../utils/utils'
import { toUserDate, toUserTime } from '../utils/dateUtils'
import NdeliusIntegrationApiClient, {
  DeliusAddress,
  FutureAppointment,
  Name,
  NextAppointmentDetails,
} from '../data/ndeliusIntegrationApiClient'
import { ErrorMessages, RadioButton } from '../data/uiModels'

export default function nextAppointmentRoutes(
  router: Router,
  auditService: AuditService,
  hmppsAuthClient: HmppsAuthClient,
  commonUtils: CommonUtils,
): Router {
  const currentPage = 'next-appointment'

  router.get('/next-appointment/:id', async (req, res, next) => {
    await auditService.logPageView(Page.NEXT_APPOINTMENT, { who: res.locals.user.username, correlationId: req.id })
    const token = await hmppsAuthClient.getSystemClientToken(res.locals.user.username)
    const breachNoticeApiClient = new BreachNoticeApiClient(token)
    const ndeliusIntegrationApiClient = new NdeliusIntegrationApiClient(token)
    let breachNotice: BreachNotice = null
    let nextAppointmentDetails: NextAppointmentDetails = null

    const { id } = req.params

    try {
      // get the existing breach notice
      breachNotice = await breachNoticeApiClient.getBreachNoticeById(id as string)
    } catch (error) {
      const errorMessages: ErrorMessages = handleIntegrationErrors(error.status, error.data?.message, 'Breach Notice')
      const showEmbeddedError = true
      // always stay on page and display the error when there are isssues retrieving the breach notice
      res.render(`pages/next-appointment`, { errorMessages, showEmbeddedError })
      return
    }

    try {
      nextAppointmentDetails = await ndeliusIntegrationApiClient.getNextAppointmentDetails(breachNotice.crn)
    } catch (error) {
      const errorMessages: ErrorMessages = handleIntegrationErrors(
        error.status,
        error.data?.message,
        'NDelius Integration',
      )
      // take the user to detailed error page for 400 type errors
      if (error.status === 400) {
        res.render('pages/detailed-error', { errorMessages })
        return
      }
      // stay on the current page for 500 errors
      if (error.status === 500) {
        const showEmbeddedError = true
        res.render('pages/next-appointment', { errorMessages, showEmbeddedError })
        return
      }
      res.render('pages/detailed-error', { errorMessages })
      return
    }

    nextAppointmentDetails.futureAppointments = filterAppointments(nextAppointmentDetails.futureAppointments)
    const appointmentRadioButtons: Array<RadioButton> = initiateNextAppointmentRadioButtonsAndApplySavedSelections(
      nextAppointmentDetails.futureAppointments,
      breachNotice,
    )
    const responsibleOfficerDisplayValue = officerDisplayValue(nextAppointmentDetails.responsibleOfficer.name)
    if (await commonUtils.redirectRequired(breachNotice, res)) return
    const useContactNumber = breachNotice.optionalNumberChecked ? 'No' : 'Yes'
    const selectNextAppointment =
      breachNotice.selectNextAppointment === null || !breachNotice.selectNextAppointment ? 'No' : 'Yes'

    res.render('pages/next-appointment', {
      breachNotice,
      nextAppointmentDetails,
      appointmentRadioButtons,
      responsibleOfficerDisplayValue,
      useContactNumber,
      currentPage,
      selectNextAppointment,
    })
  })

  router.post('/next-appointment/:id', async (req, res, next) => {
    await auditService.logPageView(Page.NEXT_APPOINTMENT, { who: res.locals.user.username, correlationId: req.id })
    const token = await hmppsAuthClient.getSystemClientToken(res.locals.user.username)
    const ndeliusIntegrationApiClient = new NdeliusIntegrationApiClient(token)
    const breachNoticeApiClient = new BreachNoticeApiClient(token)
    const callingScreen: string = req.query.returnTo as string

    const { id } = req.params
    let breachNotice: BreachNotice = null
    breachNotice = await breachNoticeApiClient.getBreachNoticeById(id as string)
    const nextAppointmentDetails = await ndeliusIntegrationApiClient.getNextAppointmentDetails(breachNotice.crn)
    if (await commonUtils.redirectRequired(breachNotice, res)) return

    if (req.body.useContactNumber === 'No') {
      breachNotice.optionalNumberChecked = true
      breachNotice.optionalNumber = req.body.contactByPhone
      breachNotice.contactNumber = req.body.contactByPhone
    } else {
      breachNotice.optionalNumberChecked = false
      breachNotice.contactNumber = nextAppointmentDetails.responsibleOfficer.telephoneNumber
      breachNotice.optionalNumber = null
    }

    breachNotice.selectNextAppointment = req.body.selectNextAppointment === 'Yes'
    if (breachNotice.selectNextAppointment) {
      nextAppointmentDetails.futureAppointments
        .filter(
          (futureAppointment: FutureAppointment) => futureAppointment.id === Number(req.body.appointmentSelection),
        )
        .forEach((futureAppointment: FutureAppointment) => {
          breachNotice.nextAppointmentId = futureAppointment.id
          breachNotice.nextAppointmentDate = futureAppointment.datetime
          breachNotice.nextAppointmentType = futureAppointment.type.description
          breachNotice.nextAppointmentLocation = locationDisplayValue(futureAppointment.location)
          breachNotice.nextAppointmentOfficer = officerDisplayValue(futureAppointment.officer.name)
        })
    } else {
      breachNotice.nextAppointmentId = null
      breachNotice.nextAppointmentDate = null
      breachNotice.nextAppointmentType = null
      breachNotice.nextAppointmentLocation = null
      breachNotice.nextAppointmentOfficer = null
    }
    breachNotice.responsibleOfficer = officerDisplayValue(nextAppointmentDetails.responsibleOfficer.name)

    const errorMessages: ErrorMessages = validateNextAppointment(breachNotice)
    const hasErrors: boolean = Object.keys(errorMessages).length > 0

    if (!hasErrors && req.body.action !== 'refreshData') {
      breachNotice.nextAppointmentSaved = true
      await breachNoticeApiClient.updateBreachNotice(id, breachNotice)

      if (req.body.action === 'saveProgressAndClose') {
        res.send(
          `<p>You can now safely close this window</p><script nonce="${res.locals.cspNonce}">window.close()</script>`,
        )
      } else if (callingScreen && callingScreen === 'check-your-report') {
        res.redirect(`/check-your-report/${id}`)
      } else {
        res.redirect(`/check-your-report/${id}`)
      }
    } else {
      nextAppointmentDetails.futureAppointments = filterAppointments(nextAppointmentDetails.futureAppointments)
      const appointmentRadioButtons: Array<RadioButton> = initiateNextAppointmentRadioButtonsAndApplySavedSelections(
        nextAppointmentDetails.futureAppointments,
        breachNotice,
      )
      const responsibleOfficerDisplayValue = officerDisplayValue(nextAppointmentDetails.responsibleOfficer.name)
      const useContactNumber = breachNotice.optionalNumberChecked ? 'No' : 'Yes'
      const selectNextAppointment =
        breachNotice.selectNextAppointment === null || !breachNotice.selectNextAppointment ? 'No' : 'Yes'

      res.render('pages/next-appointment', {
        breachNotice,
        nextAppointmentDetails,
        appointmentRadioButtons,
        responsibleOfficerDisplayValue,
        useContactNumber,
        errorMessages,
        currentPage,
        selectNextAppointment,
      })
    }
  })

  function validateNextAppointment(breachNotice: BreachNotice): ErrorMessages {
    const errorMessages: ErrorMessages = {}
    if (breachNotice.optionalNumberChecked) {
      // Cannot be blank if set to use custom number
      if (!breachNotice.optionalNumber || breachNotice.optionalNumber.trim().length === 0) {
        errorMessages.contactByPhone = {
          text: 'A number is required when using a different contact number.',
        }
      } else if (breachNotice.optionalNumber.length > 35) {
        // Number needs to be 35 chars max to match NDelius DB
        errorMessages.contactByPhone = {
          text: 'The contact number entered is invalid. Numbers must be less than 35 characters long.',
        }
      } else {
        const regex = /^[0-9]*$/
        if (!regex.test(breachNotice.optionalNumber.replace(' ', ''))) {
          errorMessages.contactByPhone = {
            text: 'The contact number entered is invalid. Numbers must consist of numerals and spaces only.',
          }
        }
      }
    }
    return errorMessages
  }

  function initiateNextAppointmentRadioButtonsAndApplySavedSelections(
    futureAppointments: Array<FutureAppointment>,
    breachNotice: BreachNotice,
  ): RadioButton[] {
    return futureAppointments.map(futureAppointment => ({
      text: [
        futureAppointment.description,
        futureAppointment.type.description,
        toUserDate(futureAppointment.datetime.substring(0, 10)),
        toUserTime(futureAppointment.datetime),
        locationDisplayValue(futureAppointment.location),
        officerDisplayValue(futureAppointment.officer.name),
      ]
        .filter(item => item)
        .join(', '),
      value: `${futureAppointment.id}`,
      selected: false,
      checked: breachNotice.nextAppointmentId && breachNotice.nextAppointmentId === futureAppointment.id,
    }))
  }

  function officerDisplayValue(officer: Name): string {
    return [officer.forename, officer.surname].filter(item => item).join(' ')
  }

  function locationDisplayValue(address?: DeliusAddress): string {
    return [address?.buildingNumber, address?.streetName].filter(item => item).join(' ')
  }

  function filterAppointments(appointments: Array<FutureAppointment>): Array<FutureAppointment> {
    return appointments
      .filter(fa => fa.datetime != null)
      .filter(fa => !LocalDateTime.parse(fa.datetime).isBefore(LocalDate.now().atStartOfDay()))
      .sort((a: FutureAppointment, b: FutureAppointment) => {
        return +new Date(a.datetime) - +new Date(b.datetime)
      })
      .slice(0, 5)
  }

  return router
}
