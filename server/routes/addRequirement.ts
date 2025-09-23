import { Router } from 'express'
import AuditService, { Page } from '../services/auditService'
import BreachNoticeApiClient, {
  BreachNotice,
  BreachNoticeRequirement,
  ContactRequirement,
  RequirementSelectItem,
} from '../data/breachNoticeApiClient'
import { HmppsAuthClient } from '../data'
import { ErrorMessages, SelectItem } from '../data/uiModels'
import asArray, {
  arrangeSelectItemListAlphabetically,
  createBlankBreachNoticeWithId,
  handleIntegrationErrors,
} from '../utils/utils'
import NdeliusIntegrationApiClient, {
  ReferenceData,
  Requirement,
  RequirementList,
  Requirements,
} from '../data/ndeliusIntegrationApiClient'
import CommonUtils from '../services/commonUtils'

export default function addRequirementRoutes(
  router: Router,
  auditService: AuditService,
  hmppsAuthClient: HmppsAuthClient,
  commonUtils: CommonUtils,
): Router {
  router.get('/add-requirement/:id', async (req, res, next) => {
    await auditService.logPageView(Page.ADD_REQUIREMENT, { who: res.locals.user.username, correlationId: req.id })
    const token = await hmppsAuthClient.getSystemClientToken(res.locals.user.username)
    const contactId: string = req.query.contactId as string
    const breachNoticeApiClient = new BreachNoticeApiClient(token)
    const ndeliusIntegrationApiClient = new NdeliusIntegrationApiClient(token)

    let breachNotice: BreachNotice
    let requirements: Requirements = null
    let contactRequirementList: Array<ContactRequirement> = null

    try {
      // get the existing breach notice
      breachNotice = await breachNoticeApiClient.getBreachNoticeById(req.params.id as string)
      contactRequirementList = await breachNoticeApiClient.getContactRequirementLinksWithContact(
        req.params.id as string,
        contactId,
      )
    } catch (error) {
      const errorMessages: ErrorMessages = handleIntegrationErrors(error.status, error.data?.message, 'Breach Notice')
      const showEmbeddedError = true
      breachNotice = createBlankBreachNoticeWithId(req.params.id)
      // always stay on page and display the error when there are isssues retrieving the breach notice
      res.render(`pages/add-requirement`, { errorMessages, showEmbeddedError, breachNotice })
      return
    }

    if (await commonUtils.redirectRequired(breachNotice, res)) return

    try {
      // get details from the integration service
      requirements = await ndeliusIntegrationApiClient.getRequirements(breachNotice.id)
    } catch (error) {
      const errorMessages: ErrorMessages = handleIntegrationErrors(
        error.status,
        error.data?.message,
        'NDelius Integration',
      )
      // take the user to detailed error page for 400 type errors
      if (error.status === 400) {
        res.render(`pages/detailed-error`, { errorMessages })
        return
      }
      // stay on the current page for 500 errors
      if (error.status === 500) {
        const showEmbeddedError = true
        breachNotice = createBlankBreachNoticeWithId(req.params.id)
        res.render(`pages/add-requirement`, { errorMessages, showEmbeddedError, breachNotice })
        return
      }
      res.render(`pages/detailed-error`, { errorMessages })
      return
    }

    requirements.breachReasons.push({ code: '-1', description: '[Please Select]' })
    const breachReasons = convertReferenceDataListToSelectItemList(requirements.breachReasons)

    const requirementsList = createFailuresBeingEnforcedRequirementSelectList(
      requirements.requirements,
      requirements.breachReasons,
      contactRequirementList,
    )

    res.render('pages/add-requirement', {
      breachNotice,
      breachReasons,
      requirementsList,
    })
  })

  router.post('/add-requirement/:id', async (req, res, next) => {
    const token = await hmppsAuthClient.getSystemClientToken(res.locals.user.username)
    const contactId: string = req.query.contactId as string
    const breachNoticeApiClient = new BreachNoticeApiClient(token)
    const ndeliusIntegrationApiClient = new NdeliusIntegrationApiClient(token)
    const { id } = req.params

    if (req.body.action === 'cancel') {
      res.redirect(`/warning-details/${id}`)
    } else {
      let breachNotice: BreachNotice
      let requirements: Requirements = null
      let contactRequirementList: Array<ContactRequirement> = null

      try {
        // get the existing breach notice
        breachNotice = await breachNoticeApiClient.getBreachNoticeById(req.params.id as string)
        contactRequirementList = await breachNoticeApiClient.getContactRequirementLinksWithContact(
          req.params.id as string,
          contactId,
        )
      } catch (error) {
        const errorMessages: ErrorMessages = handleIntegrationErrors(error.status, error.data?.message, 'Breach Notice')
        const showEmbeddedError = true
        breachNotice = createBlankBreachNoticeWithId(req.params.id)
        // always stay on page and display the error when there are isssues retrieving the breach notice
        res.render(`pages/add-requirement`, { errorMessages, showEmbeddedError, breachNotice })
        return
      }

      try {
        // get details from the integration service
        requirements = await ndeliusIntegrationApiClient.getRequirements(breachNotice.id)
      } catch (error) {
        const errorMessages: ErrorMessages = handleIntegrationErrors(
          error.status,
          error.data?.message,
          'NDelius Integration',
        )
        // take the user to detailed error page for 400 type errors
        if (error.status === 400) {
          res.render(`pages/detailed-error`, { errorMessages })
          return
        }
        // stay on the current page for 500 errors
        if (error.status === 500) {
          const showEmbeddedError = true
          breachNotice = createBlankBreachNoticeWithId(req.params.id)
          res.render(`pages/add-requirement`, { errorMessages, showEmbeddedError, breachNotice })
          return
        }
        res.render(`pages/detailed-error`, { errorMessages })
        return
      }

      requirements.breachReasons.push({ code: '-1', description: '[Please Select]' })
      const breachReasons = convertReferenceDataListToSelectItemList(requirements.breachReasons)

      const requirementsList = createFailuresBeingEnforcedRequirementSelectList(
        requirements.requirements,
        requirements.breachReasons,
        contactRequirementList,
      )

      const errorMessages: ErrorMessages = validateAddRequirements(JSON.stringify(req.body))

      const hasErrors: boolean = Object.keys(errorMessages).length > 0

      // if we dont have validation errors navigate to next screen
      if (!hasErrors) {
        const newContactRequirementList: Array<ContactRequirement> = []
        if (req.body.failuresBeingEnforcedRequirements) {
          const selectedIds = asArray(req.body.failuresBeingEnforcedRequirements)
          const selectedRequirements = requirements.requirements.filter(r => selectedIds.includes(r.id.toString(), 0))
          for (const requirement of selectedRequirements) {
            // Any that dont exist in DB add in
            // Update any with changed reasons
            const rejectionReasonCode = req.body[`breachreason${requirement.id}`]
            const rejectionReasonDescription = requirements.breachReasons.find(
              rd => rd.code === rejectionReasonCode,
            ).description
            let storedRequirement = breachNotice.breachNoticeRequirementList.find(
              r => r.requirementId === requirement.id,
            )
            if (!storedRequirement) {
              const breachNoticeRequirement: BreachNoticeRequirement = {
                id: null,
                breachNoticeId: breachNotice.id,
                requirementId: requirement.id,
                requirementTypeMainCategoryDescription: requirement.type.description,
                requirementTypeSubCategoryDescription: requirement.subType?.description,
                rejectionReason: rejectionReasonDescription,
                fromDate: null,
                toDate: null,
              }
              // eslint-disable-next-line no-await-in-loop
              const newId = await breachNoticeApiClient.createBreachNoticeRequirement(breachNoticeRequirement)
              storedRequirement = breachNoticeRequirement
              storedRequirement.id = newId
            } else if (storedRequirement.rejectionReason !== rejectionReasonDescription) {
              storedRequirement.rejectionReason = rejectionReasonDescription
              // eslint-disable-next-line no-await-in-loop
              await breachNoticeApiClient.updateBreachNoticeRequirement(storedRequirement.id, storedRequirement)
            }
            const newContactRequirement: ContactRequirement = {
              breachNoticeId: breachNotice.id,
              contactId,
              contact: null,
              requirementId: storedRequirement.id,
              requirement: null,
            }
            newContactRequirementList.push(newContactRequirement)
          }
        }

        // Grab links from DB
        const existingRequirementLinks = contactRequirementList.map(cr => cr.requirementId)
        const newRequirementLinks = newContactRequirementList.map(cr => cr.requirementId)
        const recordsToRemove = contactRequirementList.filter(cr => !newRequirementLinks.includes(cr.requirementId))
        // Remove any links not present anymore
        const recordsToAdd = newContactRequirementList.filter(
          cr => !existingRequirementLinks.includes(cr.requirementId),
        )
        await breachNoticeApiClient.batchDeleteContactRequirements(recordsToRemove)
        await breachNoticeApiClient.batchCreateContactRequirements(recordsToAdd)
        await breachNoticeApiClient.recalculateRequirementFromToDate(breachNotice.id)
        // contactRequirementRepository.saveAll(recordsToAdd)

        res.redirect(`/warning-details/${id}`)
      } else {
        const selectedIds = asArray(req.body.failuresBeingEnforcedRequirements)
        for (const requirement of requirementsList) {
          if (selectedIds.includes(requirement.value)) {
            requirement.checked = true
            const rejectionReasonCode = req.body[`breachreason${requirement.value}`]
            requirement.conditional.html = requirement.conditional.html
              .replace('value="-1" selected', 'value="-1"')
              .replace(`value="${rejectionReasonCode}"`, `value="${rejectionReasonCode}" selected`)
          }
        }

        res.render('pages/add-requirement', {
          errorMessages,
          breachNotice,
          breachReasons,
          requirementsList,
        })
      }
    }
  })

  function createFailuresBeingEnforcedRequirementSelectList(
    requirements: RequirementList,
    breachReasons: ReferenceData[],
    filteredContactRequirements: ContactRequirement[],
  ): RequirementSelectItem[] {
    if (requirements) {
      return requirements.map((requirement: Requirement) => {
        let contactLink: ContactRequirement = null
        if (filteredContactRequirements && filteredContactRequirements.length > 0) {
          contactLink = filteredContactRequirements.find(
            savedRequirement => savedRequirement.requirement?.requirementId.toString() === requirement.id?.toString(),
          )
        }
        const itemSubText = requirement.subType ? `- ${requirement.subType.description}` : ''
        const breachReasonSelectItems = craftTheBreachReasonSelectItems(breachReasons, contactLink)
        return {
          text: `${requirement.type?.description} ${itemSubText}`,
          value: requirement.id.toString(),
          checked: !!contactLink,
          conditional: {
            html: `<div class="govuk-form-group">
              <label class="govuk-label" for="breachreason${requirement.id}">Why is this being enforced?</label>
              <select class="govuk-select" id="breachreason${requirement.id}" name="breachreason${requirement.id}">
              ${breachReasonSelectItems.map(item => `<option value="${item.value}" ${item.selected ? 'selected' : ''}>${item.text}</option>`).join()}
              </select>
            </div>`,
          },
        }
      })
    }
    return []
  }

  function craftTheBreachReasonSelectItems(
    refDataList: ReferenceData[],
    requirement: ContactRequirement,
  ): SelectItem[] {
    return arrangeSelectItemListAlphabetically(
      refDataList.map((referenceData: ReferenceData) => {
        return {
          text: referenceData.description,
          value: referenceData.code,
          selected: requirement && requirement?.requirement?.rejectionReason === referenceData.description,
        }
      }),
    )
  }

  function convertReferenceDataListToSelectItemList(referenceDataList: ReferenceData[]): SelectItem[] {
    return referenceDataList.map(refData => ({
      selected: false,
      text: refData.description,
      value: refData.code,
    }))
  }

  function validateAddRequirements(jsonString: string): ErrorMessages {
    const errorMessages: ErrorMessages = {}
    const reqBody = JSON.parse(jsonString)

    if (reqBody.failuresBeingEnforcedRequirements) {
      const selectedIds = asArray(reqBody.failuresBeingEnforcedRequirements)

      for (const id of selectedIds) {
        if (reqBody[`breachreason${id}`] === '-1') {
          errorMessages.nonSelectedReason = {
            text: 'Please select a valid failure reason for each Requirement selected',
          }
          return errorMessages
        }
      }
    }
    return errorMessages
  }

  return router
}
