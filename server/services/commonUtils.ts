import { type Response } from 'express'
import { BreachNotice } from '../data/breachNoticeApiClient'

export default class CommonUtils {
  constructor() {}

  async redirectOnStatusChange(breachNotice: BreachNotice, res: Response): Promise<boolean> {
    // TODO LAO Check
    if (breachNotice.completedDate != null) {
      res.redirect(`/report-completed/${breachNotice.id}`)
      return true
    }
    return false
  }
}
