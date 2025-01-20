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
