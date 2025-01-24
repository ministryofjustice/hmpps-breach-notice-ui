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
  dateOfLetter: Date
  referenceNumber: string
  responseRequiredByDate: Date
  breachNoticeTypeCode: string
  breachConditionTypeCode: string
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
}

export interface BasicDetails {
  title: string
  name: Name
  addresses: AddressList
  replyAddresses: AddressList
}

export interface Name {
  forename: string
  middleName: string
  surname: string
}

export interface Address {
  type: string
  buildingName: string
  buildingNumber: string
  streetName: string
  townCity: string
  district: string
  county: string
  postcode: string
}

export type AddressList = Array<Address>
