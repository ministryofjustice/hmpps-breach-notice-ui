context('Add Requirement page', () => {
  it('page should load normally', () => {
    cy.visit('/add-requirement/66dbdd78-8975-462b-aecc-8d8813317b19?contactId=00000000-0000-0000-0000-000000000001')
    cy.url().should(
      'include',
      '/add-requirement/66dbdd78-8975-462b-aecc-8d8813317b19?contactId=00000000-0000-0000-0000-000000000001',
    )
    cy.get('.govuk-heading-l').should('exist').should('contain.text', 'Breach Notice - Requirements')
  })

  it('when a Requirement checkbox is checked, breach reasons dropdown appears', () => {
    cy.visit('/add-requirement/de209be2-f992-4305-8ffe-5546b44c4776?contactId=00000000-0000-0000-0000-000000000003')
    cy.url().should(
      'include',
      '/add-requirement/de209be2-f992-4305-8ffe-5546b44c4776?contactId=00000000-0000-0000-0000-000000000003',
    )
    cy.get('#failuresBeingEnforcedRequirements').should('exist').should('not.be.checked')
    cy.get('#conditional-failuresBeingEnforcedRequirements').should('exist').should('not.be.visible')
    cy.get('#failuresBeingEnforcedRequirements').click()
    cy.get('#conditional-failuresBeingEnforcedRequirements').should('exist').should('be.visible')
    cy.get('#conditional-failuresBeingEnforcedRequirements').should('contain.text', 'Why is this being enforced?')
    cy.get('#breachreason0').should('exist').should('be.visible')
    cy.get('#breachreason0').children().first().should('have.text', '[Please Select]')
  })

  it('should stay on page and show Breach Notice Service error message if 500 thrown from Nat Breach Service', () => {
    cy.visit('/add-requirement/22222222-3333-4444-90000000000?contactId=00000000-0000-0000-0000-000000000004')
    cy.url().should('include', '/add-requirement')
    cy.get('.govuk-error-summary__title').should('exist').should('contain.text', 'There is a problem')
    cy.contains(
      'There has been a problem fetching information from the Breach Notice Service. Please try again later.',
    ).should('exist')
  })

  it('should stay on page and show NDelius error message if 500 thrown from NDelius integration service with no buttons', () => {
    cy.visit('/add-requirement/12345678-7777-5555-500000000005?contactId=00000000-0000-0000-0000-000000000005')
    cy.url().should('include', '/add-requirement')
    cy.get('.govuk-error-summary__title').should('exist').should('contain.text', 'There is a problem')
    cy.contains('There has been a problem fetching information from NDelius. Please try again later.').should('exist')
    cy.get('#close-button').should('not.exist')
  })

  it('screen loads when there are no enforceable contacts returned from the integration', () => {
    cy.visit('/add-requirement/4c3dbcf0-f95d-4b67-b925-a0a5da1c1cd4?contactId=00000000-0000-0000-0000-000000000002')
    cy.url().should(
      'include',
      '/add-requirement/4c3dbcf0-f95d-4b67-b925-a0a5da1c1cd4?contactId=00000000-0000-0000-0000-000000000002',
    )
    cy.get('.govuk-heading-m').should('exist').should('contain.text', 'Please select the Requirements being enforced')
    cy.get('#no-requirements-message').should('exist').should('be.visible')
    cy.get('#no-requirements-message').should('contain.text', 'No failures being enforced to display')
    cy.get('#save-button').should('exist').should('be.visible')
    cy.get('#cancel-button').should('exist').should('be.visible')
  })

  it('error should display when please select is left for a checked requirement', () => {
    cy.visit('/add-requirement/6d7f0e28-c2ed-4c98-826b-43a0c80ac63f?contactId=00000000-0000-0000-0000-000000000006')
    cy.url().should(
      'include',
      '/add-requirement/6d7f0e28-c2ed-4c98-826b-43a0c80ac63f?contactId=00000000-0000-0000-0000-000000000006',
    )
    cy.get('#failuresBeingEnforcedRequirements').should('exist').should('not.be.checked')
    cy.get('#conditional-failuresBeingEnforcedRequirements').should('exist').should('not.be.visible')
    cy.get('#failuresBeingEnforcedRequirements').click()
    cy.get('#breachreason0').should('exist').should('be.visible')
    cy.get('#breachreason0').select('[Please Select]')
    cy.get('#save-button').click()
    cy.get('.govuk-error-summary__title').should('exist').should('contain.text', 'There is a problem')
    cy.get('.govuk-error-summary__list a')
      .should('exist')
      .should('contain.text', 'Please select a valid failure reason for each Requirement selected')
  })

  it('should remember selected requirements and their failure reason', () => {
    cy.visit('/add-requirement/09cedd1b-203f-482f-9c4f-eac7d2bf8897?contactId=00000000-0000-0000-0000-000000000007')
    cy.url().should(
      'include',
      '/add-requirement/09cedd1b-203f-482f-9c4f-eac7d2bf8897?contactId=00000000-0000-0000-0000-000000000007',
    )
    cy.get('#failuresBeingEnforcedRequirements-2').should('exist').should('be.checked')
    cy.get('#conditional-failuresBeingEnforcedRequirements-2').should('exist').should('be.visible')
    cy.get('#breachreason167').should('exist').should('be.visible')
    cy.get('#breachreason167').find(':selected').should('have.text', 'Failed to comply').should('have.value', 'BR06')
  })

  it('should navigate to warning details on valid save action', () => {
    cy.visit('/add-requirement/922a6990-ed9d-4687-86a4-30c62b1f2edf?contactId=00000000-0000-0000-0000-000000000008')
    cy.url().should(
      'include',
      '/add-requirement/922a6990-ed9d-4687-86a4-30c62b1f2edf?contactId=00000000-0000-0000-0000-000000000008',
    )
    cy.get('#failuresBeingEnforcedRequirements').click()
    cy.get('#breachreason0').should('exist').should('be.visible')
    cy.get('#breachreason0').select('Failed to comply')
    cy.get('#save-button').click()
    cy.url().should('include', '/warning-details/922a6990-ed9d-4687-86a4-30c62b1f2edf')
    cy.get('.govuk-heading-l').should('exist').should('contain.text', 'Warning Details')
  })
})
