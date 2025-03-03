import { SNSClient, PublishCommand } from '@aws-sdk/client-sns'
import logger from '../../logger'

export interface HmppsDomainEvent {
  eventType: string // The domain event type (eg 'probation-case.breach-notice.created')
  version: 1
  description: string // Domain event description
  detailUrl: string // This should be set to the PDF URL for the breach notice
  occurredAt: string // Current timestamp in ISO format
  additionalInformation: {
    breachNoticeId: string
  }
  personReference: {
    identifiers: [
      {
        type: 'CRN'
        value: string
      },
    ]
  }
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

  async sendMessage(event: HmppsDomainEvent, throwOnError: boolean = true) {
    if (this.enabled) {
      try {
        const publishParams = {
          TopicArn: this.topicArn,
          Message: JSON.stringify(event),
          MessageAttributes: {
            eventType: { DataType: 'String', StringValue: event.eventType },
          },
        }

        const response = await this.snsClient.send(new PublishCommand(publishParams))
        logger.info(
          `HMPPS Breach Notice Publish SNS message sent (${event.personReference.identifiers[0].value}, ${event.additionalInformation.breachNoticeId}, ${response})`,
        )
      } catch (error) {
        logger.error('Error sending HMPPS Breach Notice Publish SNS message, ', error)
        if (throwOnError) throw error
      }
    }
  }
}
