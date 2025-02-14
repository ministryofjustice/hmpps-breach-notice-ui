import { Response, Router } from 'express'
import AuditService, { Page } from '../services/auditService'
import BreachNoticeApiClient, {
  BreachNotice,
  ErrorMessages,
  RadioButton,
  RadioButtonList,
  SelectItem,
  SentenceType,
  SentenceTypeList,
  WarningTypeDetails,
} from '../data/breachNoticeApiClient'
import { HmppsAuthClient } from '../data'

export default function warningTypeRoutes(
  router: Router,
  auditService: AuditService,
  hmppsAuthClient: HmppsAuthClient,
): Router {
  router.get('/warning-type/:id', async (req, res, next) => {
    await auditService.logPageView(Page.WARNING_TYPE, { who: res.locals.user.username, correlationId: req.id })
    const breachNoticeApiClient = new BreachNoticeApiClient(
      await hmppsAuthClient.getSystemClientToken(res.locals.user.username),
    )
    const breachNoticeId = req.params.id
    let breachNotice: BreachNotice = null
    const warningTypeDetails: WarningTypeDetails = createDummyWarningTypeDetails()
    breachNotice = await breachNoticeApiClient.getBreachNoticeById(breachNoticeId as string)
    // need to load in the select items for the sentence type dropdown
    // const radioButtonsFromIntegration = initiateWarningTypeRadioButtons
    const warningTypeRadioButtons: Array<RadioButton> = initiateWarningTypeRadioButtonsAndApplySavedSelections(
      warningTypeDetails,
      breachNotice,
    )

    const sentenceTypeSelectItems: Array<SelectItem> = initiateSentenceTypeSelectItemsAndApplySavedSelections(
      warningTypeDetails,
      breachNotice,
    )

    renderWarningTypes(breachNotice, res, warningTypeRadioButtons, {}, sentenceTypeSelectItems)
  })

  router.post('/warning-type/:id', async (req, res, next) => {
    const breachNoticeApiClient = new BreachNoticeApiClient(
      await hmppsAuthClient.getSystemClientToken(res.locals.user.username),
    )
    const breachNoticeId = req.params.id
    const warningTypeDetails: WarningTypeDetails = createDummyWarningTypeDetails()
    let breachNotice: BreachNotice = null
    breachNotice = await breachNoticeApiClient.getBreachNoticeById(breachNoticeId as string)

    // add new details
    breachNotice.breachNoticeTypeCode = req.body.warningType
    breachNotice.breachSentenceTypeCode = req.body.sentenceType
    // find the warning type ref data from the integration response
    warningTypeDetails.warningTypes.forEach((radioButton: RadioButton) => {
      if (breachNotice.breachNoticeTypeCode && breachNotice.breachNoticeTypeCode === radioButton.value) {
        // eslint-disable-next-line no-param-reassign
        breachNotice.breachNoticeTypeDescription = radioButton.text
      }
    })
    // find the sentenceTypeRefData from the integration response
    warningTypeDetails.sentenceTypes.forEach((sentenceType: SentenceType) => {
      if (breachNotice.breachSentenceTypeCode && breachNotice.breachSentenceTypeCode === sentenceType.code) {
        // eslint-disable-next-line no-param-reassign
        breachNotice.breachSentenceTypeDescription = sentenceType.description
      }
    })
    // mark that a USER has saved the document at least once
    breachNotice.warningTypeSaved = true
    await breachNoticeApiClient.updateBreachNotice(breachNoticeId, breachNotice)

    if (req.body.action === 'viewDraft') {
      try {
        await showDraftPdf(breachNotice.id, res)
      } catch (err) {
        const errorMessages: ErrorMessages = {}
        errorMessages.pdfRenderError = {
          text: 'There was an issue generating the draft report. Please try again or contact support.',
        }
        const sentenceTypeSelectItems: Array<SelectItem> = initiateSentenceTypeSelectItemsAndApplySavedSelections(
          warningTypeDetails,
          breachNotice,
        )
        renderWarningTypes(breachNotice, res, warningTypeDetails.warningTypes, errorMessages, sentenceTypeSelectItems)
      }
    } else {
      res.redirect(`/warning-details/${req.params.id}`)
    }
  })

  // receive warningTypeDetails via an integration
  // query this data against our saved breach notice
  // to see if we need to apply a previous Selection
  function initiateWarningTypeRadioButtonsAndApplySavedSelections(
    warningTypeDetails: WarningTypeDetails,
    breachNotice: BreachNotice,
  ): RadioButton[] {
    const warningTypeRadioButtons: Array<RadioButton> = warningTypeDetails.warningTypes
    // return warningTypeRadioButtons
    // find currently selected code in breach notice and apply to the radio buttons
    if (breachNotice.breachNoticeTypeCode) {
      warningTypeRadioButtons.forEach((radioButton: RadioButton) => {
        console.log('values')
        console.log(radioButton.value)
        console.log(radioButton.text)
        console.log(radioButton.checked)
        if (breachNotice.breachNoticeTypeCode && breachNotice.breachNoticeTypeCode === radioButton.value) {
          // eslint-disable-next-line no-param-reassign
          radioButton.checked = true
        }
      })
    }
    return warningTypeRadioButtons
  }

  async function showDraftPdf(id: string, res: Response) {
    res.redirect(`/pdf/${id}`)
  }
  async function renderWarningTypes(
    breachNotice: BreachNotice,
    res: Response,
    warningTypeRadioButtons: Array<RadioButton>,
    errorMessages: ErrorMessages,
    sentenceTypeSelectItems: Array<SelectItem>,
  ) {
    res.render('pages/warning-type', {
      errorMessages,
      breachNotice,
      warningTypeRadioButtons,
      sentenceTypeSelectItems,
    })
  }

  function initiateSentenceTypeSelectItemsAndApplySavedSelections(
    warningTypeDetails: WarningTypeDetails,
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

  // Will call integration point once available
  function createDummyWarningTypeDetails(): WarningTypeDetails {
    const warningTypeDetails: WarningTypeDetails = {
      warningTypes: createDummyWarningTypeList(),
      sentenceTypes: createDummySentenceTypeList(),
    }
    return warningTypeDetails
  }

  function createDummyWarningTypeList(): RadioButtonList {
    const breachWarning: RadioButton = {
      value: 'BW',
      text: 'Breach Warning',
      checked: false,
    }

    const finalWarning: RadioButton = {
      value: 'FW',
      text: 'Final Warning',
      checked: false,
    }

    const formalWarning: RadioButton = {
      value: 'FOW',
      text: 'Formal Warning',
      checked: false,
    }

    return [breachWarning, finalWarning, formalWarning]
  }

  function createDummySentenceTypeList(): SentenceTypeList {
    const sentenceType1: SentenceType = {
      code: `CO`,
      description: 'Community Order(s)',
      conditionBeingEnforced: 'Test Condition CO',
    }
    const sentenceType2: SentenceType = {
      code: `SSO`,
      description: 'Suspended Supervision Order(s)',
      conditionBeingEnforced: 'Test Condition SSO',
    }
    return [sentenceType1, sentenceType2]
  }

  return router
}
