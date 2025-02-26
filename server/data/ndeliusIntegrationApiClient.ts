import { LocalDateTime } from '@js-joda/core'
import config from '../config'
import RestClient from './restClient'
import { Address } from './commonModels'

export default class NdeliusIntegrationApiClient extends RestClient {
  constructor(token: string) {
    super('NDelius Integration API', config.apis.ndeliusIntegration, token)
  }

  async getBasicDetails(crn: string, username: string): Promise<BasicDetails> {
    if (config.apis.ndeliusIntegration.enabled === false) {
      return createDummyBasicDetails()
    }
    return this.get({
      path: `/basic-details/${crn}/${username}`,
    })
  }

  async getWarningTypes(): Promise<WarningTypeWrapper> {
    if (config.apis.ndeliusIntegration.enabled === false) {
      return createDummyWarningTypes()
    }
    return this.get({
      path: `/warning-types`,
    })
  }

  async getWarningDetails(crn: string): Promise<WarningDetails> {
    if (config.apis.ndeliusIntegration.enabled === false) {
      return createDummyWarningDetails()
    }
    return this.get({
      path: `/warning-details/${crn}`,
    })
  }

  async getLimitedAccessCheck(crn: string, username: string): Promise<LimitedAccessCheck> {
    if (config.apis.ndeliusIntegration.enabled === false) {
      return createDummyLaoCheck()
    }
    return this.get({
      path: `/users/${username}/access/${crn}`,
    })
  }
}

export interface Name {
  forename: string
  middleName: string
  surname: string
}

export interface BasicDetails {
  title: string
  name: Name
  addresses: Address[]
  replyAddresses: Address[]
}

export interface LimitedAccessCheck {
  isExcluded: boolean
  exclusionMessage?: string
  isRestricted: boolean
  restrictionMessage?: string
}

// Reference Data
export interface SentenceType {
  code: string
  description: string
  conditionBeingEnforced: string
}

export interface WarningType {
  code: string
  description: string
}

export interface WarningTypeWrapper {
  content: WarningType[]
}

export interface WarningDetails {
  breachReasons: ReferenceData[]
  sentenceTypes: SentenceType[]
  defaultSentenceTypeCode: string
  enforceableContactList: EnforceableContact[]
}

export interface ReferenceData {
  code: string
  description: string
}

export interface BreachNoticeContact {
  id: string
  breachNoticeId: string
  contactDate: LocalDateTime
  contactType: string
  contactOutcome: string
  contactId: number
}

export interface BreachNoticeRequirement {
  id: string
  breachNoticeId: string
  requirementId: number
  mainCategoryDescription: string
  subCategoryDescription: string
  rejectionReason: string
}

export interface EnforceableContact {
  id: number
  datetime: LocalDateTime
  description: string
  type: ReferenceData
  outcome: ReferenceData
  notes: string
  requirement: Requirement
}

export interface Requirement {
  id: number
  type: ReferenceData
  subType: ReferenceData
}

// Dummy data for running offline
function createDummyBasicDetails(): BasicDetails {
  return {
    title: 'Mr',
    name: createDummyName(),
    addresses: createDummyAddressList(),
    replyAddresses: createDummyReplyAddressList(),
  }
}
function createDummyAddressList(): Array<Address> {
  const postalAddress: Address = {
    addressId: 12345,
    type: 'Postal',
    buildingName: null,
    buildingNumber: '21',
    county: 'Postal County',
    district: 'Postal District',
    postcode: 'NE30 3ZZ',
    streetName: 'Postal Street',
    townCity: 'PostCity',
  }

  const mainAddress: Address = {
    addressId: 67891,
    type: 'Main',
    buildingName: null,
    buildingNumber: '666',
    county: 'Some County',
    district: 'Some District',
    postcode: 'NE30 3AB',
    streetName: 'The Street',
    townCity: 'Newcastle',
  }

  return [postalAddress, mainAddress]
}

function createDummyReplyAddressList(): Array<Address> {
  const postalAddress: Address = {
    addressId: 33333,
    type: 'Postal',
    buildingName: null,
    buildingNumber: '21',
    county: 'Reply County',
    district: 'Reply District',
    postcode: 'NE22 3AA',
    streetName: 'Reply Street',
    townCity: 'Reply City',
  }

  const mainAddress: Address = {
    addressId: 44444,
    type: 'Main',
    buildingName: null,
    buildingNumber: '77',
    county: 'Tyne and Wear',
    district: 'Lake District',
    postcode: 'NE30 3CC',
    streetName: 'The Street',
    townCity: 'Newcastle',
  }

  return [postalAddress, mainAddress]
}

function createDummyName(): Name {
  const dummyName: Name = {
    forename: 'Billy',
    middleName: 'The',
    surname: 'Kid',
  }
  return dummyName
}

function createDummyWarningTypes(): WarningTypeWrapper {
  const formal: WarningType = {
    code: 'FOW',
    description: 'Formal Warning',
  }

  const final: WarningType = {
    code: 'FW',
    description: 'Final Warning',
  }

  const breach: WarningType = {
    code: 'BW',
    description: 'Breach Warning',
  }

  const wrapper: WarningTypeWrapper = {
    content: [formal, final, breach],
  }

  return wrapper
}

function createDummyWarningDetails(): WarningDetails {
  const enforceableContact1: EnforceableContact = {
    description:
      '02/10/2024, Rehabilitation Activity Requirement (RAR) - Rehabilitation Activity Requirement (RAR), Planned Office Visit (NS), Unacceptable absence',
    datetime: LocalDateTime.now(),
    id: 1,
    notes:
      'Lorem 1 ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum',
    outcome: createDummyReferenceData(),
    type: createDummyReferenceData(),
    requirement: createDummyRequirement(),
  }

  const enforceableContact2: EnforceableContact = {
    description: '01/08/2024, Unpaid Work - Regular, CP/UPW Appointment (NS), Sent Home (behavior)',
    datetime: LocalDateTime.now(),
    id: 2,
    notes:
      'Lorem 2 ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum',
    outcome: createDummyReferenceData(),
    type: createDummyReferenceData(),
    requirement: createDummyRequirement(),
  }

  const breachReason1: ReferenceData = {
    code: '2IN12',
    description: '2 occasions in a 12 month period',
  }

  const breachReason2: ReferenceData = {
    code: '3TOTAL',
    description: '3 occasions during your supervision period',
  }

  const sentenceType1: SentenceType = {
    code: `CO`,
    description: 'Community Order(s)',
    conditionBeingEnforced: 'Test Condition CO',
  }
  const sentenceType2: SentenceType = {
    code: `SSO`,
    description: 'Suspended Supervision Order(s)',
    conditionBeingEnforced: 'Test Condition SSO',
  }

  const warningDetails: WarningDetails = {
    breachReasons: [breachReason1, breachReason2],
    enforceableContactList: [enforceableContact1, enforceableContact2],
    sentenceTypes: [sentenceType1, sentenceType2],
    defaultSentenceTypeCode: sentenceType1.code,
  }

  return warningDetails
}

function createDummyReferenceData(): ReferenceData {
  return {
    code: 'DUM1',
    description: 'Dummy 1',
  }
}

function createDummyRequirement(): Requirement {
  return {
    id: 1,
    type: createDummyReferenceData(),
    subType: createDummyReferenceData(),
  }
}

function createDummyLaoCheck(): LimitedAccessCheck {
  return {
    isExcluded: false,
    isRestricted: false,
  }
}
