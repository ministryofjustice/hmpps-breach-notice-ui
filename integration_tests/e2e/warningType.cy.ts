context('Warning Type page', () => {
  it('will throw an error if warning type is not selected', () => {
    cy.visit('/warning-type/00000000-0000-0000-0000-000000000001')
    cy.get('#continue-button').click()
    cy.get('.govuk-error-summary__title').should('exist').should('contain.text', 'There is a problem')
    cy.get('#warningType-error')
      .should('exist')
      .should('contain.text', 'You must select a Warning Type before you can continue.')
  })

  it('will throw an error if sentence type is not selected', () => {
    cy.visit('/warning-type/00000000-0000-0000-0000-000000000001')
    cy.get('#continue-button').click()
    cy.get('.govuk-error-summary__title').should('exist').should('contain.text', 'There is a problem')
    cy.get('#sentence-type-error')
      .should('exist')
      .should('contain.text', 'You must select a Sentence Type before you can continue.')
  })

  // it('should navigate to warning-details if all selections have been made', () => {
  //   cy.visit('/warning-type/00000000-0000-0000-0000-000000000001')
  //   cy.get('[type="radio"]').check('FOW')
  //   cy.get('#sentence-Type').select('CO')
  //   cy.get('#continue-button').click()
  //   cy.url().should('include', '/warning-details/00000000-0000-0000-0000-100000000001')
  // })
})
