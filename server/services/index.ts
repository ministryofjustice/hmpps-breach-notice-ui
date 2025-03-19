import { dataAccess } from '../data'
import AuditService from './auditService'
import CommonUtils from './commonUtils'

export const services = () => {
  const { applicationInfo, hmppsAuditClient, hmppsAuthClient } = dataAccess()

  const auditService = new AuditService(hmppsAuditClient)
  const commonUtils = new CommonUtils(hmppsAuthClient)

  return {
    applicationInfo,
    auditService,
    hmppsAuditClient,
    hmppsAuthClient,
    commonUtils,
  }
}

export type Services = ReturnType<typeof services>
