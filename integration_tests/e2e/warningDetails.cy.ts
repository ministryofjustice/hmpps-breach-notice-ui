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
})
