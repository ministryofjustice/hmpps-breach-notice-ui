import { LocalDateTime } from '@js-joda/core'
import config from '../config'
import RestClient from './restClient'

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
}

export interface BreachNotice {
  id: string
  crn: string
  titleAndFullName: string
  dateOfLetter: string
  referenceNumber: string
  responseRequiredByDate: Date
  breachNoticeTypeCode: string
  breachNoticeTypeDescription: string
  breachConditionTypeCode: string
  breachConditionTypeDescription: string
  breachSentenceTypeCode: string
  breachSentenceTypeDescription: string
  responsibleOfficer: string
  contactNumber: string
  nextAppointmentType: string
  nextAppointmentDate: Date
  nextAppointmentLocation: string
  nextAppointmentOfficer: string
  completedDate: Date
  offenderAddress: Address
  replyAddress: Address
  basicDetailsSaved: boolean
  warningTypeSaved: boolean
  warningDetailsSaved: boolean
  nextAppointmentSaved: boolean
  useDefaultAddress: boolean
  useDefaultReplyAddress: boolean
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

export interface Address {
  addressId: number
  type: string
  buildingName: string
  addressNumber: string
  streetName: string
  townCity: string
  district: string
  county: string
  postcode: string
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

export interface EnforceableContact {
  id: number
  datetime: LocalDateTime
  description: string
  type: ReferenceData
  outcome: ReferenceData
  notes: string
  requirement: Requirement
}

export interface EnforceableContactRadioButton {
  datetime: LocalDateTime
  type: ReferenceData
  outcome: ReferenceData
  notes: string
  requirement: Requirement
  checked: string
  value: string
  text: string
}

export interface Requirement {
  type: ReferenceData
  subType: ReferenceData
}

export interface WarningDetailsRequirementSelectItem {
  value: string
  text: string
  selected: boolean
  requirements: SelectItemList
}

export interface ErrorMessages {
  [key: string]: { text: string }
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
