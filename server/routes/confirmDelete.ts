import { Router } from 'express'
import { AuthenticationClient } from '@ministryofjustice/hmpps-auth-clients'
import AuditService, { Page } from '../services/auditService'
import BreachNoticeApiClient from '../data/breachNoticeApiClient'
import { ErrorMessages } from '../data/uiModels'
import { handleIntegrationErrors } from '../utils/utils'

export default function confirmDeleteRoutes(
  router: Router,
  auditService: AuditService,
  authenticationClient: AuthenticationClient,
): Router {
  router.get('/confirm-delete/:id', async (req, res) => {
    await auditService.logPageView(Page.CONFIRM_DELETE, { who: res.locals.user.username, correlationId: req.id })
    const { id } = req.params
    res.render('pages/confirm-delete', { id })
  })

  router.post('/confirm-delete/:id', async (req, res) => {
    const breachNoticeApiClient = new BreachNoticeApiClient(authenticationClient)
    const { id } = req.params

    if (req.body.action === 'confirm') {
      try {
        const breachNotice = await breachNoticeApiClient.getBreachNoticeById(id as string, res.locals.user.username)
        if (Object.keys(breachNotice).length === 0) {
          const errorMessages: ErrorMessages = {}
          errorMessages.genericErrorMessage = {
            text: 'The document has not been found or has been deleted. An error has been logged. 404',
          }
          res.render(`pages/detailed-error`, { errorMessages })
          return
        }
        await breachNoticeApiClient.deleteBreachNotice(id as string, res.locals.user.username)
      } catch (error) {
        const errorMessages: ErrorMessages = handleIntegrationErrors(
          error.responseStatus,
          error.data?.message,
          'Breach Notice',
        )
        const showEmbeddedError = true
        // always stay on page and display the error when there are isssues retrieving the breach notice
        res.render(`pages/detailed-error`, { errorMessages, showEmbeddedError })
        return
      }
      res.redirect(`/report-deleted/${id}`)
    } else {
      res.redirect(`/check-your-report/${id}`)
    }
  })

  return router
}
