import { type RequestHandler, Router } from 'express'
import AuditService, { Page } from '../services/auditService'
import BreachNoticeApiClient from '../data/breachNoticeApiClient'
import asyncMiddleware from '../middleware/asyncMiddleware'
import { HmppsAuthClient } from '../data'
import config from '../config'
import { HmppsDomainEvent } from '../data/hmppsSnsClient'
import SnsService from '../services/snsService'

export default function reportDeletedRoutes(
  router: Router,
  auditService: AuditService,
  hmppsAuthClient: HmppsAuthClient,
  snsService: SnsService,
): Router {
  const get = (path: string | string[], handler: RequestHandler) => router.get(path, asyncMiddleware(handler))
  get('/report-deleted/:id', async (req, res, next) => {
    await auditService.logPageView(Page.REPORT_DELETED, { who: res.locals.user.username, correlationId: req.id })
    const breachNoticeApiClient = new BreachNoticeApiClient(
      await hmppsAuthClient.getSystemClientToken(res.locals.user.username),
    )
    const { id } = req.params
    const breachNotice = await breachNoticeApiClient.getBreachNoticeById(id as string)
    await breachNoticeApiClient.deleteBreachNotice(id as string)

    const baseUrl: string = config.apis.breachNotice.url
    const event: HmppsDomainEvent = {
      eventType: 'probation-case.breach-notice.deleted',
      version: 1,
      description: 'A breach notice has been deleted for a person on probation',
      detailUrl: `${baseUrl}/report-deleted/${id}`,
      occurredAt: new Date().toISOString(),
      additionalInformation: {
        breachNoticeId: `${id}`,
      },
      personReference: {
        identifiers: [
          {
            type: 'CRN',
            value: `${breachNotice.crn}`,
          },
        ],
      },
    }

    snsService.sendMessage(event)
    res.render('pages/report-deleted')
  })
  return router
}
