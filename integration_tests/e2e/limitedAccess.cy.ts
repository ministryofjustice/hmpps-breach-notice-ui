context('Navigation Menu data checks', () => {
  it('New report', () => {
    cy.visit('/basic-details/00000000-0000-0000-0000-100000000006')
    cy.get('#lao-panel').should('exist')
  })

  it('New report', () => {
    cy.visit('/basic-details/00000000-0000-0000-0000-100000000005')
    cy.get('#lao-panel').should('exist')
  })

  it('New report', () => {
    cy.visit('/basic-details/00000000-0000-0000-0000-100000000007')
    cy.get('#lao-panel').should('exist')
  })

  it('New report', () => {
    cy.visit('/basic-details/00000000-0000-0000-0000-100000000008')
    cy.get('#lao-panel').should('not.exist')
  })
})
