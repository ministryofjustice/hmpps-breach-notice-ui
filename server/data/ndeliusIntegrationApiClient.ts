import { LocalDateTime } from '@js-joda/core'
import config from '../config'
import RestClient from './restClient'

export default class NdeliusIntegrationApiClient extends RestClient {
  constructor(token: string) {
    super('NDelius Integration API', config.apis.ndeliusIntegration, token)
  }

  async getBasicDetails(crn: string, username: string): Promise<BasicDetails> {
    return this.get({
      path: `/basic-details/${crn}/${username}`,
    })
  }

  async getWarningTypes(crn: string, breachNoticeId: string): Promise<WarningTypeWrapper> {
    return this.get({
      path: `/warning-types/${crn}/${breachNoticeId}`,
    })
  }

  async getWarningDetails(crn: string, breachNoticeId: string): Promise<WarningDetails> {
    return this.get({
      path: `/warning-details/${crn}/${breachNoticeId}`,
    })
  }

  async getNextAppointmentDetails(crn: string): Promise<NextAppointmentDetails> {
    return this.get({
      path: `/next-appointment-details/${crn}`,
    })
  }

  async getLimitedAccessCheck(crn: string, username: string): Promise<LimitedAccessCheck> {
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
  addresses: DeliusAddress[]
  replyAddresses: DeliusAddress[]
}

export interface LimitedAccessCheck {
  crn: string
  userExcluded: boolean
  exclusionMessage?: string
  userRestricted: boolean
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
  warningTypes: WarningType[]
  sentenceTypes: SentenceType[]
  defaultSentenceTypeCode: string
}

export interface WarningDetails {
  breachReasons: ReferenceData[]
  enforceableContacts: EnforceableContact[]
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

export interface FutureAppointment {
  id: number
  datetime: string
  description: string
  type: ReferenceData
  location: DeliusAddress
  officer: Officer
}

export interface NextAppointmentDetails {
  responsibleOfficer: ResponsibleOfficer
  futureAppointments: Array<FutureAppointment>
}

export interface ResponsibleOfficer {
  telephoneNumber: string
  name: Name
}

export interface Officer {
  code: string
  name: Name
}

export interface DeliusAddress {
  id: number
  status: string
  officeDescription?: string
  buildingName: string
  buildingNumber: string
  streetName: string
  townCity: string
  district: string
  county: string
  postcode: string
}

export type EnforceableContactList = Array<EnforceableContact>
