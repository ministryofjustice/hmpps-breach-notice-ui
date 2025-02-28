import { type RequestHandler, Router } from 'express'
import AuditService, { Page } from '../services/auditService'
import BreachNoticeApiClient, {
  BreachNotice,
  ErrorMessages,
  RadioButton,
  SelectItem,
} from '../data/breachNoticeApiClient'
import NdeliusIntegrationApiClient, { SentenceType, WarningType } from '../data/ndeliusIntegrationApiClient'
import { HmppsAuthClient } from '../data'
import CommonUtils from '../services/commonUtils'
import asyncMiddleware from '../middleware/asyncMiddleware'

export default function warningTypeRoutes(
  router: Router,
  auditService: AuditService,
  hmppsAuthClient: HmppsAuthClient,
  commonUtils: CommonUtils,
): Router {
  const currentPage = 'warning-type'
  const get = (path: string | string[], handler: RequestHandler) => router.get(path, asyncMiddleware(handler))
  const post = (path: string | string[], handler: RequestHandler) => router.post(path, asyncMiddleware(handler))

  get('/warning-type/:id', async (req, res, next) => {
    await auditService.logPageView(Page.WARNING_TYPE, { who: res.locals.user.username, correlationId: req.id })
    const token = await hmppsAuthClient.getSystemClientToken(res.locals.user.username)
    const breachNoticeApiClient = new BreachNoticeApiClient(token)
    const ndeliusIntegrationApiClient = new NdeliusIntegrationApiClient(token)
    const { id } = req.params
    const breachNotice: BreachNotice = await breachNoticeApiClient.getBreachNoticeById(id)
    if (await commonUtils.redirectRequired(breachNotice, res)) return
    const { warningTypes, sentenceTypes } = await ndeliusIntegrationApiClient.getWarningTypes(breachNotice.crn, id)

    const warningTypeRadioButtons: Array<RadioButton> = initiateWarningTypeRadioButtonsAndApplySavedSelections(
      warningTypes,
      breachNotice,
    )

    const sentenceTypeSelectItems: Array<SelectItem> = initiateSentenceTypeSelectItemsAndApplySavedSelections(
      sentenceTypes,
      breachNotice,
    )

    res.render('pages/warning-type', {
      breachNotice,
      warningTypeRadioButtons,
      sentenceTypeSelectItems,
      currentPage,
    })
  })

  post('/warning-type/:id', async (req, res, next) => {
    const token = await hmppsAuthClient.getSystemClientToken(res.locals.user.username)
    const breachNoticeApiClient = new BreachNoticeApiClient(token)
    const ndeliusIntegrationApiClient = new NdeliusIntegrationApiClient(token)
    const { id } = req.params
    let breachNotice: BreachNotice = null
    breachNotice = await breachNoticeApiClient.getBreachNoticeById(id as string)
    if (await commonUtils.redirectRequired(breachNotice, res)) return
    const { warningTypes, sentenceTypes } = await ndeliusIntegrationApiClient.getWarningTypes(breachNotice.crn, id)
    const sentenceTypeList: SelectItem[] = getSentenceTypeSelectItems(sentenceTypes)
    const warningTypeRadioButtons: Array<RadioButton> = initiateWarningTypeRadioButtonsAndApplySavedSelections(
      warningTypes,
      breachNotice,
    )

    // add new details
    breachNotice.breachNoticeTypeCode = req.body.warningType
    breachNotice.breachSentenceTypeCode = req.body.sentenceType
    const checkedButton: RadioButton = warningTypeRadioButtons.find(r => r.value === req.body.warningType)
    if (checkedButton) {
      breachNotice.breachNoticeTypeDescription = checkedButton.text
    }

    const selectedSentenceType = sentenceTypeList.find(
      sentenceTypeSelectItem => sentenceTypeSelectItem.value === breachNotice.breachSentenceTypeCode,
    )

    if (selectedSentenceType) {
      breachNotice.breachSentenceTypeDescription = selectedSentenceType.value
    }

    // perform validation
    const errorMessages: ErrorMessages = validateWarningType(breachNotice)
    const hasErrors: boolean = Object.keys(errorMessages).length > 0

    if (!hasErrors) {
      breachNotice.warningTypeSaved = true
      await breachNoticeApiClient.updateBreachNotice(id, breachNotice)
      res.redirect(`/warning-details/${req.params.id}`)
    } else {
      const sentenceTypeSelectItems: Array<SelectItem> = initiateSentenceTypeSelectItemsAndApplySavedSelections(
        sentenceTypes,
        breachNotice,
      )

      res.render('pages/warning-type', {
        breachNotice,
        warningTypeRadioButtons,
        sentenceTypeSelectItems,
        currentPage,
        errorMessages,
      })
    }
  })

  function validateWarningType(breachNotice: BreachNotice): ErrorMessages {
    const errorMessages: ErrorMessages = {}
    if (!breachNotice.breachNoticeTypeCode) {
      errorMessages.warningType = {
        text: 'You must select a Warning Type before you can continue.',
      }
    }

    if (breachNotice.breachSentenceTypeCode === '-1') {
      errorMessages.sentenceType = {
        text: 'You must select a Sentence Type before you can continue.',
      }
    }

    return errorMessages
  }

  function initiateWarningTypeRadioButtonsAndApplySavedSelections(
    warningTypes: WarningType[],
    breachNotice: BreachNotice,
  ): RadioButton[] {
    const warningTypeRadioButtons: RadioButton[] = [
      ...warningTypes.map(warningType => ({
        text: `${warningType.description}`,
        value: `${warningType.code}`,
        selected: false,
        checked: false,
      })),
    ]

    if (breachNotice.breachNoticeTypeCode) {
      warningTypeRadioButtons.forEach((radioButton: RadioButton) => {
        if (breachNotice.breachNoticeTypeCode && breachNotice.breachNoticeTypeCode === radioButton.value) {
          // eslint-disable-next-line no-param-reassign
          radioButton.checked = true
        } else {
          // eslint-disable-next-line no-param-reassign
          radioButton.checked = false
        }
      })
    }
    return warningTypeRadioButtons
  }

  function getSentenceTypeSelectItems(sentenceTypes: SentenceType[]): SelectItem[] {
    return [
      {
        text: 'Please Select',
        value: '-1',
        selected: true,
      },
      ...sentenceTypes.map(sentenceType => ({
        text: `${sentenceType.description}`,
        value: `${sentenceType.code}`,
        selected: false,
      })),
    ]
  }

  function initiateSentenceTypeSelectItemsAndApplySavedSelections(
    sentenceTypes: SentenceType[],
    breachNotice: BreachNotice,
  ): SelectItem[] {
    const sentenceTypeSelectItems: SelectItem[] = [
      {
        text: 'Please Select',
        value: '-1',
        selected: true,
      },
      ...sentenceTypes.map(sentenceType => ({
        text: `${sentenceType.description}`,
        value: `${sentenceType.code}`,
        selected: false,
      })),
    ]

    if (breachNotice.breachSentenceTypeCode) {
      sentenceTypeSelectItems.forEach((sentenceTypeSelectItem: SelectItem) => {
        if (
          breachNotice.breachSentenceTypeCode &&
          breachNotice.breachSentenceTypeCode === sentenceTypeSelectItem.value
        ) {
          // eslint-disable-next-line no-param-reassign
          sentenceTypeSelectItem.selected = true
        }
      })
    }

    return sentenceTypeSelectItems
  }

  return router
}
