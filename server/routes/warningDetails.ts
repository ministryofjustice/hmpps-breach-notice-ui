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


  router.post('/warning-details/:id', async (req, res, next) => {

    // Get a list of enforceable contacts that have been ticked / selected
    const selectedContactList = asArray(req.body.contact)
    const processedItems: string[] = []
    // final list to push
    const contactsToPush: BreachNoticeContact[] = []
    console.log("############ SELECTED CONTACTS COMING UP")
    console.log(selectedContactList)

    // What we want the outcome to be
    // 1) If whole sentence is set to Yes or No we want to transmit it
    // all whole sentence values from all enforceable contacts will always be passed through
    // we must only act upon ones which accompany a ticked enforceable contact
    // if they are not ticked and were previously ticked the contacts will be deleted
    let rawEnforceableContactWholeSentenceBooleanValues = Object.entries(req.body)
      .filter(([key]) => key.startsWith("wholeSentence-"))

    let wholeSentenceContactsAndReasons = Object.entries(req.body)
      .filter(([key]) => key.startsWith("failureReasonWholeTermContact_"))

    let filteredContactWholeSentenceRejectionReasonList:Array<WholeSentenceContactRequirementReason> = filterSelectedWholeSentenceValuesAndAddWholeSentenceRejectionInformation(selectedContactList, rawEnforceableContactWholeSentenceBooleanValues, wholeSentenceContactsAndReasons)
    const hasWholeSentenceSelectedContacts: boolean = filteredContactWholeSentenceRejectionReasonList && Object.keys(filteredContactWholeSentenceRejectionReasonList).length > 0

    //In order to use the above we need a list of selected enforceable contacts. WE NEED THE CONTACT ARRAY

    // let wholeSentenceContactRequirementReasonList: Array<WholeSentenceContactRequirementReason> = []
    // let wholeSentenceYesSelectedContactIds: string[] = []
    // let wholeSentenceNoSelectedContactIds: string[] = []


    // if(hasWholeSentenceSelectedContacts) {
    //   for(let key in rawEnforceableContactWholeSentenceBooleanValues) {
    //     //this is an array with 2 items, they key and the value
    //     const wholeSentenceSelectedContact = rawEnforceableContactWholeSentenceBooleanValues[key]
    //     const contactId: string = wholeSentenceSelectedContact[0].split("-")[1]
    //     const wholeSentenceSelectionValue: string = wholeSentenceSelectedContact[1] as unknown as string
    //
    //     if(wholeSentenceSelectionValue == "Yes") {
    //       console.log("Pushing a Yes contact ID")
    //       wholeSentenceYesSelectedContactIds.push(contactId)
    //     }
    //     else {
    //       console.log("Pushing a No contact ID")
    //       wholeSentenceNoSelectedContactIds.push(contactId)
    //     }
    //   }
    //
    //   for(let key in wholeSentenceContactsAndReasons) {
    //     const wholeSentenceSelectedContact = wholeSentenceContactsAndReasons[key]
    //     const contactId: string = wholeSentenceSelectedContact[0].split("_")[1]
    //     const rejectionReason: string = wholeSentenceSelectedContact[1] as unknown as string
    //
    //
    //     if(wholeSentenceYesSelectedContactIds.includes(contactId) ) {
    //       //we have all we need here to update the contact
    //       wholeSentenceContactRequirementReasonList.push({
    //         contactId: contactId,
    //         rejectionReason: rejectionReason,
    //         wholeSentenceSelected: true,
    //       })
    //     }
    //
    //     if(wholeSentenceNoSelectedContactIds.includes(contactId) ) {
    //       //we have all we need here to update the contact
    //       wholeSentenceContactRequirementReasonList.push({
    //         contactId: contactId,
    //         rejectionReason: rejectionReason,
    //         wholeSentenceSelected: false,
    //       })
    //     }
    //
    //   }
    // }


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

      // Contacts ids of contacts stored in the Breach Notice service
      // we will use these to detect contact information to push
      const breachNoticeContactIds = breachNotice.breachNoticeContactList.map(c => c.contactId.toString())



      // Deal with WHole Sentence Contacts first
      if(hasWholeSentenceSelectedContacts) {
        console.log("About to output the filtered list")
        console.log(filteredContactWholeSentenceRejectionReasonList)

        //Convert default export to named
        for(const wholeSentenceContactRequirementReason of filteredContactWholeSentenceRejectionReasonList){
          if(breachNoticeContactIds.includes(wholeSentenceContactRequirementReason.contactId)) {
            //we know its in the existing list,
            // see if the information has changed and if it, copy updated information to the contact has push to the update queue
            //just get the real contact
            const existingBreachNoticeContactListMatchingContactId: BreachNoticeContact[] = breachNotice.breachNoticeContactList.filter(brc => JSON.stringify(brc.contactId) == wholeSentenceContactRequirementReason.contactId)
            if(Object.keys(existingBreachNoticeContactListMatchingContactId).length > 0) {
              const currentExistingBreachNoticeContact: BreachNoticeContact = existingBreachNoticeContactListMatchingContactId[0]

              //TODO: JUST PUSH THEM
              currentExistingBreachNoticeContact.wholeSentence = wholeSentenceContactRequirementReason.wholeSentenceSelected
              currentExistingBreachNoticeContact.rejectionReason = wholeSentenceContactRequirementReason.rejectionReason
              contactsToPush.push(currentExistingBreachNoticeContact)
              processedItems.push(JSON.stringify(currentExistingBreachNoticeContact.contactId))
            }

          }

          //#########################################################
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
      // loop the main list here
      // TODO: remove the processed contacts
      if(contactsToPush && Object.keys(contactsToPush).length > 0) {



        if(selectedContactList && Object.keys(selectedContactList).length > 0) {

          const remainderList: string[] = []


          //we have a list of processsed items

          //we have a list of selected items

          // al we need to do is subtract the processed from selected

          // loop through selected list
          // only add tgo other list if its not in the found list
          for(const strToCheck of selectedContactList) {
            // include not forking and filter not working
            if(!processedItems.includes(strToCheck)) {
              remainderList.push(strToCheck)
            }
          }


          console.log("Here is the original list")
          console.log(selectedContactList)

          console.log("here are the processed items")
          console.log(processedItems)

          console.log("Here is the remainder list")
          console.log(remainderList)

          // process any unprocesed items
          if(remainderList && Object.keys(remainderList).length > 0) {

            for(const remaindKey in remainderList) {
              const theRemainingContactIdToSearchFor = remainderList[remaindKey]
              console.log("looking for the following contact")
              console.log(remainderList[remaindKey])



              const enforceableContactToConvertAndProcess = warningDetails.enforceableContacts?.find(ef => JSON.stringify(ef.id) === theRemainingContactIdToSearchFor)

              if(enforceableContactToConvertAndProcess) {
                console.log("Should hAVE AN ENMGFORCEABLE CONTACT HERE next")
                console.log(enforceableContactToConvertAndProcess)
                console.log("Should hAVE AN CONVERTED ENMGFORCEABLE CONTACT HERE next")
                const convertedRemainder = enforceableContactToContact(breachNotice, enforceableContactToConvertAndProcess)
                convertedRemainder.wholeSentence = null
                console.log(convertedRemainder)
                contactsToPush.push(convertedRemainder)
              }

            }
          }
        }
      }

      console.log("ABOUT TO UPDATE / ADD the follwoing contacts")
      console.log(contactsToPush)
      await breachNoticeApiClient.batchUpdateContacts(breachNotice.id, contactsToPush)
      breachNotice.breachNoticeContactList = await breachNoticeApiClient.getBreachNoticeContactsForBreachNotice(id)






      //##################################################################################

      // if (selectedContactList && Object.keys(selectedContactList).length > 0) {
      //   const contactsToPush: BreachNoticeContact[] = []
      //   const contactsToUpdateWholeSentenceInformation: BreachNoticeContact[] = []
      //
      //
      //   for (const selectedContactId of selectedContactList) {
      //     // check if any of the contacts previously saved have had whole sentence applied
      //     // here we are in the context of a selected contact loop
      //     if(breachNoticeContactIds && breachNoticeContactIds.includes(selectedContactId)) {
      //       const selectedIdAsNumber: number = parseInt(selectedContactId)
      //       //check if the value has changed for whole life
      //       // find current value for whole life
      //       if(Object.keys(breachNotice.breachNoticeContactList).length > 0) {
      //         const existingBreachNoticeContactListMatchingContactId: BreachNoticeContact[] = breachNotice.breachNoticeContactList.filter(brc => brc.contactId === selectedIdAsNumber)
      //         if(Object.keys(existingBreachNoticeContactListMatchingContactId).length > 0) {
      //           // we have found an existing breach notice contact that is also selected on screen
      //           // check to see if any whole sentence information has changed since it was last saved
      //           const currentBreachNoticeContact: BreachNoticeContact = existingBreachNoticeContactListMatchingContactId[0]
      //           const contactIdAsString : string = JSON.stringify(currentBreachNoticeContact.contactId)
      //           // we know that this particular contact now has whole sentence information
      //           // all contacts will now have whole sentence information
      //           // TODO: might need next linbe re-enabling
      //           // if(wholeSentenceYesSelectedContactIds.includes(contactIdAsString)) {
      //             const selectedWholeSentenceContactReason : WholeSentenceContactRequirementReason = wholeSentenceContactRequirementReasonList.filter(wsc => wsc.contactId === contactIdAsString)[0]
      //             // we have a current selected reason
      //             if(selectedWholeSentenceContactReason) {
      //
      //               //if anything has changed
      //               if(!currentBreachNoticeContact.wholeSentence || (currentBreachNoticeContact.rejectionReason !== selectedWholeSentenceContactReason.rejectionReason)) {
      //                 //we have one to update
      //                 currentBreachNoticeContact.rejectionReason = selectedWholeSentenceContactReason.rejectionReason
      //
      //                 //TODO: we are always setting to true here which is wrong
      //                 // Need to use yes or no selected here
      //                 currentBreachNoticeContact.wholeSentence = selectedWholeSentenceContactReason.wholeSentenceSelected
      //                 contactsToUpdateWholeSentenceInformation.push(currentBreachNoticeContact)
      //
      //                 console.log("PUSHING A CONTACT")
      //                 console.log(currentBreachNoticeContact)
      //               }
      //             }
      //           // }
      //
      //
      //
      //
      //
      //         }
      //       }
      //     }
      //
      //     // This next section is around storing new contacts, we also need to store the whole sentence information if applicable
      //     if (breachNoticeContactIds && !breachNoticeContactIds.includes(selectedContactId)) {
      //       // we are finding the selected contact in the list of enforceable contacts returned from the integration point
      //       const selectedContact = warningDetails.enforceableContacts.find(c => c.id.toString() === selectedContactId)
      //       let convertedBreachNoticeContact = enforceableContactToContact(breachNotice, selectedContact)
      //       const selectedContactIdString = JSON.stringify(convertedBreachNoticeContact.contactId)
      //
      //       if(wholeSentenceYesSelectedContactIds.includes(selectedContactIdString)) {
      //         const selectedWholeSentenceContactReason : WholeSentenceContactRequirementReason = wholeSentenceContactRequirementReasonList.filter(wsc => wsc.contactId === selectedContactIdString)[0]
      //         convertedBreachNoticeContact.wholeSentence = true
      //         convertedBreachNoticeContact.rejectionReason = selectedWholeSentenceContactReason.rejectionReason
      //       }
      //       contactsToPush.push(convertedBreachNoticeContact)
      //     }
      //   }
      //
      //   // add the whole sentence contact update to the push queue
      //   if(contactsToUpdateWholeSentenceInformation && Object.keys(contactsToUpdateWholeSentenceInformation).length > 0) {
      //     for (const wholeSentenceContact of contactsToUpdateWholeSentenceInformation) {
      //       contactsToPush.push(wholeSentenceContact)
      //     }
      //   }
      //
      //   await breachNoticeApiClient.batchUpdateContacts(breachNotice.id, contactsToPush)
      //   breachNotice.breachNoticeContactList = await breachNoticeApiClient.getBreachNoticeContactsForBreachNotice(id)
      // }


























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
