import {Router} from 'express'
import {LocalDate, LocalDateTime} from '@js-joda/core'
import BreachNoticeApiClient, {
  BreachNotice,
  BreachNoticeContact,
  ContactRequirement,
  WholeSentenceContactRequirementReason,
} from '../data/breachNoticeApiClient'
import AuditService, {Page} from '../services/auditService'
import {fromUserDate, toUserDate} from '../utils/dateUtils'
import {HmppsAuthClient} from '../data'
import CommonUtils from '../services/commonUtils'
import asArray, {createBlankBreachNoticeWithId, handleIntegrationErrors} from '../utils/utils'
import NdeliusIntegrationApiClient, {EnforceableContact, WarningDetails} from '../data/ndeliusIntegrationApiClient'
import {ErrorMessages} from '../data/uiModels'
import config from '../config'

export default function warningDetailsRoutes(
  router: Router,
  auditService: AuditService,
  hmppsAuthClient: HmppsAuthClient,
  commonUtils: CommonUtils,
): Router {
  const currentPage = 'warning-details'

  router.get(['/warning-details/:id', '/warning-details/:id/:callingscreen'], async (req, res) => {
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


  function filterSelectedWholeSentenceValuesAndAddWholeSentenceRejectionInformation (selectedContactList: string[], wholeSentenceInformationList: [string, unknown][], rejectionReasonWholeSentenceList: [string, unknown][]): Array<WholeSentenceContactRequirementReason> {
    let wholeSentenceContactRequirementReasonList: Array<WholeSentenceContactRequirementReason> = []

    // if we have no enforceable contacts selected then return null
    if(!selectedContactList || !(Object.keys(selectedContactList).length > 0)) {
      return null
    }

    // if no whole sentence information is passed in
    if(!wholeSentenceInformationList || !(Object.keys(wholeSentenceInformationList).length > 0)) {
      return null
    }


    // we have a list of selected contact ids and a list of whole sentence information, perform the filter
    for (const selectedContactId of selectedContactList) {
      for(let key in wholeSentenceInformationList) {

        //this is an array with 2 items, they key and the value
        const wholeSentenceSelectedContact = wholeSentenceInformationList[key]
        const contactId: string = wholeSentenceSelectedContact[0].split("-")[1]
        const wholeSentenceSelectionValue: string = wholeSentenceSelectedContact[1] as unknown as string

        if(selectedContactId === contactId) {
          let transmittedRejectionReason: string = null

          // get the reason selected
          for(let reasonKey in rejectionReasonWholeSentenceList) {
            const reasonItem = rejectionReasonWholeSentenceList[reasonKey]
            const rejectionReasonContactId: string = reasonItem[0].split("_")[1]
            if(selectedContactId == rejectionReasonContactId) {
              transmittedRejectionReason = reasonItem[1] as unknown as string
              break
            }
          }

          wholeSentenceContactRequirementReasonList.push({
            contactId:contactId,
            wholeSentenceSelected:wholeSentenceSelectionValue == "Yes",
            rejectionReason:transmittedRejectionReason
            }
          )
        }
      }


    }
    return wholeSentenceContactRequirementReasonList
  }


  router.post('/warning-details/:id', async (req, res) => {
    // Get a list of enforceable contacts that have been ticked / selected
    const selectedContactList = asArray(req.body.contact)
    const processedItems: string[] = []
    // final list to push
    const contactsToPush: BreachNoticeContact[] = []

    let rawEnforceableContactWholeSentenceBooleanValues = Object.entries(req.body)
      .filter(([key]) => key.startsWith("wholeSentence-"))

    let wholeSentenceContactsAndReasons = Object.entries(req.body)
      .filter(([key]) => key.startsWith("failureReasonWholeTermContact_"))

    let filteredContactWholeSentenceRejectionReasonList:Array<WholeSentenceContactRequirementReason> = filterSelectedWholeSentenceValuesAndAddWholeSentenceRejectionInformation(selectedContactList, rawEnforceableContactWholeSentenceBooleanValues, wholeSentenceContactsAndReasons)
    const hasWholeSentenceSelectedContacts: boolean = filteredContactWholeSentenceRejectionReasonList && Object.keys(filteredContactWholeSentenceRejectionReasonList).length > 0
    const { id } = req.params
    const token = await hmppsAuthClient.getSystemClientToken(res.locals.user.username)
    const breachNoticeApiClient = new BreachNoticeApiClient(token)
    const ndeliusIntegrationApiClient = new NdeliusIntegrationApiClient(token)
    let breachNotice: BreachNotice
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

    const errorMessages: ErrorMessages = validateWarningDetails(breachNotice, req.body.responseRequiredByDate, filteredContactWholeSentenceRejectionReasonList)
    const hasErrors: boolean = Object.keys(errorMessages).length > 0

    //get list of existing contact ids which have already been saved
    const existingContacts = breachNotice.breachNoticeContactList.map(c => c.contactId)

    // if we dont have validation errors navigate continue
    if (!hasErrors) {
      breachNotice.warningDetailsSaved = true
      await breachNoticeApiClient.updateBreachNotice(id, breachNotice)

      // Contacts ids of contacts stored in the Breach Notice service
      // we will use these to detect contact information to push
      const breachNoticeContactIds = breachNotice.breachNoticeContactList.map(c => c.contactId.toString())

      // Deal with WHole Sentence Contacts first
      if(hasWholeSentenceSelectedContacts) {
        //Convert default export to named
        for(const wholeSentenceContactRequirementReason of filteredContactWholeSentenceRejectionReasonList){
          if(breachNoticeContactIds.includes(wholeSentenceContactRequirementReason.contactId)) {
            const existingBreachNoticeContactListMatchingContactId: BreachNoticeContact[] = breachNotice.breachNoticeContactList.filter(brc => JSON.stringify(brc.contactId) == wholeSentenceContactRequirementReason.contactId)
            if(Object.keys(existingBreachNoticeContactListMatchingContactId).length > 0) {
              const currentExistingBreachNoticeContact: BreachNoticeContact = existingBreachNoticeContactListMatchingContactId[0]
              currentExistingBreachNoticeContact.wholeSentence = wholeSentenceContactRequirementReason.wholeSentenceSelected
              currentExistingBreachNoticeContact.rejectionReason = wholeSentenceContactRequirementReason.rejectionReason
              contactsToPush.push(currentExistingBreachNoticeContact)
              processedItems.push(JSON.stringify(currentExistingBreachNoticeContact.contactId))
            }
          }

          // we have dealt with the whole sentence contacts now deal with newly added contacts
          if (breachNoticeContactIds && !breachNoticeContactIds.includes(wholeSentenceContactRequirementReason.contactId)) {
            // we are finding the selected contact in the list of enforceable contacts returned from the integration point
            const selectedContact = warningDetails.enforceableContacts.find(c => c.id.toString() === wholeSentenceContactRequirementReason.contactId)
            let convertedBreachNoticeContact = enforceableContactToContact(breachNotice, selectedContact)
            //set the user defined information
            convertedBreachNoticeContact.wholeSentence = wholeSentenceContactRequirementReason.wholeSentenceSelected
            convertedBreachNoticeContact.rejectionReason = wholeSentenceContactRequirementReason.rejectionReason
            contactsToPush.push(convertedBreachNoticeContact)
            processedItems.push(JSON.stringify(convertedBreachNoticeContact.contactId))
          }
        }
      }

      // deal with edge case where contact selected but nothing selected for whole sentence
      if(contactsToPush && Object.keys(contactsToPush).length > 0) {
        if(selectedContactList && Object.keys(selectedContactList).length > 0) {
          const remainderList: string[] = []

          for(const strToCheck of selectedContactList) {
            // include not forking and filter not working
            if(!processedItems.includes(strToCheck)) {
              remainderList.push(strToCheck)
            }
          }

          // process any unprocesed items
          if(remainderList && Object.keys(remainderList).length > 0) {

            for(const remaindKey in remainderList) {
              const theRemainingContactIdToSearchFor = remainderList[remaindKey]
              const enforceableContactToConvertAndProcess = warningDetails.enforceableContacts?.find(ef => JSON.stringify(ef.id) === theRemainingContactIdToSearchFor)

              if(enforceableContactToConvertAndProcess) {
                const convertedRemainder = enforceableContactToContact(breachNotice, enforceableContactToConvertAndProcess)
                convertedRemainder.wholeSentence = null
                contactsToPush.push(convertedRemainder)
              }
            }
          }
        }
      }

      await breachNoticeApiClient.batchUpdateContacts(breachNotice.id, contactsToPush)
      breachNotice.breachNoticeContactList = await breachNoticeApiClient.getBreachNoticeContactsForBreachNotice(id)

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

      //we need to re-apply selections
      // wholeSentenceContactRequirementReasonList
      // This part is for screen selected contacts it adds to the current selections
      if(selectedContactList && Object.keys(selectedContactList).length > 0) {
        for(const selectedContact of selectedContactList) {
          if(!existingContacts.includes(parseInt(selectedContact))){
            existingContacts.push(parseInt(selectedContact))
          }
        }
      }

      //deal with whole sentence
      if(filteredContactWholeSentenceRejectionReasonList && Object.keys(filteredContactWholeSentenceRejectionReasonList).length > 0){
        if(warningDetails.enforceableContacts && Object.keys(warningDetails.enforceableContacts).length > 0) {

          //we have enforceable contacts
          for(const currentEnforceableContact of warningDetails.enforceableContacts) {
            //see if we have wholeSentenceInformation to recover
            const wholeSentenceDetail = filteredContactWholeSentenceRejectionReasonList.find(ws => JSON.stringify(currentEnforceableContact.id) === ws.contactId)

            currentEnforceableContact.wholeSentence = wholeSentenceDetail?.wholeSentenceSelected

            currentEnforceableContact.rejectionReasons = [          {
              text: 'Please Select',
              value: '-1',
              selected: false,
            },
              ... warningDetails.breachReasons.map(r => ({
                value: r.description,
                text: r.description,
                selected: wholeSentenceDetail?.rejectionReason === r.description
              }))]
          }
        }
      }

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

  function validateWarningDetails(breachNotice: BreachNotice, responseRequiredByDate: string, wholeSentenceContactRequirementReasonList: Array<WholeSentenceContactRequirementReason>): ErrorMessages {
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

    if (wholeSentenceContactRequirementReasonList && Object.keys(wholeSentenceContactRequirementReasonList).length > 0) {
      for(const wholeSentence of wholeSentenceContactRequirementReasonList) {
        if(wholeSentence.rejectionReason === "-1" && wholeSentence.wholeSentenceSelected) {
          errorMessages.wholeSentenceNoFailureReason = {
            text: 'Please select a valid failure reason for each failure selected'
          }
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
