import config from '../config'
import RestClient from './restClient'
import { ReferenceData } from './ndeliusIntegrationApiClient'
import { Address } from './commonModels'

export default class BreachNoticeApiClient extends RestClient {
  constructor(token: string) {
    super('Breach Notice API', config.apis.breachNotice, token)
  }

  async getBreachNoticeById(uuid: string): Promise<BreachNotice> {
    return this.get({
      path: `/breach-notice/${uuid}`,
    })
  }

  async updateBreachNotice(id: string, breachNotice: BreachNotice) {
    await this.put({
      path: `/breach-notice/${id}`,
      data: breachNotice as unknown as Record<string, unknown>,
    })
  }

  async getPdfById(uuid: string): Promise<ArrayBuffer> {
    return this.get({
      path: `/breach-notice/${uuid}/pdf`,
      responseType: 'arraybuffer',
    })
  }

  async getDraftPdfById(uuid: string): Promise<ArrayBuffer> {
    return this.get({
      path: `/breach-notice/${uuid}/pdf`,
      responseType: 'arraybuffer',
    })
  }

  async deleteBreachNotice(id: string) {
    await this.delete({
      path: `/breach-notice/${id}`,
    })
  }
}

export interface BreachNotice {
  id: string
  crn: string
  titleAndFullName: string
  dateOfLetter: string
  referenceNumber: string
  responseRequiredByDate: string
  breachNoticeTypeCode: string
  breachNoticeTypeDescription: string
  breachConditionTypeCode: string
  breachConditionTypeDescription: string
  breachSentenceTypeCode: string
  breachSentenceTypeDescription: string
  responsibleOfficer: string
  contactNumber: string
  nextAppointmentType: string
  nextAppointmentDate: string
  nextAppointmentLocation: string
  nextAppointmentOfficer: string
  nextAppointmentId: number
  completedDate: Date
  offenderAddress: Address
  replyAddress: Address
  basicDetailsSaved: boolean
  warningTypeSaved: boolean
  warningDetailsSaved: boolean
  nextAppointmentSaved: boolean
  useDefaultAddress: boolean
  useDefaultReplyAddress: boolean
  reviewRequiredDate: Date
  breachNoticeContactList: BreachNoticeContact[]
  breachNoticeRequirementList: BreachNoticeRequirement[]
  optionalNumberChecked: boolean
  optionalNumber: string
}

export interface BreachNoticeContact {
  id: string
  breachNoticeId: string
  contactDate: string
  contactDateString?: string
  contactTimeString?: string
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

// these must be value, text, boolean so they can be fed into MOJ components
export interface SelectItem {
  value: string
  text: string
  selected: boolean
}

export interface RadioButton {
  value: string
  text: string
  checked: boolean
}

export interface EnforceableContactRadioButton {
  datetime: string
  type: ReferenceData
  outcome: ReferenceData
  notes: string
  requirement: Requirement
  checked: string
  value: string
  text: string
}

export interface Requirement {
  id: number
  type: ReferenceData
  subType: ReferenceData
}

export interface WarningDetailsRequirementSelectItem {
  value: string
  text: string
  selected: boolean
  requirements: SelectItem[]
}

export interface ErrorMessages {
  [key: string]: { text: string }
}

export interface FutureAppointment {
  contactId: number
  datetime: string
  description: string
  type: ReferenceData
  location: Address
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

export interface Name {
  forename: string
  middleName: string
  surname: string
}
