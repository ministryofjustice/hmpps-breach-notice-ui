import config from '../config'
import RestClient from './restClient'
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
  responseRequiredDate: string
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
  requirementTypeMainCategoryDescription: string
  requirementTypeSubCategoryDescription: string
  rejectionReason: string
}

export interface EnforceableContact {
  id: number
  datetime: string
  description: string
  type: ReferenceData
  outcome: ReferenceData
  notes: string
  requirement: Requirement
}

export interface BasicDetails {
  title: string
  name: Name
  addresses: AddressList
  replyAddresses: AddressList
}

export interface WarningDetails {
  breachReasons: ReferenceDataList
  sentenceTypes: SentenceTypeList
  defaultSentenceTypeCode: string
  enforceableContactList: EnforceableContactList
}

export interface WarningTypeDetails {
  warningTypes: RadioButtonList
  sentenceTypes: SentenceTypeList
}

export interface Name {
  forename: string
  middleName: string
  surname: string
}

// these must be value, text, boolean so they can be fed into MOJ components
export interface SelectItem {
  value: string
  text: string
  selected: boolean
}

// Reference Data
export interface ReferenceData {
  code: string
  description: string
}

// Reference Data
export interface SentenceType {
  code: string
  description: string
  conditionBeingEnforced: string
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
  checked: boolean
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
  breachReasons: SelectItem[]
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

export type WarningDetailsRequirementSelectItemsList = Array<WarningDetailsRequirementSelectItem>

export type EnforceableContactRadioButtonList = Array<EnforceableContactRadioButton>

export type AddressList = Array<Address>

export type SelectItemList = Array<SelectItem>

export type RadioButtonList = Array<RadioButton>

export type ReferenceDataList = Array<ReferenceData>

export type SentenceTypeList = Array<SentenceType>

export type EnforceableContactList = Array<EnforceableContact>

export type RequirementList = Array<Requirement>

export type BreachNoticeContactList = Array<BreachNoticeContact>

export type BreachNoticeRequirementList = Array<BreachNoticeRequirement>
