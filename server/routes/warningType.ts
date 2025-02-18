import { Response, Router } from 'express'
import AuditService, { Page } from '../services/auditService'
import BreachNoticeApiClient, {
  BreachNotice,
  ErrorMessages,
  RadioButton,
  RadioButtonList,
  SelectItem,
  // SentenceType,
  SentenceTypeList,
  WarningTypeDetails,
} from '../data/breachNoticeApiClient'
import NdeliusIntegrationApiClient, {
  SentenceType,
  WarningType,
  WarningTypeWrapper,
  WarningDetails,
} from '../data/ndeliusIntegrationApiClient'
import { HmppsAuthClient } from '../data'

export default function warningTypeRoutes(
  router: Router,
  auditService: AuditService,
  hmppsAuthClient: HmppsAuthClient,
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
    let breachNotice: BreachNotice = null
    breachNotice = await breachNoticeApiClient.getBreachNoticeById(breachNoticeId as string)
    const warningTypes: WarningTypeWrapper = await ndeliusIntegrationApiClient.getWarningTypes()
    const warningDetails: WarningDetails = await ndeliusIntegrationApiClient.getWarningDetails(breachNotice.crn)
    // need to load in the select items for the sentence type dropdown
    // const radioButtonsFromIntegration = initiateWarningTypeRadioButtons
    const warningTypeRadioButtons: Array<RadioButton> = initiateWarningTypeRadioButtonsAndApplySavedSelections(
      warningTypes,
      breachNotice,
    )

    const sentenceTypeSelectItems: Array<SelectItem> = initiateSentenceTypeSelectItemsAndApplySavedSelections(
      warningDetails,
      breachNotice,
    )

    renderWarningTypes(breachNotice, res, warningTypeRadioButtons, {}, sentenceTypeSelectItems)
  })

  router.post('/warning-type/:id', async (req, res, next) => {
    const breachNoticeApiClient = new BreachNoticeApiClient(
      await hmppsAuthClient.getSystemClientToken(res.locals.user.username),
    )
    const ndeliusIntegrationApiClient = new NdeliusIntegrationApiClient(
      await hmppsAuthClient.getSystemClientToken(res.locals.user.username),
    )
    const breachNoticeId = req.params.id
    let breachNotice: BreachNotice = null
    breachNotice = await breachNoticeApiClient.getBreachNoticeById(breachNoticeId as string)
    const warningTypes: WarningTypeWrapper = await ndeliusIntegrationApiClient.getWarningTypes()
    const warningDetails: WarningDetails = await ndeliusIntegrationApiClient.getWarningDetails(breachNotice.crn)

    const warningTypeRadioButtons: Array<RadioButton> = initiateWarningTypeRadioButtonsAndApplySavedSelections(
      warningTypes,
      breachNotice,
    )

    // add new details
    breachNotice.breachNoticeTypeCode = req.body.warningType
    breachNotice.breachSentenceTypeCode = req.body.sentenceType
    // find the warning type ref data from the integration response
    warningTypeRadioButtons.forEach((radioButton: RadioButton) => {
      if (breachNotice.breachNoticeTypeCode && breachNotice.breachNoticeTypeCode === radioButton.value) {
        // eslint-disable-next-line no-param-reassign
        breachNotice.breachNoticeTypeDescription = radioButton.text
      }
    })
    // find the sentenceTypeRefData from the integration response
    warningDetails.sentenceTypes.forEach((sentenceType: SentenceType) => {
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
          warningDetails,
          breachNotice,
        )
        renderWarningTypes(breachNotice, res, warningTypeRadioButtons, errorMessages, sentenceTypeSelectItems)
      }
    } else {
      res.redirect(`/warning-details/${req.params.id}`)
    }
  })

  // receive warningTypeDetails via an integration
  // query this data against our saved breach notice
  // to see if we need to apply a previous Selection
  function initiateWarningTypeRadioButtonsAndApplySavedSelections(
    warningTypes: WarningTypeWrapper,
    breachNotice: BreachNotice,
  ): RadioButton[] {
    // Read warning Types
    const warningTypeRadioButtons: RadioButton[] = [
      ...warningTypes.content.map(warningType => ({
        text: `${warningType.description}`,
        value: `${warningType.code}`,
        selected: false,
        checked: false,
      })),
    ]

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
      currentPage,
    })
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
