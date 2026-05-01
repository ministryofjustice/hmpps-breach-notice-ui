import { Router } from 'express'
import { LocalDate, LocalDateTime } from '@js-joda/core'
import AuditService, { Page } from '../services/auditService'
import BreachNoticeApiClient, { BreachNotice } from '../data/breachNoticeApiClient'
import { HmppsAuthClient } from '../data'
import CommonUtils from '../services/commonUtils'
import { createBlankBreachNoticeWithId, handleIntegrationErrors } from '../utils/utils'
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

  router.get('/next-appointment/:id', async (req, res) => {
    await auditService.logPageView(Page.NEXT_APPOINTMENT, { who: res.locals.user.username, correlationId: req.id })
    const token = await hmppsAuthClient.getSystemClientToken(res.locals.user.username)
    const breachNoticeApiClient = new BreachNoticeApiClient(token)
    const ndeliusIntegrationApiClient = new NdeliusIntegrationApiClient(token)
    let breachNotice: BreachNotice
    let nextAppointmentDetails: NextAppointmentDetails = null

    const { id } = req.params

    try {
      // get the existing breach notice
      breachNotice = await breachNoticeApiClient.getBreachNoticeById(id as string)
    } catch (error) {
      const errorMessages: ErrorMessages = handleIntegrationErrors(error.status, error.data?.message, 'Breach Notice')
      const showEmbeddedError = true
      breachNotice = createBlankBreachNoticeWithId(req.params.id)
      // always stay on page and display the error when there are isssues retrieving the breach notice
      res.render(`pages/next-appointment`, { errorMessages, showEmbeddedError, breachNotice })
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
        breachNotice = createBlankBreachNoticeWithId(req.params.id)
        res.render('pages/next-appointment', { errorMessages, showEmbeddedError, breachNotice })
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
    const testBoolean: string = null
    const selectNextAppointment =
      breachNotice.selectNextAppointment === null || !breachNotice.selectNextAppointment ? 'No' : 'Yes'

    let useAboveAddress: boolean = null
    let showAddAddress: boolean = null
    let showUpdateAddress: boolean = null

    if (
      breachNotice.alternateNextAppointmentLocationSelected !== null &&
      breachNotice.alternateNextAppointmentLocationSelected === true
    ) {
      useAboveAddress = false
      if (
        breachNotice.alternateNextAppointmentLocation &&
        breachNotice.alternateNextAppointmentLocation.addressId !== null
      ) {
        showUpdateAddress = true
        showAddAddress = false
      }

      if (
        breachNotice.alternateNextAppointmentLocation === null ||
        breachNotice.alternateNextAppointmentLocation.addressId === null
      ) {
        showUpdateAddress = false
        showAddAddress = true
      }
    }

    if (
      breachNotice.alternateNextAppointmentLocationSelected !== null &&
      breachNotice.alternateNextAppointmentLocationSelected === false
    ) {
      useAboveAddress = true

      if (
        breachNotice.alternateNextAppointmentLocation &&
        breachNotice.alternateNextAppointmentLocation.addressId !== null
      ) {
        showUpdateAddress = true
        showAddAddress = false
      }

      if (
        breachNotice.alternateNextAppointmentLocation === null ||
        breachNotice.alternateNextAppointmentLocation.addressId === null
      ) {
        showUpdateAddress = false
        showAddAddress = true
      }
    }

    // need to default to add address if still null after above checks
    if (showUpdateAddress === null && showAddAddress === null) {
      showAddAddress = true
    }

    res.render('pages/next-appointment', {
      breachNotice,
      nextAppointmentDetails,
      appointmentRadioButtons,
      responsibleOfficerDisplayValue,
      useContactNumber,
      currentPage,
      selectNextAppointment,
      testBoolean,
      useAboveAddress,
      showAddAddress,
      showUpdateAddress,
    })
  })

  router.post('/next-appointment/:id', async (req, res) => {
    await auditService.logPageView(Page.NEXT_APPOINTMENT, { who: res.locals.user.username, correlationId: req.id })
    const token = await hmppsAuthClient.getSystemClientToken(res.locals.user.username)
    const ndeliusIntegrationApiClient = new NdeliusIntegrationApiClient(token)
    const breachNoticeApiClient = new BreachNoticeApiClient(token)
    const callingScreen: string = req.query.returnTo as string
    const submitAction: string = req.body.action
    let useRegularAddressValue: string = null
    let originalNextAppointmentId: number = null
    let selectedNextAppointmentId: number = null

    const useRegularAddressSelections = Object.entries(req.body).filter(([key]) => key.startsWith('altAddressRadio_'))

    if (useRegularAddressSelections && Object.keys(useRegularAddressSelections).length > 0) {
      let useRegAddressListItem = null

      for (const regularAddressItem of useRegularAddressSelections) {
        const appointmentIdOfRadioButton: number = Number(regularAddressItem[0].split('altAddressRadio_', 2)[1])
        if (appointmentIdOfRadioButton === Number(req.body.appointmentSelection)) {
          useRegAddressListItem = regularAddressItem
          break
        }
      }

      if (useRegAddressListItem) {
        // need to make sure it belongs to the selected item
        const appointmentIdOfRadioButton: number = Number(useRegAddressListItem[0].split('altAddressRadio_', 2)[1])

        if (appointmentIdOfRadioButton === Number(req.body.appointmentSelection)) {
          useRegularAddressValue = useRegAddressListItem[1] as unknown as string
        }
      }
    }

    const { id } = req.params
    let breachNotice: BreachNotice = null
    let nextAppointmentDetails: NextAppointmentDetails = null

    try {
      breachNotice = await breachNoticeApiClient.getBreachNoticeById(id as string)
      originalNextAppointmentId = breachNotice.nextAppointmentId
      selectedNextAppointmentId = Number(req.body.appointmentSelection)

      // if the ids have changed we need to delete the previous selections first
      if (originalNextAppointmentId && selectedNextAppointmentId) {
        if (originalNextAppointmentId !== selectedNextAppointmentId) {
          breachNotice.nextAppointmentId = null
          breachNotice.selectNextAppointment = null
          breachNotice.alternateNextAppointmentLocation = null
          breachNotice.alternateNextAppointmentLocationSelected = null
        }

        if (originalNextAppointmentId === selectedNextAppointmentId) {
          const useRegAddressSelections = Object.entries(req.body).filter(([key]) => key.startsWith('altAddressRadio_'))

          if (useRegAddressSelections && Object.keys(useRegAddressSelections).length > 0) {
            let useRegAddressListItem = null

            for (const regularAddressItem of useRegAddressSelections) {
              const appointmentIdOfRadioButton: number = Number(regularAddressItem[0].split('altAddressRadio_', 2)[1])
              if (appointmentIdOfRadioButton === Number(req.body.appointmentSelection)) {
                useRegAddressListItem = regularAddressItem
                break
              }
            }
            const appointmentIdOfRadioButton: number = Number(useRegAddressListItem[0].split('altAddressRadio_', 2)[1])

            // check it matrches appointment - find selected appointment
            if (appointmentIdOfRadioButton === Number(req.body.appointmentSelection)) {
              const newUseRegularAddressValue = useRegAddressListItem[1] as unknown as string
              let savedUsedRegularAddressValue: boolean = null

              if (newUseRegularAddressValue === 'Yes') {
                // to get the old value we need to flip the saved one - only concerned where alternate address was used and now its not
                if (
                  breachNotice.alternateNextAppointmentLocationSelected !== null &&
                  breachNotice.alternateNextAppointmentLocationSelected
                ) {
                  savedUsedRegularAddressValue = false
                }

                if (
                  breachNotice.alternateNextAppointmentLocationSelected !== null &&
                  !breachNotice.alternateNextAppointmentLocationSelected
                ) {
                  savedUsedRegularAddressValue = true
                }

                // we have switched from use alternate address to use above address which requires address deletion
                if (savedUsedRegularAddressValue === false) {
                  breachNotice.alternateNextAppointmentLocation = null
                  breachNotice.alternateNextAppointmentLocationSelected = null
                }
              }
            }
          }
        }
      }
    } catch (error) {
      const errorMessages: ErrorMessages = handleIntegrationErrors(error.status, error.data?.message, 'Breach Notice')
      const showEmbeddedError = true
      breachNotice = createBlankBreachNoticeWithId(req.params.id)
      // always stay on page and display the error when there are isssues retrieving the breach notice
      res.render(`pages/next-appointment`, { errorMessages, showEmbeddedError, breachNotice })
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
        breachNotice = createBlankBreachNoticeWithId(req.params.id)
        res.render('pages/next-appointment', { errorMessages, showEmbeddedError, breachNotice })
        return
      }
      res.render('pages/detailed-error', { errorMessages })
      return
    }

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

    // we need to invert the boolean value so Yes = No, No = Yes
    if (useRegularAddressValue) {
      if (useRegularAddressValue === 'Yes') {
        breachNotice.alternateNextAppointmentLocationSelected = false
      }

      if (useRegularAddressValue === 'No') {
        breachNotice.alternateNextAppointmentLocationSelected = true
      }
    }

    const errorMessages: ErrorMessages = performValidation(breachNotice)
    const hasErrors: boolean = Object.keys(errorMessages).length > 0

    if (!hasErrors && submitAction !== 'refreshData') {
      breachNotice.nextAppointmentSaved = true
      await breachNoticeApiClient.updateBreachNotice(id, breachNotice)

      if (submitAction === 'saveProgressAndClose') {
        res.send(
          `<p>You can now safely close this window</p><script nonce="${res.locals.cspNonce}">window.close()</script>`,
        )
      } else if (submitAction && submitAction.includes('alternateAddressForAppointment_')) {
        // const ndeliusContactId: string = submitAction.split('alternateAddressForAppointment_',2)[1]
        res.redirect(`/add-alternate-appointment-address/${id}`)
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

      let useAboveAddress: boolean = null
      let showAddAddress: boolean = null
      let showUpdateAddress: boolean = null

      if (
        breachNotice.alternateNextAppointmentLocationSelected !== null &&
        breachNotice.alternateNextAppointmentLocationSelected === true
      ) {
        useAboveAddress = false
        // check if the curretnly selected thing has an address
        if (
          breachNotice.alternateNextAppointmentLocation &&
          breachNotice.alternateNextAppointmentLocation.addressId !== null
        ) {
          showUpdateAddress = true
          showAddAddress = false
        }

        if (
          breachNotice.alternateNextAppointmentLocation === null ||
          breachNotice.alternateNextAppointmentLocation.addressId === null
        ) {
          showUpdateAddress = false
          showAddAddress = true
        }
      }

      if (
        breachNotice.alternateNextAppointmentLocationSelected !== null &&
        breachNotice.alternateNextAppointmentLocationSelected === false
      ) {
        useAboveAddress = true
        // do something with location
        if (
          breachNotice.alternateNextAppointmentLocation &&
          breachNotice.alternateNextAppointmentLocation.addressId !== null
        ) {
          showUpdateAddress = true
          showAddAddress = false
        }

        if (
          breachNotice.alternateNextAppointmentLocation === null ||
          breachNotice.alternateNextAppointmentLocation.addressId === null
        ) {
          showUpdateAddress = false
          showAddAddress = true
        }
      }

      res.render('pages/next-appointment', {
        breachNotice,
        nextAppointmentDetails,
        appointmentRadioButtons,
        responsibleOfficerDisplayValue,
        useContactNumber,
        errorMessages,
        currentPage,
        selectNextAppointment,
        useAboveAddress,
        showAddAddress,
        showUpdateAddress,
      })
    }
  })

  function performValidation(breachNotice: BreachNotice): ErrorMessages {
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

    if (breachNotice.selectNextAppointment) {
      if (breachNotice.nextAppointmentId != null) {
        // check we have answered yes or no
        if (breachNotice.alternateNextAppointmentLocationSelected === null) {
          errorMessages.nextAppointmentNoAddressSelection = {
            text: 'Please enter a value for Do you want to use the address above?',
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
