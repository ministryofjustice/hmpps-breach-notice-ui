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
})
