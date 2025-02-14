import { dataAccess } from '../data'
import AuditService from './auditService'
import SnsService from './snsService'

export const services = () => {
  const { applicationInfo, hmppsAuditClient, hmppsAuthClient, hmppsSnsClient } = dataAccess()

  const auditService = new AuditService(hmppsAuditClient)
  const snsService = new SnsService(hmppsSnsClient)

  return {
    applicationInfo,
    auditService,
    hmppsAuditClient,
    hmppsAuthClient,
    snsService,
  }
}

export type Services = ReturnType<typeof services>
