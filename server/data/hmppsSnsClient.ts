import { SNSClient, PublishCommand } from '@aws-sdk/client-sns'
import logger from '../../logger'

export interface HmppsDomainEvent {
  eventType: 'probation-case.breach-notice.created'
  version: 1
  description: 'A breach notice has been completed for a person on probation'
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
  enabled: boolean
  endpoint: string
}

export default class HmppsSnsClient {
  private readonly snsClient: SNSClient

  private readonly topicArn: string

  private readonly enabled: boolean

  constructor({ enabled, endpoint, topicArn }: SnsClientConfig) {
    this.enabled = enabled
    this.topicArn = topicArn
    this.snsClient = endpoint ? new SNSClient({ endpoint }) : new SNSClient()
  }

  async sendMessage(event: HmppsDomainEvent, throwOnError: boolean = true) {
    logger.debug('Sending SNS notification', event)
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
