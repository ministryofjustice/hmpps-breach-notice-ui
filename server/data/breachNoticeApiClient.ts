import { ZonedDateTime } from '@js-joda/core'
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
  completedDate: ZonedDateTime
  offenderAddress: BreachNoticeAddress
  replyAddress: BreachNoticeAddress
  basicDetailsSaved: boolean
  warningTypeSaved: boolean
  warningDetailsSaved: boolean
  nextAppointmentSaved: boolean
  useDefaultAddress: boolean
  useDefaultReplyAddress: boolean
  reviewRequiredDate: Date
  reviewEvent: string
  breachNoticeContactList: BreachNoticeContact[]
  breachNoticeRequirementList: BreachNoticeRequirement[]
  optionalNumberChecked: boolean
  optionalNumber: string
  conditionBeingEnforced: string
  selectNextAppointment: boolean
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
  fromDate: string
  toDate: string
}

export interface BreachNoticeAddress {
  id?: string
  addressId: number
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

export interface WarningDetailsRequirementSelectItem {
  value: string
  text: string
  checked: boolean
  conditional: {
    html: string
  }
}
