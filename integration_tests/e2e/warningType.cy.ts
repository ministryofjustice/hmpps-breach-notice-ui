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

  it('should show error page with event not sentenced message if 400 error returned from integrations that contains is not sentenced', () => {
    cy.visit('/warning-type/f1111111-12e3-45ba-ba67-1b34bf7b1111')
    cy.url().should('include', '/warning-type')
    cy.get('.govuk-error-summary__title').should('exist').should('contain.text', 'There is a problem')
    cy.get('.govuk-error-summary__list > li > a').should('have.attr', 'href').and('include', '#')
    cy.get('.govuk-error-summary__list > li > a').should(
      'have.text',
      'Breach actions cannot be created pre-sentence. If this event has a valid sentence please contact the service desk and report this error.',
    )
  })

  it('should return to check your report if came from check your report', () => {
    cy.visit('/warning-type/00000000-1111-2222-3333-000000000001/check-your-report')
    cy.url().should('include', '/warning-type')
    cy.get('#warningType').click()
    cy.get('#continue-button').click()
    cy.url().should('include', '/check-your-report/')
  })
})
