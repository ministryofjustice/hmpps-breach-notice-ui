import { Router } from 'express'
import { AuthenticationClient } from '@ministryofjustice/hmpps-auth-clients'
import AuditService, { Page } from '../services/auditService'
import BreachNoticeApiClient from '../data/breachNoticeApiClient'
import { ErrorMessages } from '../data/uiModels'
import { handleIntegrationErrors } from '../utils/utils'

export default function eventTerminatedRoutes(
  router: Router,
  auditService: AuditService,
  authenticationClient: AuthenticationClient,
): Router {
  router.get('/event-terminated/:id', async (req, res) => {
    await auditService.logPageView(Page.EVENT_TERMINATED, { who: res.locals.user.username, correlationId: req.id })
    const { id } = req.params
    res.render('pages/event-terminated', { id, confirmScreen: false })
  })

  router.post('/event-terminated/:id', async (req, res) => {
    const breachNoticeApiClient = new BreachNoticeApiClient(authenticationClient)
    const { id } = req.params

    if (req.body.action === 'delete') {
      res.render('pages/event-terminated', { id, confirmScreen: true })
    } else if (req.body.action === 'cancel') {
      res.render('pages/event-terminated', { id, confirmScreen: false })
    } else if (req.body.action === 'confirm') {
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
      res.send(
        `<p>You can now safely close this window</p><script nonce="${res.locals.cspNonce}">window.close()</script>`,
      )
    }
  })

  return router
}
