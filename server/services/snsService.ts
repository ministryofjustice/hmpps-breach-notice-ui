import HmppsSnsClient, { BreachNoticePublishEvent } from '../data/hmppsSnsClient'

export default class SnsService {
  constructor(private readonly hmppsSnsClient: HmppsSnsClient) {}

  async sendMessage(event: BreachNoticePublishEvent) {
    await this.hmppsSnsClient.sendMessage(event)
  }
}
