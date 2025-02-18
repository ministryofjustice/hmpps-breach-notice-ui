import HmppsSnsClient, { HmppsDomainEvent } from '../data/hmppsSnsClient'

export default class SnsService {
  constructor(private readonly hmppsSnsClient: HmppsSnsClient) {}

  async sendMessage(event: HmppsDomainEvent) {
    await this.hmppsSnsClient.sendMessage(event)
  }
}
