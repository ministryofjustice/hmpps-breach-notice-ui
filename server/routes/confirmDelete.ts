import { Router } from 'express'
import AuditService, { Page } from '../services/auditService'
import BreachNoticeApiClient from '../data/breachNoticeApiClient'
import { HmppsAuthClient } from '../data'
import { ErrorMessages } from '../data/uiModels'
import { handleIntegrationErrors } from '../utils/utils'

export default function confirmDeleteRoutes(
  router: Router,
  auditService: AuditService,
  hmppsAuthClient: HmppsAuthClient,
): Router {
  router.get('/confirm-delete/:id', async (req, res, next) => {
    await auditService.logPageView(Page.CONFIRM_DELETE, { who: res.locals.user.username, correlationId: req.id })
    const { id } = req.params
    res.render('pages/confirm-delete', { id })
  })

  router.post('/confirm-delete/:id', async (req, res, next) => {
    const token = await hmppsAuthClient.getSystemClientToken(res.locals.user.username)
    const breachNoticeApiClient = new BreachNoticeApiClient(token)
    const { id } = req.params

    if (req.body.action === 'confirm') {
      try {
        const breachNotice = await breachNoticeApiClient.getBreachNoticeById(id as string)
        if (Object.keys(breachNotice).length === 0) {
          const errorMessages: ErrorMessages = {}
          errorMessages.genericErrorMessage = {
            text: 'The document has not been found or has been deleted. An error has been logged. 404',
          }
          res.render(`pages/detailed-error`, { errorMessages })
          return
        }
        await breachNoticeApiClient.deleteBreachNotice(id as string)
      } catch (error) {
        const errorMessages: ErrorMessages = handleIntegrationErrors(error.status, error.data?.message, 'Breach Notice')
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
