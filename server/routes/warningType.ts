import { Router } from 'express'
import AuditService, { Page } from '../services/auditService'
import BreachNoticeApiClient, { BreachNotice } from '../data/breachNoticeApiClient'
import NdeliusIntegrationApiClient, {
  SentenceType,
  WarningType,
  WarningTypeWrapper,
} from '../data/ndeliusIntegrationApiClient'
import { HmppsAuthClient } from '../data'
import CommonUtils from '../services/commonUtils'
import { ErrorMessages, RadioButton, SelectItem } from '../data/uiModels'

export default function warningTypeRoutes(
  router: Router,
  auditService: AuditService,
  hmppsAuthClient: HmppsAuthClient,
  commonUtils: CommonUtils,
): Router {
  const currentPage = 'warning-type'

  router.get('/warning-type/:id', async (req, res, next) => {
    await auditService.logPageView(Page.WARNING_TYPE, { who: res.locals.user.username, correlationId: req.id })
    const token = await hmppsAuthClient.getSystemClientToken(res.locals.user.username)
    const breachNoticeApiClient = new BreachNoticeApiClient(token)
    const ndeliusIntegrationApiClient = new NdeliusIntegrationApiClient(token)
    const { id } = req.params
    const breachNotice: BreachNotice = await breachNoticeApiClient.getBreachNoticeById(id)
    if (await commonUtils.redirectRequired(breachNotice, res)) return
    let warningTypes: WarningType[] = []
    let sentenceTypes: SentenceType[] = []
    let defaultSentenceTypeCode: string = null

    try {
      const warningTypeWrapper: WarningTypeWrapper = await ndeliusIntegrationApiClient.getWarningTypes(
        breachNotice.crn,
        id,
      )
      if (warningTypeWrapper) {
        warningTypes = warningTypeWrapper.warningTypes
        sentenceTypes = warningTypeWrapper.sentenceTypes
        defaultSentenceTypeCode = warningTypeWrapper.defaultSentenceTypeCode
      }
    } catch (error) {
      if (error.status === 400 && error.data?.message?.includes('is not sentenced')) {
        const errorMessages: ErrorMessages = {}
        errorMessages.genericErrorMessage = {
          text: 'Breach actions cannot be created pre-sentence. If this event has a valid sentence please contact the service desk and report this error.',
        }
        res.render(`pages/detailed-error`, { errorMessages })
        return
      }
      throw error
    }

    const warningTypeRadioButtons: Array<RadioButton> = initiateWarningTypeRadioButtonsAndApplySavedSelections(
      warningTypes,
      breachNotice,
    )

    const sentenceTypeSelectItems: Array<SelectItem> = initiateSentenceTypeSelectItemsAndApplySavedSelections(
      sentenceTypes,
      defaultSentenceTypeCode,
      breachNotice,
    )

    res.render('pages/warning-type', {
      breachNotice,
      warningTypeRadioButtons,
      sentenceTypeSelectItems,
      currentPage,
    })
  })

  router.post('/warning-type/:id', async (req, res, next) => {
    const token = await hmppsAuthClient.getSystemClientToken(res.locals.user.username)
    const breachNoticeApiClient = new BreachNoticeApiClient(token)
    const ndeliusIntegrationApiClient = new NdeliusIntegrationApiClient(token)
    const { id } = req.params
    const breachNotice: BreachNotice = await breachNoticeApiClient.getBreachNoticeById(id as string)
    const callingScreen: string = req.query.returnTo as string
    if (await commonUtils.redirectRequired(breachNotice, res)) return
    const { warningTypes, sentenceTypes, defaultSentenceTypeCode } = await ndeliusIntegrationApiClient.getWarningTypes(
      breachNotice.crn,
      id,
    )
    const sentenceTypeList: SelectItem[] = initiateSentenceTypeSelectItemsAndApplySavedSelections(
      sentenceTypes,
      defaultSentenceTypeCode,
      breachNotice,
    )
    const warningTypeRadioButtons: Array<RadioButton> = initiateWarningTypeRadioButtonsAndApplySavedSelections(
      warningTypes,
      breachNotice,
    )

    // add new details
    breachNotice.breachNoticeTypeCode = req.body.warningType
    breachNotice.breachSentenceTypeCode = req.body.sentenceType
    // find the condition Being Enforced
    const conditionBeingEnforced: SentenceType = sentenceTypes.find(
      sentenceType => sentenceType.code === breachNotice.breachSentenceTypeCode,
    )
    if (conditionBeingEnforced) {
      breachNotice.conditionBeingEnforced = conditionBeingEnforced.conditionBeingEnforced
    }

    const checkedButton: RadioButton = warningTypeRadioButtons.find(r => r.value === req.body.warningType)
    if (checkedButton) {
      breachNotice.breachNoticeTypeDescription = checkedButton.text
    }

    const selectedSentenceType = sentenceTypeList.find(
      sentenceTypeSelectItem => sentenceTypeSelectItem.value === breachNotice.breachSentenceTypeCode,
    )

    if (selectedSentenceType) {
      breachNotice.breachSentenceTypeDescription = selectedSentenceType.text
    }

    // perform validation
    const errorMessages: ErrorMessages = validateWarningType(breachNotice)
    const hasErrors: boolean = Object.keys(errorMessages).length > 0

    if (!hasErrors) {
      breachNotice.warningTypeSaved = true
      await breachNoticeApiClient.updateBreachNotice(id, breachNotice)
      if (req.body.action === 'saveProgressAndClose') {
        res.send(
          `<p>You can now safely close this window</p><script nonce="${res.locals.cspNonce}">window.close()</script>`,
        )
      } else if (callingScreen && callingScreen === 'check-your-report') {
        res.redirect(`/check-your-report/${id}`)
      } else {
        res.redirect(`/warning-details/${req.params.id}`)
      }
    } else {
      const sentenceTypeSelectItems: Array<SelectItem> = initiateSentenceTypeSelectItemsAndApplySavedSelections(
        sentenceTypes,
        defaultSentenceTypeCode,
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
    return [
      ...warningTypes.map(warningType => ({
        text: `${warningType.description}`,
        value: `${warningType.code}`,
        selected: false,
        checked: breachNotice.breachNoticeTypeCode && breachNotice.breachNoticeTypeCode === warningType.code,
      })),
    ]
  }

  function initiateSentenceTypeSelectItemsAndApplySavedSelections(
    sentenceTypes: SentenceType[],
    defaultSentenceTypeCode: string,
    breachNotice: BreachNotice,
  ): SelectItem[] {
    return [
      {
        text: 'Please Select',
        value: '-1',
        selected: true,
      },
      ...sentenceTypes.map(sentenceType => ({
        text: `${sentenceType.description}`,
        value: `${sentenceType.code}`,
        selected: breachNotice.warningTypeSaved
          ? breachNotice.breachSentenceTypeCode && breachNotice.breachSentenceTypeCode === sentenceType.code
          : defaultSentenceTypeCode === sentenceType.code,
      })),
    ]
  }

  return router
}
