import type { Request, Response, NextFunction } from 'express'
import type { HTTPError } from 'superagent'
import logger from '../logger'
import { ErrorMessages } from './data/uiModels'

export default function createErrorHandler() {
  return (error: HTTPError, req: Request, res: Response, next: NextFunction): void => {
    logger.error(`Error handling request for '${req.originalUrl}', user '${res.locals.user?.username}'`, error)

    if (error.status === 401 || error.status === 403) {
      logger.info('Logging user out')
      return res.redirect('/sign-out')
    }

    const errorMessages: ErrorMessages = {}
    errorMessages.genericErrorMessage = {
      text: `Unexpected Error has occurred, please contact support\n${error?.status}\n${error?.message}\n${error?.stack}`,
    }

    return res.render('pages/detailed-error', { errorMessages })
  }
}
