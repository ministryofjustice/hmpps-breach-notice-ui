import { ParsedQs } from 'qs'
import { DeliusAddress, Name } from '../data/ndeliusIntegrationApiClient'
import { BreachNoticeAddress } from '../data/breachNoticeApiClient'

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
