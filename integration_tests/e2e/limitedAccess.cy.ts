context('Limited Access checks', () => {
  it('Basic Details LAO Excluded', () => {
    cy.visit('/basic-details/00000000-0000-0000-0000-100000000005')
    cy.get('#lao-panel').should('exist')
    cy.get('#exclusionText').should('exist')
    cy.get('#restrictionText').should('not.exist')
  })

  it('Basic Details LAO Restricted', () => {
    cy.visit('/basic-details/00000000-0000-0000-0000-100000000006')
    cy.get('#lao-panel').should('exist')
    cy.get('#exclusionText').should('not.exist')
    cy.get('#restrictionText').should('exist')
  })

  it('Basic Details LAO Both', () => {
    cy.visit('/basic-details/00000000-0000-0000-0000-100000000007')
    cy.get('#lao-panel').should('exist')
    cy.get('#exclusionText').should('exist')
    cy.get('#restrictionText').should('exist')
  })

  it('Basic Details LAO None', () => {
    cy.visit('/basic-details/00000000-0000-0000-0000-100000000008')
    cy.get('#lao-panel').should('not.exist')
    cy.get('#exclusionText').should('not.exist')
    cy.get('#restrictionText').should('not.exist')
  })

  it('Check your report LAO Excluded', () => {
    cy.visit('/check-your-report/00000000-0000-0000-0000-100000000005')
    cy.get('#lao-panel').should('exist')
    cy.get('#exclusionText').should('exist')
    cy.get('#restrictionText').should('not.exist')
  })

  it('Check your report LAO Restricted', () => {
    cy.visit('/check-your-report/00000000-0000-0000-0000-100000000006')
    cy.get('#lao-panel').should('exist')
    cy.get('#exclusionText').should('not.exist')
    cy.get('#restrictionText').should('exist')
  })

  it('Check your report LAO Both', () => {
    cy.visit('/check-your-report/00000000-0000-0000-0000-100000000007')
    cy.get('#lao-panel').should('exist')
    cy.get('#exclusionText').should('exist')
    cy.get('#restrictionText').should('exist')
  })

  it('Check your report LAO None', () => {
    cy.visit('/check-your-report/00000000-0000-0000-0000-100000000008')
    cy.get('#lao-panel').should('not.exist')
    cy.get('#exclusionText').should('not.exist')
    cy.get('#restrictionText').should('not.exist')
  })
})
