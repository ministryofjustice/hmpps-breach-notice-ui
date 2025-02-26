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
    if (laoCheck.isExcluded || laoCheck.isRestricted) {
      let limitedAccessMessages: string = ''
      if (laoCheck.isExcluded) {
        limitedAccessMessages += laoCheck.exclusionMessage
        if (laoCheck.isRestricted) {
          limitedAccessMessages += '<br/>'
        }
      }
      if (laoCheck.isRestricted) {
        limitedAccessMessages += laoCheck.restrictionMessage
      }

      res.render('pages/limited-access', {
        limitedAccessMessages,
      })
      return true
    }

    if (breachNotice.completedDate != null) {
      res.redirect(`/report-completed/${breachNotice.id}`)
      return true
    }
    return false
  }
}
