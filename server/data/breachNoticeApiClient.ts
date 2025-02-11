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

export interface WarningTypeDetails {
  warningTypes: RadioButtonList
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

export interface RadioButton {
  value: string
  text: string
  checked: boolean
}

export interface ErrorMessages {
  [key: string]: { text: string }
}

export type AddressList = Array<Address>

export type SelectItemList = Array<SelectItem>

export type RadioButtonList = Array<RadioButton>
