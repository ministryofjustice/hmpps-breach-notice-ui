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
    cy.get('#checkbox1').check()
    cy.get('#breachReason1').should('exist')
  })
})
