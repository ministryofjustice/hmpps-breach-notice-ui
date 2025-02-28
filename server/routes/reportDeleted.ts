import { type RequestHandler, Router } from 'express'
import AuditService, { Page } from '../services/auditService'
import asyncMiddleware from '../middleware/asyncMiddleware'

export default function reportDeletedRoutes(router: Router, auditService: AuditService): Router {
  const get = (path: string | string[], handler: RequestHandler) => router.get(path, asyncMiddleware(handler))
  get('/report-deleted/:id', async (req, res, next) => {
    await auditService.logPageView(Page.REPORT_DELETED, { who: res.locals.user.username, correlationId: req.id })
    res.render('pages/report-deleted')
  })
  return router
}
