import { type RequestHandler, type Router } from 'express'
import { LocalDate, LocalDateTime } from '@js-joda/core'
import AuditService, { Page } from '../services/auditService'
import { fromUserDate, toUserDate } from '../utils/dateUtils'
import { HmppsAuthClient } from '../data'
import CommonUtils from '../services/commonUtils'
import {
  arrangeSelectItemListAlphabetically,
  combineName,
  formatAddressForSelectMenuDisplay,
  mapDeliusAddressToBreachNoticeAddress,
  removeDeliusAddressFromDeliusAddressList,
} from '../utils/utils'
import BreachNoticeApiClient, { BreachNotice } from '../data/breachNoticeApiClient'
import NdeliusIntegrationApiClient, { BasicDetails, DeliusAddress } from '../data/ndeliusIntegrationApiClient'
import asyncMiddleware from '../middleware/asyncMiddleware'
import { ErrorMessages, SelectItem } from '../data/uiModels'

export default function basicDetailsRoutes(
  router: Router,
  auditService: AuditService,
  hmppsAuthClient: HmppsAuthClient,
  commonUtils: CommonUtils,
): Router {
  const currentPage = 'basic-details'
  const get = (path: string | string[], handler: RequestHandler) => router.get(path, asyncMiddleware(handler))
  const post = (path: string | string[], handler: RequestHandler) => router.post(path, asyncMiddleware(handler))

  get('/basic-details/:id', async (req, res, next) => {
    await auditService.logPageView(Page.BASIC_DETAILS, { who: res.locals.user.username, correlationId: req.id })
    const token = await hmppsAuthClient.getSystemClientToken(res.locals.user.username)
    const breachNoticeApiClient = new BreachNoticeApiClient(token)
    const ndeliusIntegrationApiClient = new NdeliusIntegrationApiClient(token)

    const breachNotice = await breachNoticeApiClient.getBreachNoticeById(req.params.id as string)
    const basicDetails = await ndeliusIntegrationApiClient.getBasicDetails(breachNotice.crn, req.user.username)
    if (await commonUtils.redirectRequired(breachNotice, res)) return
    const defaultOffenderAddress: DeliusAddress = findDefaultAddressInAddressList(basicDetails.addresses)
    const defaultReplyAddress: DeliusAddress = findDefaultAddressInAddressList(basicDetails.replyAddresses)
    const basicDetailsDateOfLetter: string = toUserDate(breachNotice.dateOfLetter)

    const alternateAddressOptions = arrangeSelectItemListAlphabetically(
      addressListToSelectItemList(
        removeDeliusAddressFromDeliusAddressList(basicDetails.addresses, defaultOffenderAddress),
        breachNotice.basicDetailsSaved,
        breachNotice.offenderAddress?.addressId,
      ),
    )

    const replyAddressOptions = arrangeSelectItemListAlphabetically(
      addressListToSelectItemList(
        removeDeliusAddressFromDeliusAddressList(basicDetails.replyAddresses, defaultReplyAddress),
        breachNotice.basicDetailsSaved,
        breachNotice.replyAddress?.addressId,
      ),
    )

    // show a warning is a previously saved address is no longer returned from the integration
    const errorMessages: ErrorMessages = {}

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
    })
  })

  // function validateAddressesPresent()

  post('/basic-details/:id', async (req, res, next) => {
    const token = await hmppsAuthClient.getSystemClientToken(res.locals.user.username)
    const breachNoticeApiClient = new BreachNoticeApiClient(token)
    const ndeliusIntegrationApiClient = new NdeliusIntegrationApiClient(token)

    const { id } = req.params
    const currentBreachNotice = await breachNoticeApiClient.getBreachNoticeById(req.params.id as string)

    if (await commonUtils.redirectRequired(currentBreachNotice, res)) return

    const basicDetails = await ndeliusIntegrationApiClient.getBasicDetails(currentBreachNotice.crn, req.user.username)
    const updatedBreachNotice = applyDefaults(currentBreachNotice, basicDetails)

    const defaultOffenderAddress: DeliusAddress = findDefaultAddressInAddressList(basicDetails.addresses)
    const defaultReplyAddress: DeliusAddress = findDefaultAddressInAddressList(basicDetails.replyAddresses)
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
    // reply address
    if (req.body.replyAddressSelectOne === 'No') {
      updatedBreachNotice.replyAddress = mapDeliusAddressToBreachNoticeAddress(
        getSelectedAddress(basicDetails.replyAddresses, req.body.alternateReplyAddress),
      )
      updatedBreachNotice.useDefaultReplyAddress = false
    } else if (req.body.replyAddressSelectOne === 'Yes') {
      updatedBreachNotice.replyAddress = mapDeliusAddressToBreachNoticeAddress(defaultReplyAddress)
      updatedBreachNotice.useDefaultReplyAddress = true
    } else {
      updatedBreachNotice.useDefaultReplyAddress = null
    }

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
      } else {
        res.redirect(`/warning-type/${id}`)
      }
    } else {
      const alternateAddressOptions = arrangeSelectItemListAlphabetically(
        addressListToSelectItemList(
          basicDetails.addresses,
          updatedBreachNotice.basicDetailsSaved,
          updatedBreachNotice.offenderAddress?.addressId,
        ),
      )
      const replyAddressOptions = arrangeSelectItemListAlphabetically(
        addressListToSelectItemList(
          basicDetails.replyAddresses,
          updatedBreachNotice.basicDetailsSaved,
          updatedBreachNotice.replyAddress?.addressId,
        ),
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
    return [
      {
        text: 'Please Select',
        value: '-1',
        selected: true,
      },
      ...addresses.map(address => ({
        text: formatAddressForSelectMenuDisplay(address),
        value: `${address.id}`,
        selected: breachNoticeSaved && address.id === selectedAddressId,
      })),
    ]
  }

  function findDefaultAddressInAddressList(addressList: Array<DeliusAddress>): DeliusAddress {
    return (
      addressList.find(a => a.status === 'Default') ??
      addressList.find(a => a.status === 'Postal') ??
      addressList.find(a => a.status === 'Main')
    )
  }

  return router
}
