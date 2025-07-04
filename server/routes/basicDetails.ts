import { Router } from 'express'
import { LocalDate, LocalDateTime } from '@js-joda/core'
import AuditService, { Page } from '../services/auditService'
import { fromUserDate, toUserDate } from '../utils/dateUtils'
import { HmppsAuthClient } from '../data'
import CommonUtils from '../services/commonUtils'
import {
  arrangeSelectItemListAlphabetically,
  combineName,
  formatAddressForSelectMenuDisplay,
  handleIntegrationErrors,
  mapDeliusAddressToBreachNoticeAddress,
  removeDeliusAddressFromDeliusAddressList,
} from '../utils/utils'
import BreachNoticeApiClient, { BreachNotice } from '../data/breachNoticeApiClient'
import NdeliusIntegrationApiClient, { BasicDetails, DeliusAddress } from '../data/ndeliusIntegrationApiClient'
import { ErrorMessages, SelectItem } from '../data/uiModels'
import config from '../config'

export default function basicDetailsRoutes(
  router: Router,
  auditService: AuditService,
  hmppsAuthClient: HmppsAuthClient,
  commonUtils: CommonUtils,
): Router {
  const currentPage = 'basic-details'

  router.get('/basic-details/:id', async (req, res, next) => {
    await auditService.logPageView(Page.BASIC_DETAILS, { who: res.locals.user.username, correlationId: req.id })
    const token = await hmppsAuthClient.getSystemClientToken(res.locals.user.username)
    const breachNoticeApiClient = new BreachNoticeApiClient(token)
    const ndeliusIntegrationApiClient = new NdeliusIntegrationApiClient(token)

    let basicDetails: BasicDetails = null
    let breachNotice: BreachNotice = null

    try {
      // get the existing breach notice
      breachNotice = await breachNoticeApiClient.getBreachNoticeById(req.params.id as string)
      if (Object.keys(breachNotice).length === 0) {
        const errorMessages: ErrorMessages = {}
        errorMessages.genericErrorMessage = {
          text: 'The document has not been found or has been deleted. An error has been logged. 404',
        }
        res.render(`pages/detailed-error`, { errorMessages })
        return
      }
    } catch (error) {
      const errorMessages: ErrorMessages = handleIntegrationErrors(error.status, error.data?.message, 'Breach Notice')
      const showEmbeddedError = true
      // always stay on page and display the error when there are isssues retrieving the breach notice
      res.render(`pages/basic-details`, { errorMessages, showEmbeddedError })
      return
    }

    try {
      // get details from the integration service
      basicDetails = await ndeliusIntegrationApiClient.getBasicDetails(breachNotice.crn, req.user.username)
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
        res.render(`pages/basic-details`, { errorMessages, showEmbeddedError })
        return
      }
      res.render(`pages/detailed-error`, { errorMessages })
      return
    }

    if (await commonUtils.redirectRequired(breachNotice, res)) return
    const defaultOffenderAddress: DeliusAddress = findDefaultAddressInAddressList(basicDetails.addresses)
    const defaultReplyAddress: DeliusAddress = findDefaultReplyAddressInAddressList(
      basicDetails.replyAddresses,
      breachNotice,
    )
    const basicDetailsDateOfLetter: string = toUserDate(breachNotice.dateOfLetter)

    const alternateAddressOptions = addressListToSelectItemList(
      removeDeliusAddressFromDeliusAddressList(basicDetails.addresses, defaultOffenderAddress),
      breachNotice.basicDetailsSaved,
      breachNotice.offenderAddress?.addressId,
    )

    const replyAddressOptions = addressListToSelectItemList(
      removeDeliusAddressFromDeliusAddressList(basicDetails.replyAddresses, defaultReplyAddress),
      breachNotice.basicDetailsSaved,
      breachNotice.replyAddress?.addressId,
    )

    // show a warning is a previously saved address is no longer returned from the integration
    const errorMessages: ErrorMessages = validateAddressesPresent(
      breachNotice.replyAddress?.addressId,
      basicDetails.replyAddresses,
    )

    const addAddressDeeplink = `${config.ndeliusDeeplink.url}?component=AddressandAccommodation&CRN=${breachNotice.crn}`

    res.render('pages/basic-details', {
      breachNotice: applyDefaults(breachNotice, basicDetails),
      basicDetails,
      alternateAddressOptions,
      replyAddressOptions,
      defaultOffenderAddress,
      defaultReplyAddress,
      basicDetailsDateOfLetter,
      currentPage,
      errorMessages,
      addAddressDeeplink,
    })
  })

  function validateAddressesPresent(selectedAddressId: number, replyAddresses: DeliusAddress[]): ErrorMessages {
    const errorMessages: ErrorMessages = {}
    // Skip error message if added address is a custom address
    if (selectedAddressId && selectedAddressId !== -1) {
      // we have a selected address but no addresses returned from the integration
      if (selectedAddressId && !replyAddresses) {
        errorMessages.replyAddress = {
          text: 'Reply Address: The previously selected address is no longer available. Please select an alternative.',
        }
      }
      // we have an address list returned and a previously saved address
      if (selectedAddressId && replyAddresses) {
        if (!replyAddresses.find(a => a.id === selectedAddressId)) {
          errorMessages.replyAddress = {
            text: 'Reply Address: The previously selected address is no longer available. Please select an alternative.',
          }
        }
      }
    }
    return errorMessages
  }

  router.post('/basic-details/:id', async (req, res, next) => {
    const token = await hmppsAuthClient.getSystemClientToken(res.locals.user.username)
    const breachNoticeApiClient = new BreachNoticeApiClient(token)
    const ndeliusIntegrationApiClient = new NdeliusIntegrationApiClient(token)
    const callingScreen: string = req.query.returnTo as string
    const { id } = req.params
    const currentBreachNotice = await breachNoticeApiClient.getBreachNoticeById(req.params.id as string)

    if (await commonUtils.redirectRequired(currentBreachNotice, res)) return

    const basicDetails = await ndeliusIntegrationApiClient.getBasicDetails(currentBreachNotice.crn, req.user.username)
    const updatedBreachNotice = applyDefaults(currentBreachNotice, basicDetails)

    const defaultOffenderAddress: DeliusAddress = findDefaultAddressInAddressList(basicDetails.addresses)
    const defaultReplyAddress: DeliusAddress = findDefaultReplyAddressInAddressList(
      basicDetails.replyAddresses,
      updatedBreachNotice,
    )
    updatedBreachNotice.referenceNumber = req.body.officeReference
    if (req.body.offenderAddressSelectOne === 'No') {
      updatedBreachNotice.offenderAddress = mapDeliusAddressToBreachNoticeAddress(
        getSelectedAddress(basicDetails.addresses, req.body.alternateAddress),
      )
      updatedBreachNotice.useDefaultAddress = false
    } else if (req.body.offenderAddressSelectOne === 'Yes') {
      // otherwise use default
      updatedBreachNotice.offenderAddress = mapDeliusAddressToBreachNoticeAddress(defaultOffenderAddress)
      updatedBreachNotice.useDefaultAddress = true
    } else {
      updatedBreachNotice.useDefaultAddress = null
    }
    // reply address (skip if we need to add one)
    if (req.body.action !== 'addAddress') {
      if (req.body.replyAddressSelectOne === 'No') {
        updatedBreachNotice.replyAddress = mapDeliusAddressToBreachNoticeAddress(
          getSelectedAddress(basicDetails.replyAddresses, req.body.alternateReplyAddress),
        )
        updatedBreachNotice.useDefaultReplyAddress = false
      } else if (req.body.replyAddressSelectOne === 'Yes') {
        updatedBreachNotice.replyAddress = mapDeliusAddressToBreachNoticeAddress(defaultReplyAddress)
        updatedBreachNotice.useDefaultReplyAddress = true
      } else {
        // no default address found we force the user to select one
        updatedBreachNotice.useDefaultReplyAddress = false
        updatedBreachNotice.replyAddress = mapDeliusAddressToBreachNoticeAddress(
          getSelectedAddress(basicDetails.replyAddresses, req.body.alternateReplyAddress),
        )
      }
    }

    const addAddressDeeplink = `${config.ndeliusDeeplink.url}?component=AddressandAccommodation&CRN=${currentBreachNotice.crn}`

    const { title, name } = basicDetails
    const combinedName = combineName(title, name)

    updatedBreachNotice.titleAndFullName = combinedName.trim().replace('  ', ' ')

    // validation
    const errorMessages: ErrorMessages = validateBasicDetails(updatedBreachNotice, req.body.dateOfLetter)
    const hasErrors: boolean = Object.keys(errorMessages).length > 0

    // If we have no errors we are navigating to warning type
    // unless the user has clicked save and close
    if (!hasErrors) {
      // mark that a USER has saved the document at least once
      updatedBreachNotice.basicDetailsSaved = true
      // if it doesnt have errors, update
      await breachNoticeApiClient.updateBreachNotice(id, updatedBreachNotice)

      // if the user selected saveProgressAndClose then send a close back to the client
      if (req.body.action === 'saveProgressAndClose') {
        res.send(
          `<p>You can now safely close this window</p><script nonce="${res.locals.cspNonce}">window.close()</script>`,
        )
      } else if (req.body.action === 'refreshFromNdelius') {
        // redirect to warning details to force a reload
        res.redirect(`/basic-details/${id}`)
      } else if (req.body.action === 'addAddress') {
        res.redirect(`/add-address/${id}`)
      } else if (callingScreen && callingScreen === 'check-your-report') {
        res.redirect(`/check-your-report/${id}`)
      } else {
        res.redirect(`/warning-type/${id}`)
      }
    } else {
      const alternateAddressOptions = addressListToSelectItemList(
        basicDetails.addresses,
        updatedBreachNotice.basicDetailsSaved,
        updatedBreachNotice.offenderAddress?.addressId,
      )

      const replyAddressOptions = addressListToSelectItemList(
        basicDetails.replyAddresses,
        updatedBreachNotice.basicDetailsSaved,
        updatedBreachNotice.replyAddress?.addressId,
      )

      const basicDetailsDateOfLetter: string = req.body.dateOfLetter
      res.render(`pages/basic-details`, {
        errorMessages,
        breachNotice: updatedBreachNotice,
        basicDetails,
        defaultOffenderAddress,
        defaultReplyAddress,
        alternateAddressOptions,
        replyAddressOptions,
        basicDetailsDateOfLetter,
        currentPage,
        addAddressDeeplink,
      })
    }
  })

  function validateBasicDetails(breachNotice: BreachNotice, userEnteredDateOfLetter: string): ErrorMessages {
    const errorMessages: ErrorMessages = {}
    const currentDateAtStartOfTheDay: LocalDateTime = LocalDate.now().atStartOfDay()
    if (breachNotice.referenceNumber && breachNotice.referenceNumber.trim().length > 30) {
      errorMessages.officeReferenceNumber = {
        text: 'Office Reference must be 30 characters or less',
      }
    }

    try {
      // eslint-disable-next-line no-param-reassign
      breachNotice.dateOfLetter = fromUserDate(userEnteredDateOfLetter)
    } catch {
      // eslint-disable-next-line no-param-reassign
      breachNotice.dateOfLetter = userEnteredDateOfLetter
      errorMessages.dateOfLetter = {
        text: 'The proposed date for this letter is in an invalid format, please use the correct format e.g 17/5/2024',
      }
      // we cant continue with date validation
      return errorMessages
    }

    if (breachNotice) {
      // only perform date validation if the user has entered a value
      if (breachNotice.dateOfLetter) {
        // check date of letter is not before today
        const localDateOfLetterAtStartOfDay = LocalDate.parse(breachNotice.dateOfLetter).atStartOfDay()
        if (localDateOfLetterAtStartOfDay.isBefore(currentDateAtStartOfTheDay)) {
          errorMessages.dateOfLetter = {
            text: 'The letter has not been completed and so the date cannot be before today.',
          }
        }
        if (localDateOfLetterAtStartOfDay.minusDays(7).isAfter(currentDateAtStartOfTheDay)) {
          errorMessages.dateOfLetter = {
            text: 'The proposed date for this letter is a week in the future. Breach letters need to be timely in order to allow evidence to be presented. Please complete the letter in a timely way or update the contact outcome to be acceptable.',
          }
        }
      }
    }
    return errorMessages
  }

  function getSelectedAddress(addressList: DeliusAddress[], addressIdentifier: string): DeliusAddress {
    const addressIdentifierNumber: number = +addressIdentifier
    return addressList.find(address => address.id === addressIdentifierNumber)
  }

  // if this page hasnt been saved we want to go through and apply defaults otherwise dont do this
  function applyDefaults(breachNotice: BreachNotice, basicDetails: BasicDetails) {
    if (!breachNotice.basicDetailsSaved) {
      // load offender name from integration details
      const { title, name } = basicDetails
      const combinedName = combineName(title, name)
      // only apply the defaults if basic details has NOT been saved by a USER
      return {
        ...breachNotice,
        titleAndFullName: combinedName,
        useDefaultAddress: true,
        useDefaultReplyAddress: true,
      }
    }
    return breachNotice
  }

  function addressListToSelectItemList(
    addresses: DeliusAddress[],
    breachNoticeSaved: boolean,
    selectedAddressId: number,
  ): SelectItem[] {
    const returnAddressList: SelectItem[] = [
      {
        text: 'Please Select',
        value: '-1',
        selected: true,
      },
    ]
    if (addresses) {
      const orderedAddressList: SelectItem[] = arrangeSelectItemListAlphabetically(
        addresses.map(address => ({
          text: formatAddressForSelectMenuDisplay(address),
          value: `${address.id}`,
          selected: breachNoticeSaved && address.id === selectedAddressId,
        })),
      )

      returnAddressList.push(...orderedAddressList)
    }

    return returnAddressList
  }

  function findDefaultAddressInAddressList(addressList: Array<DeliusAddress>): DeliusAddress {
    if (addressList) {
      return (
        addressList.find(a => a.status === 'Default') ??
        addressList.find(a => a.status === 'Postal') ??
        addressList.find(a => a.status === 'Main')
      )
    }
    return null
  }

  function findDefaultReplyAddressInAddressList(
    addressList: Array<DeliusAddress>,
    breachNotice: BreachNotice,
  ): DeliusAddress {
    if (
      addressList &&
      addressList.length > 0 &&
      (breachNotice.replyAddress === null || breachNotice.replyAddress.addressId !== -1)
    ) {
      return (
        addressList.find(a => a.status === 'Default') ??
        addressList.find(a => a.status === 'Postal') ??
        addressList.find(a => a.status === 'Main')
      )
    }
    if (breachNotice.replyAddress != null) {
      return {
        buildingName: breachNotice.replyAddress.buildingName,
        buildingNumber: breachNotice.replyAddress.buildingNumber,
        county: breachNotice.replyAddress.county,
        district: breachNotice.replyAddress.district,
        id: breachNotice.replyAddress.addressId,
        officeDescription: breachNotice.replyAddress.officeDescription,
        postcode: breachNotice.replyAddress.postcode,
        status: breachNotice.replyAddress.status,
        streetName: breachNotice.replyAddress.streetName,
        townCity: breachNotice.replyAddress.townCity,
      }
    }
    return null
  }

  return router
}
