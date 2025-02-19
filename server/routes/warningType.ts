import { Response, Router } from 'express'
import AuditService, { Page } from '../services/auditService'
import BreachNoticeApiClient, {
  BreachNotice,
  ErrorMessages,
  RadioButton,
  RadioButtonList,
  SelectItem,
  SentenceType,
  SentenceTypeList,
  WarningTypeDetails,
} from '../data/breachNoticeApiClient'
import { HmppsAuthClient } from '../data'

export default function warningTypeRoutes(
  router: Router,
  auditService: AuditService,
  hmppsAuthClient: HmppsAuthClient,
): Router {
  router.get('/warning-type/:id', async (req, res, next) => {
    await auditService.logPageView(Page.WARNING_TYPE, { who: res.locals.user.username, correlationId: req.id })
    res.render('pages/warning-type')
  })
  return router
}
