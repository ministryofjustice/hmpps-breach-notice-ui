import { ZonedDateTime } from '@js-joda/core'
import { AuthenticationClient } from '@ministryofjustice/hmpps-auth-clients'
import { asSystem, RestClient } from '@ministryofjustice/hmpps-rest-client'
import config from '../config'
import logger from '../../logger'

export default class BreachNoticeApiClient extends RestClient {
  constructor(authenticationClient: AuthenticationClient) {
    super('Breach Notice API', config.apis.breachNotice, logger, authenticationClient)
  }

  async getBreachNoticeById(uuid: string, username: string): Promise<BreachNotice> {
    return this.get(
      {
        path: `/breach-notice/${uuid}`,
      },
      asSystem(username),
    )
  }

  async updateBreachNotice(id: string, breachNotice: BreachNotice, username: string) {
    await this.put(
      {
        path: `/breach-notice/${id}`,
        data: breachNotice as unknown as Record<string, unknown>,
      },
      asSystem(username),
    )
  }

  async getPdfById(uuid: string, username: string): Promise<ArrayBuffer> {
    return this.get(
      {
        path: `/breach-notice/${uuid}/pdf`,
        responseType: 'arraybuffer',
      },
      asSystem(username),
    )
  }

  async getDraftPdfById(uuid: string, username: string): Promise<ArrayBuffer> {
    return this.get(
      {
        path: `/breach-notice/${uuid}/pdf`,
        responseType: 'arraybuffer',
      },
      asSystem(username),
    )
  }

  async deleteBreachNotice(id: string, username: string) {
    await this.delete(
      {
        path: `/breach-notice/${id}`,
      },
      asSystem(username),
    )
  }

  async batchUpdateBreachNoticeContacts(
    breachNoticeId: string,
    contacts: Array<BreachNoticeContact>,
    username: string,
  ) {
    return this.put(
      {
        path: `/contacts/${breachNoticeId}`,
        data: contacts as unknown as Record<string, unknown>,
      },
      asSystem(username),
    )
  }

  async createBreachNoticeContact(breachNoticeContact: BreachNoticeContact, username: string): Promise<string> {
    return this.post(
      {
        path: `/contact`,
        data: breachNoticeContact as unknown as Record<string, unknown>,
      },
      asSystem(username),
    )
  }

  async getBreachNoticeContact(id: string, deliusContactId: number, username: string): Promise<BreachNoticeContact> {
    return this.get(
      {
        path: `/contact/bybreachnoticeidanddeliusid/${id}/${deliusContactId}`,
      },
      asSystem(username),
    )
  }

  async getBreachNoticeContactsForBreachNotice(id: string, username: string): Promise<Array<BreachNoticeContact>> {
    return this.get(
      {
        path: `/contact/bybreachnoticeid/${id}`,
      },
      asSystem(username),
    )
  }

  async deleteBreachNoticeContact(breachContactId: string, username: string) {
    return this.delete(
      {
        path: `/contact/${breachContactId}`,
      },
      asSystem(username),
    )
  }

  async updateBreachNoticeRequirement(
    id: string,
    breachNoticeRequirement: BreachNoticeRequirement,
    username: string,
  ): Promise<BreachNoticeRequirement> {
    return this.put(
      {
        path: `/requirement/${id}`,
        data: breachNoticeRequirement as unknown as Record<string, unknown>,
      },
      asSystem(username),
    )
  }

  async createBreachNoticeRequirement(
    breachNoticeRequirement: BreachNoticeRequirement,
    username: string,
  ): Promise<string> {
    return this.post(
      {
        path: `/requirement`,
        data: breachNoticeRequirement as unknown as Record<string, unknown>,
      },
      asSystem(username),
    )
  }

  async getContactRequirementLinks(id: string, username: string): Promise<Array<ContactRequirement>> {
    return this.get(
      {
        path: `/crlinks/bybreachnoticeid/${id}`,
      },
      asSystem(username),
    )
  }

  async getContactRequirementLinksWithContact(
    id: string,
    contactId: string,
    username: string,
  ): Promise<Array<ContactRequirement>> {
    return this.get(
      {
        path: `/crlinks/bybreachnoticeidandcontactid/${id}/${contactId}`,
      },
      asSystem(username),
    )
  }

  async addContactRequirementLink(crlink: ContactRequirement, username: string) {
    return this.post(
      {
        path: `/crlinks`,
        data: crlink as unknown as Record<string, unknown>,
      },
      asSystem(username),
    )
  }

  async deleteContactRequirementLink(id: string, username: string) {
    return this.delete(
      {
        path: `/crlinks/${id}`,
      },
      asSystem(username),
    )
  }

  async deleteUnlinkedRequirements(id: string, username: string) {
    return this.delete(
      {
        path: `/requirement/unlinkedrequirements/${id}`,
      },
      asSystem(username),
    )
  }

  async recalculateRequirementFromToDate(breachNoticeId: string, username: string) {
    return this.put(
      {
        path: `/requirement/recalculateFromToDate/${breachNoticeId}`,
      },
      asSystem(username),
    )
  }

  async batchDeleteContacts(id: string, contactIds: Array<string>, username: string): Promise<void> {
    const promises = []
    for (const contactId of contactIds) {
      promises.push(this.deleteBreachNoticeContact(contactId, username))
    }
    await Promise.all(promises)
    await this.deleteUnlinkedRequirements(id, username)
    await this.recalculateRequirementFromToDate(id, username)
  }

  async batchUpdateContacts(
    breachNoticeId: string,
    contacts: Array<BreachNoticeContact>,
    username: string,
  ): Promise<void> {
    const promises = []
    const contactsToUpdate: Array<BreachNoticeContact> = []
    const contactsToAdd: Array<BreachNoticeContact> = []

    if (contacts && Object.keys(contacts).length > 0) {
      for (const contact of contacts) {
        if (contact.id && contact.id.length > 0) {
          contactsToUpdate.push(contact)
        } else {
          contactsToAdd.push(contact)
        }
      }
    }

    if (contactsToUpdate && Object.keys(contactsToUpdate).length > 0) {
      promises.push(this.batchUpdateBreachNoticeContacts(breachNoticeId, contactsToUpdate, username))
    }

    if (contactsToAdd && Object.keys(contactsToAdd).length > 0) {
      for (const contactBeingAdded of contactsToAdd) {
        promises.push(this.createBreachNoticeContact(contactBeingAdded, username))
      }
    }
    await Promise.all(promises)
  }

  async batchCreateContactRequirements(crlinks: Array<ContactRequirement>, username: string): Promise<void> {
    const promises = []
    for (const crlink of crlinks) {
      promises.push(this.addContactRequirementLink(crlink, username))
    }
    await Promise.all(promises)
  }

  async batchDeleteContactRequirements(crlinks: Array<ContactRequirement>, username: string): Promise<void> {
    const promises = []
    for (const crlink of crlinks) {
      promises.push(this.deleteContactRequirementLink(crlink.id, username))
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
  alternateNextAppointmentLocation: BreachNoticeAddress
  alternateNextAppointmentLocationSelected: boolean
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
  alternateNextAppointmentLocation?: BreachNoticeAddress
  alternateNextAppointmentLocationSelected?: boolean
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
