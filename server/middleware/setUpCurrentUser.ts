import { jwtDecode } from 'jwt-decode'
import express from 'express'
import { convertToTitleCase } from '../utils/utils'
import logger from '../../logger'

export default function setUpCurrentUser() {
  const router = express.Router()

  router.use((_req, res, next) => {
    try {
      const {
        name,
        user_id: userId,
        authorities: roles = [],
      } = jwtDecode(res.locals.user.token) as {
        name?: string
        user_id?: string
        authorities?: string[]
      }


      res.locals.user = {
        ...res.locals.user,
        // @ts-expect-error
        userId,
        // @ts-expect-error
        name,
        // @ts-expect-error
        displayName: convertToTitleCase(name),
        userRoles: roles.map(role => role.substring(role.indexOf('_') + 1)),
      }

      if (res.locals.user.authSource === 'nomis') {
        // @ts-expect-error
        res.locals.user.staffId = parseInt(userId, 10) || undefined
      }

      next()
    } catch (error) {
      logger.error(error, `Failed to populate user details for: ${res.locals.user && res.locals.user.username}`)
      next(error)
    }
  })

  return router
}
