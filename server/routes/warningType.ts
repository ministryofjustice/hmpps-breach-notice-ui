import { Router } from 'express'
import AuditService, { Page } from '../services/auditService'
import BreachNoticeApiClient, {
  BreachNotice,
  ErrorMessages,
  RadioButton,
  SelectItem,
} from '../data/breachNoticeApiClient'
import NdeliusIntegrationApiClient, {
  SentenceType,
  WarningDetails,
  WarningTypeWrapper,
} from '../data/ndeliusIntegrationApiClient'
import { HmppsAuthClient } from '../data'
import CommonUtils from '../services/commonUtils'

export default function warningTypeRoutes(
  router: Router,
  auditService: AuditService,
  hmppsAuthClient: HmppsAuthClient,
  commonUtils: CommonUtils,
): Router {
  const currentPage = 'warning-type'

  router.get('/warning-type/:id', async (req, res, next) => {
    await auditService.logPageView(Page.WARNING_TYPE, { who: res.locals.user.username, correlationId: req.id })
    const breachNoticeApiClient = new BreachNoticeApiClient(
      await hmppsAuthClient.getSystemClientToken(res.locals.user.username),
    )
    const ndeliusIntegrationApiClient = new NdeliusIntegrationApiClient(
      await hmppsAuthClient.getSystemClientToken(res.locals.user.username),
    )
    const breachNoticeId = req.params.id
    const breachNotice: BreachNotice = await breachNoticeApiClient.getBreachNoticeById(breachNoticeId as string)
    if (await commonUtils.redirectRequired(breachNotice, res)) return
    const warningTypes: WarningTypeWrapper = await ndeliusIntegrationApiClient.getWarningTypes()
    const warningDetails: WarningDetails = await ndeliusIntegrationApiClient.getWarningDetails(breachNotice.crn)
    const warningTypeRadioButtons: Array<RadioButton> = initiateWarningTypeRadioButtonsAndApplySavedSelections(
      warningTypes,
      breachNotice,
    )

    const sentenceTypeSelectItems: Array<SelectItem> = initiateSentenceTypeSelectItemsAndApplySavedSelections(
      warningDetails,
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
    const breachNoticeApiClient = new BreachNoticeApiClient(
      await hmppsAuthClient.getSystemClientToken(res.locals.user.username),
    )
    const ndeliusIntegrationApiClient = new NdeliusIntegrationApiClient(
      await hmppsAuthClient.getSystemClientToken(res.locals.user.username),
    )
    const { id } = req.params
    let breachNotice: BreachNotice = null
    breachNotice = await breachNoticeApiClient.getBreachNoticeById(id as string)
    if (await commonUtils.redirectRequired(breachNotice, res)) return
    const warningTypes: WarningTypeWrapper = await ndeliusIntegrationApiClient.getWarningTypes()
    const warningDetails: WarningDetails = await ndeliusIntegrationApiClient.getWarningDetails(breachNotice.crn)

    const warningTypeRadioButtons: Array<RadioButton> = initiateWarningTypeRadioButtonsAndApplySavedSelections(
      warningTypes,
      breachNotice,
    )

    // add new details
    breachNotice.breachNoticeTypeCode = req.body.warningType
    breachNotice.breachSentenceTypeCode = req.body.sentenceType
    // what if no radio buttons are select, do that check first
    const checkedButton: RadioButton = warningTypeRadioButtons.find(r => r.checked)
    if (checkedButton) {
      breachNotice.breachNoticeTypeDescription = checkedButton.text
    }

    // find the sentenceTypeRefData from the integration response
    warningDetails.sentenceTypes.forEach((sentenceType: SentenceType) => {
      if (breachNotice.breachSentenceTypeCode && breachNotice.breachSentenceTypeCode === sentenceType.code) {
        // eslint-disable-next-line no-param-reassign
        breachNotice.breachSentenceTypeDescription = sentenceType.description
      }
    })
    // perform validation
    const errorMessages: ErrorMessages = validateWarningType(breachNotice)
    const hasErrors: boolean = Object.keys(errorMessages).length > 0

    if (!hasErrors) {
      breachNotice.warningTypeSaved = true
      await breachNoticeApiClient.updateBreachNotice(id, breachNotice)
      res.redirect(`/warning-details/${req.params.id}`)
    } else {
      const sentenceTypeSelectItems: Array<SelectItem> = initiateSentenceTypeSelectItemsAndApplySavedSelections(
        warningDetails,
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
    warningTypes: WarningTypeWrapper,
    breachNotice: BreachNotice,
  ): RadioButton[] {
    const warningTypeRadioButtons: RadioButton[] = [
      ...warningTypes.content.map(warningType => ({
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
        }
      })
    }
    return warningTypeRadioButtons
  }

  function initiateSentenceTypeSelectItemsAndApplySavedSelections(
    warningTypeDetails: WarningDetails,
    breachNotice: BreachNotice,
  ): SelectItem[] {
    const sentenceTypeSelectItems: SelectItem[] = [
      {
        text: 'Please Select',
        value: '-1',
        selected: true,
      },
      ...warningTypeDetails.sentenceTypes.map(sentenceType => ({
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
