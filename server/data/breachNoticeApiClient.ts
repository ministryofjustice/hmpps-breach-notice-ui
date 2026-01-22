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

  async updateBreachNoticeContact(breachNoticeContact: BreachNoticeContact) {
    return this.put({
      path: `/contact/${breachNoticeContact.id}`,
      data: breachNoticeContact as unknown as Record<string, unknown>,
    })
  }

  async createBreachNoticeContact(breachNoticeContact: BreachNoticeContact): Promise<string> {
    return this.post({
      path: `/contact`,
      data: breachNoticeContact as unknown as Record<string, unknown>,
    })
  }

  async getBreachNoticeContact(id: string, deliusContactId: number): Promise<BreachNoticeContact> {
    return this.get({
      path: `/contact/bybreachnoticeidanddeliusid/${id}/${deliusContactId}`,
    })
  }

  async getBreachNoticeContactsForBreachNotice(id: string): Promise<Array<BreachNoticeContact>> {
    return this.get({
      path: `/contact/bybreachnoticeid/${id}`,
    })
  }

  async deleteBreachNoticeContact(breachContactId: string) {
    return this.delete({
      path: `/contact/${breachContactId}`,
    })
  }

  async updateBreachNoticeRequirement(
    id: string,
    breachNoticeRequirement: BreachNoticeRequirement,
  ): Promise<BreachNoticeRequirement> {
    return this.put({
      path: `/requirement/${id}`,
      data: breachNoticeRequirement as unknown as Record<string, unknown>,
    })
  }

  async createBreachNoticeRequirement(breachNoticeRequirement: BreachNoticeRequirement): Promise<string> {
    return this.post({
      path: `/requirement`,
      data: breachNoticeRequirement as unknown as Record<string, unknown>,
    })
  }

  async getContactRequirementLinks(id: string): Promise<Array<ContactRequirement>> {
    return this.get({
      path: `/crlinks/bybreachnoticeid/${id}`,
    })
  }

  async getContactRequirementLinksWithContact(id: string, contactId: string): Promise<Array<ContactRequirement>> {
    return this.get({
      path: `/crlinks/bybreachnoticeidandcontactid/${id}/${contactId}`,
    })
  }

  async addContactRequirementLink(crlink: ContactRequirement) {
    return this.post({
      path: `/crlinks`,
      data: crlink as unknown as Record<string, unknown>,
    })
  }

  async deleteContactRequirementLink(id: string) {
    return this.delete({
      path: `/crlinks/${id}`,
    })
  }

  async deleteUnlinkedRequirements(id: string) {
    return this.delete({
      path: `/requirement/unlinkedrequirements/${id}`,
    })
  }

  async recalculateRequirementFromToDate(breachNoticeId: string) {
    return this.put({
      path: `/requirement/recalculateFromToDate/${breachNoticeId}`,
    })
  }

  async batchDeleteContacts(id: string, contactIds: Array<string>): Promise<void> {
    const promises = []
    for (const contactId of contactIds) {
      promises.push(this.deleteBreachNoticeContact(contactId))
    }
    await Promise.all(promises)
    await this.deleteUnlinkedRequirements(id)
    await this.recalculateRequirementFromToDate(id)
  }

  async batchUpdateContacts(breachNoticeId: string, contacts: Array<BreachNoticeContact>): Promise<void> {
    const promises = []
    for (const contact of contacts) {
      if (contact.id) {
        promises.push(this.updateBreachNoticeContact(contact))
      } else {
        promises.push(this.createBreachNoticeContact(contact))
      }
    }
    await Promise.all(promises)
  }

  async batchCreateContactRequirements(crlinks: Array<ContactRequirement>): Promise<void> {
    const promises = []
    for (const crlink of crlinks) {
      promises.push(this.addContactRequirementLink(crlink))
    }
    await Promise.all(promises)
  }

  async batchDeleteContactRequirements(crlinks: Array<ContactRequirement>): Promise<void> {
    const promises = []
    for (const crlink of crlinks) {
      promises.push(this.deleteContactRequirementLink(crlink.id))
    }
    await Promise.all(promises)
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

export interface WarningDetailsWholeSentenceAndRequirement {
  description: string
  wholeSentence: boolean
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
  wholeSentence?: boolean
  rejectionReason?: string
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

export interface WholeSentenceContactRequirementReason {
  contactId: string
  rejectionReason: string
  wholeSentenceSelected: boolean
}

export interface ContactRequirement {
  id?: string
  breachNoticeId: string
  contactId: string
  contact: BreachNoticeContact
  requirementId: string
  requirement: BreachNoticeRequirement
}
