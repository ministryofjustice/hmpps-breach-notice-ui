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
}

export interface BreachNotice {
  id: string
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
  buildingName: string
  buildingNumber: string
  streetName: string
  townCity: string
  district: string
  county: string
  postcode: string
}

export type AddressList = Array<Address>
