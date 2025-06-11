context('Confirm Delete page', () => {
  it('display title and buttons', () => {
    cy.visit('/confirm-delete/807a8867-bd7f-4d3c-b810-00f494b76882')
    cy.url().should('include', '/confirm-delete')
    cy.get('.govuk-heading-l').should('exist').should('contain.text', 'Are you sure you wish to delete this document?')
    cy.get('#confirm-button').should('exist').should('be.visible').should('contain.text', 'Confirm')
    cy.get('#cancel-button').should('exist').should('be.visible').should('contain.text', 'Cancel')
  })

  it('should navigate to report deleted page if delete button is clicked', () => {
    cy.visit('/confirm-delete/5a50758c-ffd9-4e36-9977-8f66e1535208')
    cy.url().should('include', '/confirm-delete')
    cy.get('#confirm-button').should('exist').should('be.visible').click()
    cy.url().should('include', '/report-deleted')
  })

  it('should navigate to check your details if cancel button is clicked', () => {
    cy.visit('/confirm-delete/807a8867-bd7f-4d3c-b810-00f494b76882')
    cy.url().should('include', '/confirm-delete')
    cy.get('#cancel-button').should('exist').should('be.visible').click()
    cy.url().should('include', '/check-your-report')
  })
})
