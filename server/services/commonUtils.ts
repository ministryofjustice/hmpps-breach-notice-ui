import { type Response } from 'express'
import { BreachNotice } from '../data/breachNoticeApiClient'
import NdeliusIntegrationApiClient, { LimitedAccessCheck } from '../data/ndeliusIntegrationApiClient'
import { HmppsAuthClient } from '../data'

export default class CommonUtils {
  constructor(private readonly hmppsAuthClient: HmppsAuthClient) {}

  async redirectRequired(breachNotice: BreachNotice, res: Response): Promise<boolean> {
    const token = await this.hmppsAuthClient.getSystemClientToken(res.locals.user.username)
    const ndeliusIntegrationApiClient = new NdeliusIntegrationApiClient(token)

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
    const token = await this.hmppsAuthClient.getSystemClientToken(res.locals.user.username)
    const ndeliusIntegrationApiClient = new NdeliusIntegrationApiClient(token)

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
