import { dataAccess } from '../data'
import AuditService from './auditService'
import SnsService from './snsService'
import CommonUtils from './commonUtils'

export const services = () => {
  const { applicationInfo, hmppsAuditClient, hmppsAuthClient, hmppsSnsClient } = dataAccess()

  const auditService = new AuditService(hmppsAuditClient)
  const snsService = new SnsService(hmppsSnsClient)
  const commonUtils = new CommonUtils(hmppsAuthClient)

  return {
    applicationInfo,
    auditService,
    hmppsAuditClient,
    hmppsAuthClient,
    snsService,
    commonUtils,
  }
}

export type Services = ReturnType<typeof services>
