import { ParsedQs } from 'qs'
import { DeliusAddress, Name } from '../data/ndeliusIntegrationApiClient'
import { BreachNotice, BreachNoticeAddress } from '../data/breachNoticeApiClient'
import { ErrorMessages, SelectItem } from '../data/uiModels'

const properCase = (word: string): string =>
  word.length >= 1 ? word[0].toUpperCase() + word.toLowerCase().slice(1) : word

const isBlank = (str: string): boolean => !str || /^\s*$/.test(str)

/**
 * Converts a name (first name, last name, middle name, etc.) to proper case equivalent, handling double-barreled names
 * correctly (i.e. each part in a double-barreled is converted to proper case).
 * @param name name to be converted.
 * @returns name converted to proper case.
 */
const properCaseName = (name: string): string => (isBlank(name) ? '' : name.split('-').map(properCase).join('-'))

export const convertToTitleCase = (sentence: string): string =>
  isBlank(sentence) ? '' : sentence.split(' ').map(properCaseName).join(' ')

export const initialiseName = (fullName?: string): string | null => {
  // this check is for the authError page
  if (!fullName) return null

  const array = fullName.split(' ')
  return `${array[0][0]}. ${array.reverse()[0]}`
}

export function combineName(title: string, name: Name) {
  return [title, name.forename, name.middleName, name.surname].filter(n => n).join(' ')
}

export default function asArray(param: undefined | string | ParsedQs | (string | ParsedQs)[]): string[] {
  if (param === undefined) return []
  return Array.isArray(param) ? (param as string[]) : [param as string]
}

export function mapDeliusAddressToBreachNoticeAddress(deliusAddress: DeliusAddress): BreachNoticeAddress {
  if (deliusAddress) {
    return {
      addressId: deliusAddress.id,
      status: deliusAddress.status,
      officeDescription: deliusAddress.officeDescription,
      buildingName: deliusAddress.buildingName,
      buildingNumber: deliusAddress.buildingNumber,
      streetName: deliusAddress.streetName,
      townCity: deliusAddress.townCity,
      district: deliusAddress.district,
      county: deliusAddress.county,
      postcode: deliusAddress.postcode,
    }
  }
  return null
}

export function formatAddressForSelectMenuDisplay(deliusAddress: DeliusAddress): string {
  if (deliusAddress) {
    return [
      deliusAddress.officeDescription,
      deliusAddress.buildingName,
      [deliusAddress.buildingNumber, deliusAddress.streetName]
        .filter(item => item)
        .join(' ')
        .trim(),
      deliusAddress.district,
      deliusAddress.townCity,
      deliusAddress.county,
      deliusAddress.postcode,
    ]
      .filter(item => item)
      .join(', ')
  }
  return null
}

export function arrangeSelectItemListAlphabetically(selectItemsToSort: SelectItem[]): SelectItem[] {
  if (selectItemsToSort) {
    return selectItemsToSort.sort((a, b) => a?.text.localeCompare(b?.text, 'en', { numeric: true }))
  }
  return selectItemsToSort
}

export function removeDeliusAddressFromDeliusAddressList(
  deliusAddressList: DeliusAddress[],
  defaultAddress: DeliusAddress,
): DeliusAddress[] {
  if (defaultAddress && deliusAddressList) {
    return deliusAddressList.filter(obj => obj.id !== defaultAddress.id)
  }
  return deliusAddressList
}

export function handleIntegrationErrors(status: number, message: string, integrationService: string): ErrorMessages {
  const errorMessages: ErrorMessages = {}
  if (status === 400) {
    if (message?.includes('No home area found')) {
      errorMessages.genericErrorMessage = {
        text: 'Your Delius account is missing a home area, please contact the service desk to update your account before using this service.',
      }
    } else if (message?.includes('is not sentenced')) {
      errorMessages.genericErrorMessage = {
        text: 'Breach actions cannot be created pre-sentence. If this event has a valid sentence please contact the service desk and report this error.',
      }
    } else {
      errorMessages.genericErrorMessage = {
        text: 'An unexpected 400 type error has occurred. Please contact the service desk and report this error.',
      }
    }
    return errorMessages
  }

  if (integrationService === 'NDelius Integration') {
    errorMessages.genericErrorMessage = {
      text: 'There has been a problem fetching information from NDelius. Please try again later.',
    }
  } else {
    errorMessages.genericErrorMessage = {
      text: 'There has been a problem fetching information from the Breach Notice Service. Please try again later.',
    }
  }

  return errorMessages
}

export function createBlankBreachNoticeWithId(id: string): BreachNotice {
  return {
    basicDetailsSaved: false,
    breachConditionTypeCode: '',
    breachConditionTypeDescription: '',
    breachNoticeContactList: [],
    breachNoticeRequirementList: [],
    breachNoticeTypeCode: '',
    breachNoticeTypeDescription: '',
    breachSentenceTypeCode: '',
    breachSentenceTypeDescription: '',
    completedDate: undefined,
    conditionBeingEnforced: '',
    contactNumber: '',
    crn: '',
    dateOfLetter: '',
    furtherReasonDetails: '',
    nextAppointmentDate: '',
    nextAppointmentId: 0,
    nextAppointmentLocation: '',
    nextAppointmentOfficer: '',
    nextAppointmentSaved: false,
    nextAppointmentType: '',
    offenderAddress: undefined,
    optionalNumber: '',
    optionalNumberChecked: false,
    referenceNumber: '',
    replyAddress: undefined,
    responseRequiredDate: '',
    responsibleOfficer: '',
    reviewEvent: '',
    reviewRequiredDate: undefined,
    selectNextAppointment: false,
    titleAndFullName: '',
    useDefaultAddress: false,
    useDefaultReplyAddress: false,
    warningDetailsSaved: false,
    warningTypeSaved: false,
    id,
  }
}
