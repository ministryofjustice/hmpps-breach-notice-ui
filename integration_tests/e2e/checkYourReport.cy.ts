context('Check your report page', () => {
  it('displays basic details link', () => {
    cy.visit('/check-your-report/00000000-0000-0000-0000-100000000001')
    cy.get('#change-basic-details').should('exist')
    cy.get('#change-warning-types').should('not.exist')
    cy.get('#change-warning-details').should('not.exist')
    cy.get('#change-next-appointment').should('not.exist')

    cy.get('#change-basic-details').click()
    cy.url().should('include', '/basic-details/00000000-0000-0000-0000-100000000001')
  })

  it('displays warning-types details link', () => {
    cy.visit('/check-your-report/00000000-0000-0000-0000-100000000002')
    cy.get('#change-basic-details').should('exist')
    cy.get('#change-warning-types').should('exist')
    cy.get('#change-warning-details').should('not.exist')
    cy.get('#change-next-appointment').should('not.exist')

    cy.get('#change-warning-types').click()
    cy.url().should('include', '/warning-type/00000000-0000-0000-0000-100000000002')
  })

  it('displays warning details link', () => {
    cy.visit('/check-your-report/00000000-0000-0000-0000-100000000003')
    cy.get('#change-basic-details').should('exist')
    cy.get('#change-warning-types').should('exist')
    cy.get('#change-warning-details').should('exist')
    cy.get('#change-next-appointment').should('not.exist')

    cy.get('#change-warning-details').click()
    cy.url().should('include', '/warning-details/00000000-0000-0000-0000-100000000003')
  })

  it('displays next appointment link', () => {
    cy.visit('/check-your-report/00000000-0000-0000-0000-100000000004')
    cy.get('#change-basic-details').should('exist')
    cy.get('#change-warning-types').should('exist')
    cy.get('#change-warning-details').should('exist')
    cy.get('#change-next-appointment').should('exist')

    cy.get('#change-next-appointment').click()
    cy.url().should('include', '/next-appointment/00000000-0000-0000-0000-100000000004')
  })

  it('Publish button not present when not complete', () => {
    cy.visit('/check-your-report/00000000-0000-0000-0000-100000000001')
    cy.get('#publish-button').should('not.exist')
  })

  it('Publish button present when complete', () => {
    cy.visit('/check-your-report/00000000-0000-0000-0000-100000000004')
    cy.get('#publish').should('exist')

    cy.get('#publish').click()
    cy.url().should('include', '/report-completed/00000000-0000-0000-0000-100000000004')
  })
})
