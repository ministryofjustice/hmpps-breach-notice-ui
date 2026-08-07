context('Event Terminated page', () => {
  it('display title and buttons', () => {
    cy.visit('/event-terminated/3c7d0f7c-1bcb-4e64-9f7b-66dd5b9b1a41')
    cy.url().should('include', '/event-terminated')
    cy.get('.govuk-error-summary').should(
      'contain.text',
      'This Document is attached to an Event that has been terminated',
    )
    cy.get('#delete-button').should('exist').should('be.visible').should('contain.text', 'Delete')
    cy.get('#close-button').should('exist').should('be.visible').should('contain.text', 'Close')
  })

  it('should display confirmation panel if delete button is clicked', () => {
    cy.visit('/event-terminated/8a9d4d9f-6ed2-4d2d-8c9c-1c7f2a2a6a54')
    cy.get('#delete-button').should('exist').should('be.visible').click()
    cy.get('.govuk-warning-text').should('contain.text', 'Are you sure you wish to delete this?')
    cy.get('#confirm-button').should('exist').should('be.visible').should('contain.text', 'Confirm')
    cy.get('#cancel-button').should('exist').should('be.visible').should('contain.text', 'Cancel')
  })

  it('should navigate to report deleted page if confirm button is clicked', () => {
    cy.visit('/event-terminated/7f0b0ed4-3c87-4c5b-90e0-1d7edcb5f5d8')
    cy.get('#delete-button').should('exist').should('be.visible').click()
    cy.get('#confirm-button').should('exist').should('be.visible').click()
    cy.url().should('include', '/report-deleted')
  })

  it('should close tab details if close button is clicked', () => {
    cy.visit('/event-terminated/2f14f6b7-5c04-4d5b-b2c8-2e7e1b6f0d13')
    cy.get('#close-button').click()
    cy.contains('You can now safely close this window').should('be.visible')
    cy.get('#page-title').should('not.exist')
  })
})
