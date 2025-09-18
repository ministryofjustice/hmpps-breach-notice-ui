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

  async updateBreachNoticeContact(
    id: string,
    breachNoticeContacts: Array<BreachNoticeContact>,
  ): Promise<Array<BreachNoticeContact>> {
    return this.put({
      path: `/breach-notice/${id}/contact`,
      data: breachNoticeContacts as unknown as Record<string, unknown>,
    })
  }

  async getBreachNoticeContact(id: string, deliusContactId: number): Promise<BreachNoticeContact> {
    return this.get({
      path: `/breach-notice/${id}/contact/${deliusContactId}`,
    })
  }

  async deleteBreachNoticeContact(id: string, deliusContactId: number) {
    return this.delete({
      path: `/breach-notice/${id}/contact/${deliusContactId}`,
    })
  }

  async updateBreachNoticeRequirement(
    id: string,
    breachNoticeRequirement: BreachNoticeRequirement,
  ): Promise<BreachNoticeRequirement> {
    return this.put({
      path: `/breach-notice/${id}/requirement`,
      data: breachNoticeRequirement as unknown as Record<string, unknown>,
    })
  }

  async getContactRequirementLinks(id: string): Promise<Array<ContactRequirement>> {
    return this.get({
      path: `/breach-notice/${id}/crlinks`,
    })
  }

  async getContactRequirementLinksWithContact(id: string, contactId: string): Promise<Array<ContactRequirement>> {
    return this.get({
      path: `/breach-notice/${id}/crlinks/${contactId}`,
    })
  }

  async updateContactRequirementLinks(id: string, contactId: string, crlinks: Array<ContactRequirement>) {
    return this.put({
      path: `/breach-notice/${id}/crlinks/${contactId}`,
      data: crlinks as unknown as Record<string, unknown>,
    })
  }

  async deleteUnlinkedRequirements(id: string) {
    return this.delete({
      path: `/breach-notice/${id}/unlinkedrequirements`,
    })
  }

  async batchDeleteContacts(id: string, contactIds: Array<number>): Promise<void> {
    const promises = []
    for (const contactId of contactIds) {
      promises.push(this.deleteBreachNoticeContact(id, contactId))
    }
    await Promise.all(promises)
    await this.deleteUnlinkedRequirements(id)
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
  furtherReasonDetails: string
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

export interface RequirementSelectItem {
  value: string
  text: string
  checked: boolean
  conditional: {
    html: string
  }
}

export interface ContactRequirement {
  breachNoticeId: string
  contactId: string
  contact: BreachNoticeContact
  requirementId: string
  requirement: BreachNoticeRequirement
}
