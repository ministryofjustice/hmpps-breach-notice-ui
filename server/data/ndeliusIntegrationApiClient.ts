import { LocalDateTime } from '@js-joda/core'
import { asSystem, RestClient } from '@ministryofjustice/hmpps-rest-client'
import { AuthenticationClient } from '@ministryofjustice/hmpps-auth-clients'
import config from '../config'
import { SelectItem } from './uiModels'
import logger from '../../logger'

export default class NdeliusIntegrationApiClient extends RestClient {
  constructor(authenticationClient: AuthenticationClient) {
    super('NDelius Integration API', config.apis.ndeliusIntegration, logger, authenticationClient)
  }

  async getBasicDetails(crn: string, username: string): Promise<BasicDetails> {
    return this.get(
      {
        path: `/basic-details/${crn}/${username}`,
      },
      asSystem(username),
    )
  }

  async getWarningTypes(crn: string, breachNoticeId: string, username: string): Promise<WarningTypeWrapper> {
    return this.get(
      {
        path: `/warning-types/${crn}/${breachNoticeId}`,
      },
      asSystem(username),
    )
  }

  async getWarningDetails(crn: string, breachNoticeId: string, username: string): Promise<WarningDetails> {
    return this.get(
      {
        path: `/warning-details/${crn}/${breachNoticeId}`,
      },
      asSystem(username),
    )
  }

  async getRequirements(breachNoticeId: string, username: string): Promise<Requirements> {
    return this.get(
      {
        path: `/requirements/${breachNoticeId}`,
      },
      asSystem(username),
    )
  }

  async getNextAppointmentDetails(crn: string, username: string): Promise<NextAppointmentDetails> {
    return this.get(
      {
        path: `/next-appointment-details/${crn}`,
      },
      asSystem(username),
    )
  }

  async getLimitedAccessCheck(crn: string, username: string): Promise<LimitedAccessCheck> {
    return this.get(
      {
        path: `/users/${username}/access/${crn}`,
      },
      asSystem(username),
    )
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
  enforceableContacts: (EnforceableContact & { wholeSentence?: boolean; rejectionReasons?: SelectItem[] })[]
  breachReasons: ReferenceData[]
}

export interface Requirements {
  requirements: Requirement[]
  breachReasons: ReferenceData[]
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
  datetime: string
  description: string
  type: ReferenceData
  outcome: ReferenceData
  notes: string
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
export type RequirementList = Array<Requirement>
