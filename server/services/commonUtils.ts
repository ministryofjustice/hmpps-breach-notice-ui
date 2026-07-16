import { type Response } from 'express'
import { AuthenticationClient } from '@ministryofjustice/hmpps-auth-clients'
import { BreachNotice } from '../data/breachNoticeApiClient'
import NdeliusIntegrationApiClient, { LimitedAccessCheck } from '../data/ndeliusIntegrationApiClient'

export default class CommonUtils {
  constructor(private readonly authenticationClient: AuthenticationClient) {}

  async redirectRequired(breachNotice: BreachNotice, res: Response): Promise<boolean> {
    const ndeliusIntegrationApiClient = new NdeliusIntegrationApiClient(this.authenticationClient)

    const laoCheck: LimitedAccessCheck = await ndeliusIntegrationApiClient.getLimitedAccessCheck(
      breachNotice.crn,
      res.locals.user.username,
    )
    if (laoCheck.userExcluded || laoCheck.userRestricted) {
      res.render('pages/limited-access', {
        laoCheck,
      })
      return true
    }

    if (breachNotice.completedDate != null) {
      res.redirect(`/report-completed/${breachNotice.id}`)
      return true
    }
    return false
  }

  async redirectRequiredForLao(breachNotice: BreachNotice, res: Response): Promise<boolean> {
    const ndeliusIntegrationApiClient = new NdeliusIntegrationApiClient(this.authenticationClient)

    const laoCheck: LimitedAccessCheck = await ndeliusIntegrationApiClient.getLimitedAccessCheck(
      breachNotice.crn,
      res.locals.user.username,
    )
    if (laoCheck.userExcluded || laoCheck.userRestricted) {
      res.render('pages/limited-access', {
        laoCheck,
      })
      return true
    }
    return false
  }
}
