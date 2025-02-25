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
  WarningType,
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
    // const ndeliusIntegrationApiClient = new NdeliusIntegrationApiClient(
    //   await hmppsAuthClient.getSystemClientToken(res.locals.user.username),
    // )
    const breachNoticeId = req.params.id
    const breachNotice: BreachNotice = await breachNoticeApiClient.getBreachNoticeById(breachNoticeId as string)
    if (await commonUtils.redirectRequired(breachNotice, res)) return
    const warningTypes: WarningType[] = createDummyWarningTypes()

    const warningTypeRadioButtons: Array<RadioButton> = initiateWarningTypeRadioButtonsAndApplySavedSelections(
      warningTypes,
      breachNotice,
    )

    const sentenceTypeSelectItems: Array<SelectItem> = initiateSentenceTypeSelectItemsAndApplySavedSelections(
      getSentenceTypes(),
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
    // const ndeliusIntegrationApiClient = new NdeliusIntegrationApiClient(
    //   await hmppsAuthClient.getSystemClientToken(res.locals.user.username),
    // )
    const { id } = req.params
    let breachNotice: BreachNotice = null
    breachNotice = await breachNoticeApiClient.getBreachNoticeById(id as string)
    if (await commonUtils.redirectRequired(breachNotice, res)) return
    const warningTypes: WarningType[] = createDummyWarningTypes()
    const sentenceTypeList: SelectItem[] = getSentenceTypeSelectItems()
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
        getSentenceTypes(),
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

  function getSentenceTypeSelectItems(): SelectItem[] {
    const sentenceTypes = getSentenceTypes()

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

    return sentenceTypeSelectItems
  }

  function getSentenceTypes(): SentenceType[] {
    const sentenceTypes: SentenceType[] = [
      {
        code: 'ABC',
        description: 'Community Order',
        conditionBeingEnforced: 'string',
      },
      {
        code: '123',
        description: 'Another Typer',
        conditionBeingEnforced: 'string',
      },
    ]
    return sentenceTypes
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

  function createDummyWarningTypes(): WarningType[] {
    return [
      {
        code: 'FOW',
        description: 'Formal Warning',
      },
      {
        code: 'FW',
        description: 'Final Warning',
      },

      {
        code: 'BW',
        description: 'Breach Warning',
      },
    ]
  }

  return router
}
