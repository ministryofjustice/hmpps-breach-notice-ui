import { Router } from 'express'
import AuditService, { Page } from '../services/auditService'

export default function confirmDeleteRoutes(router: Router, auditService: AuditService): Router {
  router.get('/confirm-delete/:id', async (req, res, next) => {
    await auditService.logPageView(Page.CONFIRM_DELETE, { who: res.locals.user.username, correlationId: req.id })
    const { id } = req.params
    res.render('pages/confirm-delete', { id })
  })

  return router
}
