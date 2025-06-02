import { Router } from 'express'
import AuditService, { Page } from '../services/auditService'

export default function addAddressRoutes(router: Router, auditService: AuditService): Router {
  router.get('/add-address', async (req, res, next) => {
    await auditService.logPageView(Page.ADD_ADDRESS, { who: res.locals.user.username })

    res.render('pages/add-address', {})
  })
  return router
}
