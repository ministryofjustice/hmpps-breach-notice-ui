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
    cy.get('#sentence-type').select('-1')
    cy.get('#continue-button').click()
    cy.get('.govuk-error-summary__title').should('exist').should('contain.text', 'There is a problem')
    cy.get('#sentence-type-error')
      .should('exist')
      .should('contain.text', 'You must select a Sentence Type before you can continue.')
  })

  it('will default Sentence Type on page visit when not saved', () => {
    cy.visit('/warning-type/00000000-0000-0000-0000-000000000001')
    cy.get('#sentence-type').find('option:selected').should('have.text', 'sdo')
  })

  it('will NOT default Sentence Type on page when saved', () => {
    cy.visit('/warning-type/00000000-0000-0000-0000-900000000001')
    cy.get('#sentence-type').find('option:selected').should('have.text', 'Community Order')
  })

  it('should navigate to warning-details if all selections have been made', () => {
    cy.visit('/warning-type/00000000-0000-0000-0000-000000000001')
    cy.get('[type="radio"]').check('FOW')
    cy.get('select').select('CO')
    cy.get('#continue-button').click()
    cy.url().should('include', '/warning-details/00000000-0000-0000-0000-000000000001')
  })
})
