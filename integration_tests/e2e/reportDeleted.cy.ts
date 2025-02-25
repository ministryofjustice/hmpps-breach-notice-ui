context('Report Deleted page', () => {
  it('displays correct panel message', () => {
    cy.visit('/report-deleted/00000000-0000-0000-0000-000000000001')
    cy.get('.govuk-panel--confirmation').should('exist')
    cy.get('.govuk-panel--confirmation').should('exist').should('contain.text', 'Report Deleted')
    cy.get('.govuk-panel--confirmation')
      .should('exist')
      .should('contain.text', 'This Breach Report has been permanently deleted and cannot be recovered')
  })

  it('delete link closes window', () => {
    cy.visit('/report-deleted/00000000-0000-0000-0000-000000000001')
    cy.get('#close-window').should('exist').should('contain.text', 'Return back to the main Delius Screen')
    cy.get('#close-window .govuk-link').click()
    cy.url().should('include', '/close')
  })
})
