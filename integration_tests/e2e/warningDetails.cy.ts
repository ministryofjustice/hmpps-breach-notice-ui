context('Warning Details page', () => {
  it('page will load with no enforceable contacts', () => {
    cy.visit('/warning-details/00000000-0000-0000-0000-000000000001')
    cy.url().should('include', '/warning-details/00000000-0000-0000-0000-000000000001')
  })

  it('can show readonly value of condition being enforced', () => {
    cy.visit('/warning-details/00000000-0000-0000-0000-000000000022')
    cy.get('#condition-being-enforced').should('contain.text', 'a condition being enforced')
  })

  it('when a Requirement checkbox is checked, breach reasons dropdown appears', () => {
    cy.visit('/warning-details/00000000-0000-0000-0000-000000000022')
    cy.get('#failuresBeingEnforcedRequirements').check()
    cy.get('#breachreason0').should('exist')
  })

  it('when a requirement has no sub type it should not appear', () => {
    cy.visit('/warning-details/90000000-0000-0900-0900-00000000009')
    cy.get('#failuresBeingEnforcedRequirements-2').should('exist')
    cy.get('#failuresBeingEnforcedRequirements').should('exist')
    cy.contains('one with null sub type').should('exist')
    cy.contains('one with null sub type - undefined').should('not.exist')
    cy.contains('A STRING - A SUBSTRING').should('exist')
  })

  it('entering a date in an invalid format causes a validation error', () => {
    cy.visit('/warning-details/00000000-0000-0000-0000-000000000022')
    cy.get('#responseRequiredByDate').type('123456')
    cy.get('#continue-button').click()
    cy.get('.govuk-error-summary__title').should('exist').should('contain.text', 'There is a problem')
    cy.get('#responseRequiredByDate-error')
      .should('exist')
      .should('contain.text', 'The proposed date for this letter is in an invalid format')
  })

  it('screen loads when there are no enforceable contacts returned from the integration', () => {
    cy.visit('/warning-details/f1234567-12e3-45ba-ba67-1b34bf7b009d')
    cy.url().should('include', '/warning-details/f1234567-12e3-45ba-ba67-1b34bf7b009d')
    cy.get('#no-enforceable-contacts-message').should('contain.text', 'No failures to display')
    cy.get('#no-requirements-message').should('contain.text', 'No failures being enforced to display')
  })

  it('should only show unique requirements when multiple contacts point at the same requirement', () => {
    cy.visit('/warning-details/f1234567-12e3-45ba-ba67-1b34bf799999')
    cy.url().should('include', '/warning-details/f1234567-12e3-45ba-ba67-1b34bf799999')
    cy.get('input[type="checkbox"]').as('checkboxes')
    cy.get('@checkboxes').should('have.length', 2)
  })

  it('should remember the saved failure reason for the requirement', () => {
    cy.visit('/warning-details/c8888888-12e3-45ba-ba67-1b34bf7b8888')
    cy.url().should('include', '/warning-details/c8888888-12e3-45ba-ba67-1b34bf7b8888')
    cy.get('#breachreason0').should('exist')
    cy.get('#breachreason0').find('option:selected').should('have.text', 'Another Reason')
  })

  it('should load when enforceable contacts have no notes specified', () => {
    cy.visit('/warning-details/d3333333-12e3-45ba-ba67-1b34bf7b3333')
    cy.url().should('include', '/warning-details/d3333333-12e3-45ba-ba67-1b34bf7b3333')
  })

  it('should escape the text and show new lines correctly', () => {
    cy.visit('/warning-details/d3333333-12e3-45ba-ba67-1b34bf7b3333')
    cy.get('.govuk-details__text').last().as('finalWarningDetail')
    cy.get('@finalWarningDetail').should('contain.html', '    &lt;script&gt; new<br>\nline')
  })

  it('should return to check your report if came from check your report', () => {
    cy.visit('/warning-details/00000000-1111-2222-3333-000000000001?returnTo=check-your-report')
    cy.url().should('include', '/warning-details')
    cy.get('#continue-button').click()
    cy.url().should('include', '/check-your-report/')
  })

  it('should stay on page and show Breach Notice Service error message if 500 thrown from Nat Breach Service', () => {
    cy.visit('/warning-details/22222222-3333-4444-900000000009')
    cy.url().should('include', '/warning-details')
    cy.get('.govuk-error-summary__title').should('exist').should('contain.text', 'There is a problem')
    cy.contains(
      'There has been a problem fetching information from the Breach Notice Service. Please try again later.',
    ).should('exist')
  })

  it('should stay on page and show NDelius error message if 500 thrown from NDelius integration service with no buttons', () => {
    cy.visit('/warning-details/12345678-7777-5555-500000000005')
    cy.get('.govuk-error-summary__title').should('exist').should('contain.text', 'There is a problem')
    cy.contains('There has been a problem fetching information from NDelius. Please try again later.').should('exist')
    cy.get('#close-button').should('not.exist')
  })

  it('should show deeplink in place of enforceable contacts if no enforceable contacts are returned', () => {
    cy.visit('/warning-details/56565656-5656-5656-5656-560000000156')
    cy.get('#no-enforceable-contacts-message').should('exist').should('contain.text', 'No failures to display.')
    cy.get('#no-enforceable-contacts-supplimentary-message')
      .should('exist')
      .should(
        'contain.text',
        'This notice cannot be completed without evidence of the failure that has prompted its creation.',
      )
    cy.get('#contact-deeplink-message').should('exist')
    cy.get('#contactListDeeplink')
      .should('exist')
      .should('contain.text', 'click this hyperlink to open Delius in a new tab and check')
  })

  it('should display saved saved further reason details value', () => {
    cy.visit('/warning-details/9c9cb998-6782-4c23-8cb1-ff2e169c7209')
    cy.url().should('include', '/warning-details')
    cy.get('#furtherReasonDetails').should('exist').should('be.visible')
    cy.get('#furtherReasonDetails').should('contain.text', 'Here are some further reason details')
  })

  it('further reason details field shows error when over 4000 characters entered', () => {
    const errorLimit: string = 'A'.repeat(4001)
    cy.visit('/warning-details/f0be99cd-7939-44fa-adde-43c22d800cd9')
    cy.url().should('include', '/warning-details')
    cy.get('#furtherReasonDetails').should('exist').should('be.visible')
    cy.get('#furtherReasonDetails').invoke('val', errorLimit)
    cy.get('#continue-button').click()
    cy.get('.govuk-error-summary__title').should('exist').should('contain.text', 'There is a problem')
    cy.get('#furtherReasonDetails-error')
      .should('exist')
      .should('contain.text', 'Further reason details: Please use 4000 characters or less for this field.')
  })
})
