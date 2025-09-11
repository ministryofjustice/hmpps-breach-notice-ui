import HmppsAuditClient, { AuditEvent } from '../data/hmppsAuditClient'

export enum Page {
  BASIC_DETAILS = 'BASIC_DETAILS',
  WARNING_TYPE = 'WARNING_TYPE',
  NEXT_APPOINTMENT = 'NEXT_APPOINTMENT',
  CHECK_YOUR_REPORT = 'CHECK_YOUR_REPORT',
  REPORT_COMPLETED = 'REPORT_COMPLETED',
  REPORT_DELETED = 'REPORT_DELETED',
  WARNING_DETAILS = 'WARNING_DETAILS',
  VIEW_PDF = 'VIEW_PDF',
  ADD_ADDRESS = 'ADD_ADDRESS',
  CONFIRM_DELETE = 'CONFIRM_DELETE',
  ADD_REQUIREMENT = 'ADD_REQUIREMENT',
}

export interface PageViewEventDetails {
  who: string
  subjectId?: string
  subjectType?: string
  correlationId?: string
  details?: object
}

export default class AuditService {
  constructor(private readonly hmppsAuditClient: HmppsAuditClient) {}

  async logAuditEvent(event: AuditEvent) {
    await this.hmppsAuditClient.sendMessage(event)
  }

  async logPageView(page: Page, eventDetails: PageViewEventDetails) {
    const event: AuditEvent = {
      ...eventDetails,
      what: `PAGE_VIEW_${page}`,
    }
    await this.hmppsAuditClient.sendMessage(event)
  }
}
