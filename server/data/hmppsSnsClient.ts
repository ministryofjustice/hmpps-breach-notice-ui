import { SNSClient, PublishCommand } from '@aws-sdk/client-sns'
import logger from '../../logger'

export interface BreachNoticePublishEvent {
  crn: string
  id: string
}

export interface SnsClientConfig {
  topicArn: string
  region: string
  serviceName: string
  enabled: boolean
  key: string
  secret: string
  snsHost: string
}

export default class HmppsSnsClient {
  private snsClient: SNSClient

  private topicArn: string

  private serviceName: string

  private enabled: boolean

  constructor(config: SnsClientConfig) {
    this.enabled = config.enabled
    this.topicArn = config.topicArn
    this.serviceName = config.serviceName
    this.snsClient = new SNSClient({
      region: config.region,
      endpoint: config.snsHost,
      credentials: { accessKeyId: config.key, secretAccessKey: config.secret },
    })
  }

  async sendMessage(event: BreachNoticePublishEvent, throwOnError: boolean = true) {
    if (this.enabled) {
      try {
        const publishParams = {
          TopicArn: this.topicArn,
          Message: JSON.stringify(event),
        }

        const response = await this.snsClient.send(new PublishCommand(publishParams))
        logger.info(`HMPPS Breach Notice Publish SNS message sent (${event.crn}, ${event.id})`)
      } catch (error) {
        logger.error('Error sending HMPPS Breach Notice Publish SNS message, ', error)
        if (throwOnError) throw error
      }
    }
  }
}
