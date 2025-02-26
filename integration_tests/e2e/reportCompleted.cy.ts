context('Report Completed page', () => {
  it('displays main panel', () => {
    cy.visit('/report-completed/00000000-0000-0000-0000-000000000001')
    cy.get('.govuk-panel--confirmation').should('exist')
    cy.get('.govuk-panel--confirmation').should('exist').should('contain.text', 'Report Published')
    cy.get('.govuk-panel--confirmation')
      .should('exist')
      .should('contain.text', 'Your Breach Report has been completed and uploaded.')
  })

  it('should navigate to pdf page if pdf link is clicked', () => {
    cy.visit('/report-completed/00000000-0000-0000-0000-000000000001')
    cy.get('#reviewReport').should('exist').should('contain.text', 'View your completed PDF letter')
    // Pdf service currently not working on cypress, so using href evaluation for checking link works
    // cy.get('#reviewReport .govuk-link').click()
    // cy.url().should('include', '/pdf/00000000-0000-0000-0000-000000000001')
    cy.get('#reviewReport .govuk-link').invoke('attr', 'href').should('eq', '/pdf/00000000-0000-0000-0000-000000000001')
  })

  it('should navigate to report-deleted if delete link is clicked', () => {
    cy.visit('/report-completed/00000000-0000-0000-0000-000000000001')
    cy.get('#deleteReport').should('exist').should('contain.text', 'Delete this report')
    cy.get('#deleteReport .govuk-link').click()
    cy.url().should('include', '/report-deleted/00000000-0000-0000-0000-000000000001')
  })
})
