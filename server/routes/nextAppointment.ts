import { type RequestHandler, Router } from 'express'
import { LocalDateTime } from '@js-joda/core'
import AuditService, { Page } from '../services/auditService'
import BreachNoticeApiClient, {
  BreachNotice,
  ErrorMessages,
  FutureAppointment,
  Name,
  NextAppointmentDetails,
  Officer,
  RadioButton,
} from '../data/breachNoticeApiClient'
import { HmppsAuthClient } from '../data'
import CommonUtils from '../services/commonUtils'
import { Address } from '../data/commonModels'
import { toUserDate, toUserTime } from '../utils/dateUtils'
import asyncMiddleware from '../middleware/asyncMiddleware'

export default function nextAppointmentRoutes(
  router: Router,
  auditService: AuditService,
  hmppsAuthClient: HmppsAuthClient,
  commonUtils: CommonUtils,
): Router {
  const currentPage = 'next-appointment'
  const get = (path: string | string[], handler: RequestHandler) => router.get(path, asyncMiddleware(handler))
  const post = (path: string | string[], handler: RequestHandler) => router.post(path, asyncMiddleware(handler))

  get('/next-appointment/:id', async (req, res, next) => {
    await auditService.logPageView(Page.NEXT_APPOINTMENT, { who: res.locals.user.username, correlationId: req.id })
    const breachNoticeApiClient = new BreachNoticeApiClient(
      await hmppsAuthClient.getSystemClientToken(res.locals.user.username),
    )
    const { id } = req.params
    const nextAppointmentDetails = fetchNextAppointmentDetails()
    const breachNotice: BreachNotice = await breachNoticeApiClient.getBreachNoticeById(id as string)
    const appointmentRadioButtons: Array<RadioButton> = initiateNextAppointmentRadioButtonsAndApplySavedSelections(
      nextAppointmentDetails.futureAppointments,
      breachNotice,
    )
    const responsibleOfficerDisplayValue = officerDisplayValue(nextAppointmentDetails.responsibleOfficer.name)
    if (await commonUtils.redirectRequired(breachNotice, res)) return
    const useContactNumber = breachNotice.optionalNumberChecked ? 'No' : 'Yes'

    res.render('pages/next-appointment', {
      breachNotice,
      nextAppointmentDetails,
      appointmentRadioButtons,
      responsibleOfficerDisplayValue,
      useContactNumber,
      currentPage,
    })
  })

  post('/next-appointment/:id', async (req, res, next) => {
    const breachNoticeApiClient = new BreachNoticeApiClient(
      await hmppsAuthClient.getSystemClientToken(res.locals.user.username),
    )
    await auditService.logPageView(Page.NEXT_APPOINTMENT, { who: res.locals.user.username, correlationId: req.id })
    const { id } = req.params
    let breachNotice: BreachNotice = null
    breachNotice = await breachNoticeApiClient.getBreachNoticeById(id as string)
    const nextAppointmentDetails = fetchNextAppointmentDetails()
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

    nextAppointmentDetails.futureAppointments
      .filter(
        (futureAppointment: FutureAppointment) => futureAppointment.contactId === Number(req.body.appointmentSelection),
      )
      .forEach((futureAppointment: FutureAppointment) => {
        breachNotice.nextAppointmentId = futureAppointment.contactId
        breachNotice.nextAppointmentDate = futureAppointment.datetime
        breachNotice.nextAppointmentType = futureAppointment.type.code
        breachNotice.nextAppointmentLocation = futureAppointment.location.buildingNumber
          .concat(` ${futureAppointment.location.streetName}`)
          .trim()
        breachNotice.nextAppointmentOfficer = officerDisplayValue(futureAppointment.officer.name)
      })
    breachNotice.responsibleOfficer = officerDisplayValue(nextAppointmentDetails.responsibleOfficer.name)

    const errorMessages: ErrorMessages = validateNextAppointment(breachNotice)
    const hasErrors: boolean = Object.keys(errorMessages).length > 0

    if (!hasErrors && req.body.action !== 'refreshData') {
      breachNotice.nextAppointmentSaved = true
      await breachNoticeApiClient.updateBreachNotice(id, breachNotice)

      if (req.body.action === 'saveProgressAndClose') {
        res.send(`<script nonce="${res.locals.cspNonce}">window.close()</script>`)
      } else {
        res.redirect(`/check-your-report/${id}`)
      }
    } else {
      const appointmentRadioButtons: Array<RadioButton> = initiateNextAppointmentRadioButtonsAndApplySavedSelections(
        nextAppointmentDetails.futureAppointments,
        breachNotice,
      )
      const responsibleOfficerDisplayValue = officerDisplayValue(nextAppointmentDetails.responsibleOfficer.name)
      const useContactNumber = breachNotice.optionalNumberChecked ? 'No' : 'Yes'

      res.render('pages/next-appointment', {
        breachNotice,
        nextAppointmentDetails,
        appointmentRadioButtons,
        responsibleOfficerDisplayValue,
        useContactNumber,
        errorMessages,
        currentPage,
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
        `${futureAppointment.location.buildingNumber} ${futureAppointment.location.streetName}`.trim(),
        officerDisplayValue(futureAppointment.officer.name),
      ]
        .filter(item => item)
        .join(', '),
      value: `${futureAppointment.contactId}`,
      selected: false,
      checked: breachNotice.nextAppointmentId && breachNotice.nextAppointmentId === futureAppointment.contactId,
    }))
  }

  function officerDisplayValue(officer: Name): string {
    return [officer.forename, officer.middleName, officer.surname].filter(item => item).join(', ')
  }

  // Replace with API call to fetch future appointments
  function fetchNextAppointmentDetails(): NextAppointmentDetails {
    return {
      responsibleOfficer: {
        name: {
          forename: 'ROForename',
          middleName: 'ROMiddleName',
          surname: 'ROSurname',
        },
        telephoneNumber: '01234567891',
      },
      futureAppointments: [
        {
          contactId: 1,
          datetime: LocalDateTime.now().toString(),
          description: 'FIRSTAPPOINTMENT',
          type: {
            code: 'FTYPE',
            description: 'First Appointment Type',
          },
          location: createDummyLocation(),
          officer: createDummyOfficer('first'),
        },
        {
          contactId: 2,
          datetime: LocalDateTime.now().toString(),
          description: 'SECONDAPPOINTMENT',
          type: {
            code: 'STYPE',
            description: 'Second Appointment Type',
          },
          location: createDummyLocation(),
          officer: createDummyOfficer('second'),
        },
        {
          contactId: 3,
          datetime: LocalDateTime.now().toString(),
          description: 'THIRDAPPOINTMENT',
          type: {
            code: 'TTYPE',
            description: 'Third Appointment Type',
          },
          location: createDummyLocation(),
          officer: createDummyOfficer('third'),
        },
      ],
    }
  }

  function createDummyOfficer(variant: string): Officer {
    return {
      code: variant,
      name: {
        forename: `fname${variant}`,
        middleName: `mname${variant}`,
        surname: `sname${variant}`,
      },
    }
  }

  function createDummyLocation(): Address {
    return {
      addressId: 1,
      type: 'Postal',
      buildingName: null,
      buildingNumber: '21',
      county: 'Reply County',
      district: 'Reply District',
      postcode: 'NE22 3AA',
      streetName: 'Reply Street',
      townCity: 'Reply City',
    }
  }

  return router
}
