import { Router } from 'express'
import { LocalDate, LocalDateTime } from '@js-joda/core'
import BreachNoticeApiClient, {
  BreachNotice,
  BreachNoticeContact,
  ContactRequirement, WholeSentenceContactRequirementReason,
} from '../data/breachNoticeApiClient'
import AuditService, { Page } from '../services/auditService'
import {fromUserDate, toUserDate, toUserDateFromDateTime, toUserTimeFromDateTime} from '../utils/dateUtils'
import { HmppsAuthClient } from '../data'
import CommonUtils from '../services/commonUtils'
import asArray, { createBlankBreachNoticeWithId, handleIntegrationErrors } from '../utils/utils'
import NdeliusIntegrationApiClient, {
  EnforceableContact,
  Requirements,
  WarningDetails
} from '../data/ndeliusIntegrationApiClient'
import { ErrorMessages } from '../data/uiModels'
import config from '../config'

export default function warningDetailsRoutes(
  router: Router,
  auditService: AuditService,
  hmppsAuthClient: HmppsAuthClient,
  commonUtils: CommonUtils,
): Router {
  const currentPage = 'warning-details'

  router.get(['/warning-details/:id', '/warning-details/:id/:callingscreen'], async (req, res, next) => {
    await auditService.logPageView(Page.WARNING_DETAILS, { who: res.locals.user.username, correlationId: req.id })
    const breachNoticeApiClient = new BreachNoticeApiClient(
      await hmppsAuthClient.getSystemClientToken(res.locals.user.username),
    )

    const ndeliusIntegrationApiClient = new NdeliusIntegrationApiClient(
      await hmppsAuthClient.getSystemClientToken(res.locals.user.username),
    )

    let breachNotice: BreachNotice
    let warningDetails: WarningDetails = null
    let contactRequirementList: Array<ContactRequirement> = null

    try {
      breachNotice = await breachNoticeApiClient.getBreachNoticeById(req.params.id as string)
      contactRequirementList = await breachNoticeApiClient.getContactRequirementLinks(req.params.id as string)
    } catch (error) {
      const errorMessages: ErrorMessages = handleIntegrationErrors(error.status, error.data?.message, 'Breach Notice')
      const showEmbeddedError = true
      breachNotice = createBlankBreachNoticeWithId(req.params.id)
      // always stay on page and display the error when there are isssues retrieving the breach notice
      res.render(`pages/warning-details`, { errorMessages, showEmbeddedError, breachNotice })
      return
    }

    if (await commonUtils.redirectRequired(breachNotice, res)) return

    try {
      warningDetails = await ndeliusIntegrationApiClient.getWarningDetails(breachNotice.crn, breachNotice.id)
    } catch (error) {
      const errorMessages: ErrorMessages = handleIntegrationErrors(
        error.status,
        error.data?.message,
        'NDelius Integration',
      )
      // take the user to detailed error page for 400 type errors
      if (error.status === 400) {
        res.render(`pages/detailed-error`, { errorMessages })
        return
      }
      // stay on the current page for 500 errors
      if (error.status === 500) {
        const showEmbeddedError = true
        breachNotice = createBlankBreachNoticeWithId(req.params.id)
        res.render(`pages/warning-details`, { errorMessages, showEmbeddedError, breachNotice })
        return
      }
      res.render(`pages/detailed-error`, { errorMessages })
      return
    }

    const warningDetailsResponseRequiredDate: string = toUserDate(breachNotice.responseRequiredDate)

    const enforceableContactListIds = warningDetails.enforceableContacts?.map(c => c.id)

    if(warningDetails.enforceableContacts && Object.keys(warningDetails.enforceableContacts).length > 0) {
      for (const enfContact of warningDetails.enforceableContacts){
        enfContact.rejectionReasons = [
          {
            text: 'Please Select',
            value: '-1',
            selected: true,
          },
          ... warningDetails.breachReasons.map(r => ({
          value: r.description,
          text: r.description,
          selected: false
        }))]
      }
    }

    // set reasons and defaults
    for (const bnContact of breachNotice.breachNoticeContactList) {
      if (!enforceableContactListIds || !enforceableContactListIds.includes(bnContact.contactId)) {
        warningDetails.enforceableContacts.push({
          id: bnContact.contactId,
          datetime: bnContact.contactDate,
          description: null,
          type: { code: '-1', description: bnContact.contactType },
          outcome: { code: '-1', description: bnContact.contactOutcome },
          notes: null,
        })
      }

      let enforceableContact = warningDetails.enforceableContacts.find(c => c.id === bnContact.contactId)

      if (enforceableContact) {
        console.log("######################## about to create the rejection reason list")
        enforceableContact.rejectionReasons = [          {
          text: 'Please Select',
          value: '-1',
          selected: false,
        },
          ... warningDetails.breachReasons.map(r => ({
          value: r.description,
          text: r.description,
          selected: bnContact.rejectionReason === r.description
        }))]
        enforceableContact.wholeSentence = bnContact.wholeSentence
      }
    }

    const existingContacts = breachNotice.breachNoticeContactList.map(c => c.contactId)
    const contactListDeeplink = `${config.ndeliusDeeplink.url}?component=ContactList&CRN=${breachNotice.crn}`
    const { furtherReasonDetails } = breachNotice
    res.render(`pages/warning-details`, {
      breachNotice,
      warningDetails,
      existingContacts,
      currentPage,
      warningDetailsResponseRequiredDate,
      contactListDeeplink,
      furtherReasonDetails,
      contactRequirementList,
    })
  })

  router.post('/warning-details/:id', async (req, res, next) => {

    let wholeSentenceSelectedContacts = Object.entries(req.body)
      .filter(([key]) => key.startsWith("wholeSentence-"))
    let wholeSentenceContactRequirementReasonList: Array<WholeSentenceContactRequirementReason> = []
    let wholeSentenceSelectedContactIds: string[] = []
    let wholeSentenceContactsAndReasons = Object.entries(req.body)
      .filter(([key]) => key.startsWith("failureReasonWholeTermContact_"))
    const hasWholeSentenceSelectedContacts: boolean = Object.keys(wholeSentenceSelectedContacts).length > 0

    if(hasWholeSentenceSelectedContacts) {
      for(let key in wholeSentenceSelectedContacts) {
        //this is an array with 2 items, they key and the value
        const wholeSentenceSelectedContact = wholeSentenceSelectedContacts[key]
        const contactId: string = wholeSentenceSelectedContact[0].split("-")[1]
        const failureReason: string = wholeSentenceSelectedContact[1] as unknown as string
        if(failureReason == "Yes") {
          wholeSentenceSelectedContactIds.push(contactId)
        }
      }

      for(let key in wholeSentenceContactsAndReasons) {
        const wholeSentenceSelectedContact = wholeSentenceContactsAndReasons[key]
        const contactId: string = wholeSentenceSelectedContact[0].split("_")[1]
        const rejectionReason: string = wholeSentenceSelectedContact[1] as unknown as string

        if(wholeSentenceSelectedContactIds.includes(contactId) ) {
          //we have all we need here to update the contact
          wholeSentenceContactRequirementReasonList.push({
            contactId: contactId,
            rejectionReason
          })
        }
      }
    }


    const { id } = req.params
    const token = await hmppsAuthClient.getSystemClientToken(res.locals.user.username)
    const breachNoticeApiClient = new BreachNoticeApiClient(token)
    const ndeliusIntegrationApiClient = new NdeliusIntegrationApiClient(token)
    let breachNotice: BreachNotice = null
    let warningDetails: WarningDetails = null
    let contactRequirementList: Array<ContactRequirement> = null
    const callingScreen: string = req.query.returnTo as string

    try {
      // get the existing breach notice
      breachNotice = await breachNoticeApiClient.getBreachNoticeById(id as string)
      contactRequirementList = await breachNoticeApiClient.getContactRequirementLinks(id as string)

    } catch (error) {
      const errorMessages: ErrorMessages = handleIntegrationErrors(error.status, error.data?.message, 'Breach Notice')
      const showEmbeddedError = true
      breachNotice = createBlankBreachNoticeWithId(id)
      // always stay on page and display the error when there are isssues retrieving the breach notice
      res.render(`pages/warning-details`, { errorMessages, showEmbeddedError, breachNotice })
      return
    }

    try {
      warningDetails = await ndeliusIntegrationApiClient.getWarningDetails(breachNotice.crn, id)
    } catch (error) {
      const errorMessages: ErrorMessages = handleIntegrationErrors(
        error.status,
        error.data?.message,
        'NDelius Integration',
      )
      // take the user to detailed error page for 400 type errors
      if (error.status === 400) {
        res.render(`pages/detailed-error`, { errorMessages })
        return
      }
      // stay on the current page for 500 errors
      if (error.status === 500) {
        const showEmbeddedError = true
        breachNotice = createBlankBreachNoticeWithId(req.params.id)
        res.render(`pages/warning-details`, { errorMessages, showEmbeddedError, breachNotice })
        return
      }
      res.render(`pages/detailed-error`, { errorMessages })
      return
    }

    breachNotice.furtherReasonDetails = req.body.furtherReasonDetails
    const warningDetailsResponseRequiredDate: string = toUserDate(breachNotice.responseRequiredDate)

    // getting list of enforceable contacts from integration
    const enforceableContactListIds = warningDetails.enforceableContacts?.map(c => c.id)

    // Add any breach notice contacts not returned in API
    for (const bnContact of breachNotice.breachNoticeContactList) {

      // This is adding local ones to the enforceable contact list for display on page as we alway show the
      // latest information from integrations with state stored in the service
      if (!enforceableContactListIds || !enforceableContactListIds.includes(bnContact.contactId)) {
        warningDetails.enforceableContacts.push({
          id: bnContact.contactId,
          datetime: bnContact.contactDate,
          description: null,
          type: { code: '-1', description: bnContact.contactType },
          outcome: { code: '-1', description: bnContact.contactOutcome },
          notes: null,
        })
      }
    }

    const errorMessages: ErrorMessages = validateWarningDetails(breachNotice, req.body.responseRequiredByDate)
    const hasErrors: boolean = Object.keys(errorMessages).length > 0

    //get list of existing contact ids which have already been saved
    const existingContacts = breachNotice.breachNoticeContactList.map(c => c.contactId)

    // if we dont have validation errors navigate continue
    if (!hasErrors) {
      breachNotice.warningDetailsSaved = true
      await breachNoticeApiClient.updateBreachNotice(id, breachNotice)

      // Add all selected contacts
      const selectedContactList = asArray(req.body.contact)
      const breachNoticeContactIds = breachNotice.breachNoticeContactList.map(c => c.contactId.toString())

      if (selectedContactList && Object.keys(selectedContactList).length > 0) {
        const contactsToPush: BreachNoticeContact[] = []
        const contactsToUpdateWholeSentenceInformation: BreachNoticeContact[] = []
        for (const selectedContactId of selectedContactList) {
          // check if any of the contacts previously saved have had whole sentence applied
          // here we are in the context of a selected contact loop
          if(breachNoticeContactIds && breachNoticeContactIds.includes(selectedContactId)) {
            const selectedIdAsNumber: number = parseInt(selectedContactId)
            //check if the value has changed for whole life
            // find current value for whole life
            if(Object.keys(breachNotice.breachNoticeContactList).length > 0) {
              const existingBreachNoticeContactListMatchingContactId: BreachNoticeContact[] = breachNotice.breachNoticeContactList.filter(brc => brc.contactId === selectedIdAsNumber)
              if(Object.keys(existingBreachNoticeContactListMatchingContactId).length > 0) {
                // we have found an existing breach notice contact that is also selected on screen
                // check to see if any whole sentence information has changed since it was last saved
                const currentBreachNoticeContact: BreachNoticeContact = existingBreachNoticeContactListMatchingContactId[0]
                const contactIdAsString : string = JSON.stringify(currentBreachNoticeContact.contactId)
                // we know that this particular contact now has whole sentence information
                if(wholeSentenceSelectedContactIds.includes(contactIdAsString)) {
                  const selectedWholeSentenceContactReason : WholeSentenceContactRequirementReason = wholeSentenceContactRequirementReasonList.filter(wsc => wsc.contactId === contactIdAsString)[0]
                  // we have a current selected reason
                  if(selectedWholeSentenceContactReason) {
                    //if anything has changed
                    if(!currentBreachNoticeContact.wholeSentence || (currentBreachNoticeContact.rejectionReason !== selectedWholeSentenceContactReason.rejectionReason)) {
                      //we have one to update
                      currentBreachNoticeContact.rejectionReason = selectedWholeSentenceContactReason.rejectionReason
                      currentBreachNoticeContact.wholeSentence = true
                      contactsToUpdateWholeSentenceInformation.push(currentBreachNoticeContact)
                    }
                  }
                }
              }
            }
          }

          // This next section is around storing new contacts, we also need to store the whole sentence information if applicable
          if (breachNoticeContactIds && !breachNoticeContactIds.includes(selectedContactId)) {
            // we are finding the selected contact in the list of enforceable contacts returned from the integration point
            const selectedContact = warningDetails.enforceableContacts.find(c => c.id.toString() === selectedContactId)
            let convertedBreachNoticeContact = enforceableContactToContact(breachNotice, selectedContact)
            const selectedContactIdString = JSON.stringify(convertedBreachNoticeContact.contactId)

            if(wholeSentenceSelectedContactIds.includes(selectedContactIdString)) {
              const selectedWholeSentenceContactReason : WholeSentenceContactRequirementReason = wholeSentenceContactRequirementReasonList.filter(wsc => wsc.contactId === selectedContactIdString)[0]
              convertedBreachNoticeContact.wholeSentence = true
              convertedBreachNoticeContact.rejectionReason = selectedWholeSentenceContactReason.rejectionReason
            }
            contactsToPush.push(convertedBreachNoticeContact)
          }
        }

        // add the whole sentence contact update to the push queue
        if(contactsToUpdateWholeSentenceInformation && Object.keys(contactsToUpdateWholeSentenceInformation).length > 0) {
          for (const wholeSentenceContact of contactsToUpdateWholeSentenceInformation) {
            contactsToPush.push(wholeSentenceContact)
          }
        }

        await breachNoticeApiClient.batchUpdateContacts(breachNotice.id, contactsToPush)
        breachNotice.breachNoticeContactList = await breachNoticeApiClient.getBreachNoticeContactsForBreachNotice(id)
      }
      if (req.body.action === 'refreshFromNdelius') {
        // redirect to warning details to force a reload
        res.redirect(`/warning-details/${id}`)
      } else {
        const contactsToDelete = Array.isArray(breachNotice.breachNoticeContactList)
          ? breachNotice.breachNoticeContactList
              .filter(bnContact => !selectedContactList.includes(bnContact.contactId.toString()))
              .map(c => c.id)
          : []
        await breachNoticeApiClient.batchDeleteContacts(breachNotice.id, contactsToDelete)

        if (callingScreen && callingScreen === 'check-your-report') {
          res.redirect(`/check-your-report/${id}`)
        } else if (req.body.action && req.body.action.substring(0, 18) === 'enforceablecontact') {
          const contactId = req.body.action.substring(19, req.body.action.length) // <- Delius contact id
          const selectedContact = warningDetails.enforceableContacts?.find(c => c.id.toString() === contactId)
          const returnedContact = await breachNoticeApiClient.getBreachNoticeContact(
            breachNotice.id,
            selectedContact.id,
          )
          res.redirect(`/add-requirement/${id}?contactId=${returnedContact.id}`)
        } else if (req.body.action === 'saveProgressAndClose') {
          res.send(`<script nonce="${res.locals.cspNonce}">window.close()</script>`)
        } else {
          res.redirect(`/next-appointment/${id}`)
        }
      }
    } else {
      const contactListDeeplink = `${config.ndeliusDeeplink.url}?component=ContactList&CRN=${breachNotice.crn}`
      const { furtherReasonDetails } = breachNotice
      res.render(`pages/warning-details`, {
        breachNotice,
        warningDetails,
        currentPage,
        existingContacts,
        errorMessages,
        contactListDeeplink,
        furtherReasonDetails,
        contactRequirementList,
        warningDetailsResponseRequiredDate,
      })
    }
  })

  function validateWarningDetails(breachNotice: BreachNotice, responseRequiredByDate: string): ErrorMessages {
    const errorMessages: ErrorMessages = {}
    const currentDateAtStartOfTheDay: LocalDateTime = LocalDate.now().atStartOfDay()
    try {
      // eslint-disable-next-line no-param-reassign
      breachNotice.responseRequiredDate = fromUserDate(responseRequiredByDate)
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (error: unknown) {
      // eslint-disable-next-line no-param-reassign
      breachNotice.responseRequiredDate = responseRequiredByDate
      errorMessages.responseRequiredByDate = {
        text: 'The proposed date for this letter is in an invalid format, please use the correct format e.g 17/5/2024',
      }
      // we cant continue with date validation
      return errorMessages
    }
    if (breachNotice.furtherReasonDetails && breachNotice.furtherReasonDetails.length > 4000) {
      errorMessages.furtherReasonDetails = {
        text: 'Further reason details: Please use 4000 characters or less for this field.',
      }
    }

    if (breachNotice && breachNotice.responseRequiredDate) {
      const localDateOfResponseRequiredByDate = LocalDate.parse(breachNotice.responseRequiredDate).atStartOfDay()
      if (localDateOfResponseRequiredByDate.isBefore(currentDateAtStartOfTheDay)) {
        errorMessages.responseRequiredByDate = {
          text: 'The Response Required By Date can not be before today',
        }
      }
    }
    return errorMessages
  }

  function enforceableContactToContact(
    breachNotice: BreachNotice,
    enforceableContact: EnforceableContact,
  ): BreachNoticeContact {
    return {
      id: (breachNotice.breachNoticeContactList ?? [])
        .filter(c => c.contactId === enforceableContact.id)
        .map(c => c.id)
        .at(0),
      contactId: enforceableContact.id,
      breachNoticeId: breachNotice.id,
      contactDate: enforceableContact.datetime.toString(),
      contactType: enforceableContact.type.description,
      contactOutcome: enforceableContact.outcome.description,
      wholeSentence: null,
      rejectionReason: null
    }
  }

  return router
}
