context('Navigation Menu data checks', () => {
  it('New report', () => {
    cy.visit('/basic-details/00000000-0000-0000-0000-100000000001')
    cy.get('#nav-warning-types').should('have.class', 'disabled-nav')
    cy.get('#nav-warning-details').should('have.class', 'disabled-nav')
    cy.get('#nav-next-appointment').should('have.class', 'disabled-nav')
    cy.get('#nav-check-your-report').should('have.class', 'disabled-nav')
  })

  it('Basic details saved', () => {
    cy.visit('/basic-details/00000000-0000-0000-0000-100000000002')
    cy.get('#nav-warning-types').should('not.have.class', 'disabled-nav')
    cy.get('#nav-warning-details').should('have.class', 'disabled-nav')
    cy.get('#nav-next-appointment').should('have.class', 'disabled-nav')
    cy.get('#nav-check-your-report').should('not.have.class', 'disabled-nav')
  })

  it('Warning Types saved', () => {
    cy.visit('/basic-details/00000000-0000-0000-0000-100000000003')
    cy.get('#nav-warning-types').should('not.have.class', 'disabled-nav')
    cy.get('#nav-warning-details').should('not.have.class', 'disabled-nav')
    cy.get('#nav-next-appointment').should('have.class', 'disabled-nav')
    cy.get('#nav-check-your-report').should('not.have.class', 'disabled-nav')
  })

  it('Warning details saved', () => {
    cy.visit('/basic-details/00000000-0000-0000-0000-100000000004')
    cy.get('#nav-warning-types').should('not.have.class', 'disabled-nav')
    cy.get('#nav-warning-details').should('not.have.class', 'disabled-nav')
    cy.get('#nav-next-appointment').should('not.have.class', 'disabled-nav')
    cy.get('#nav-check-your-report').should('not.have.class', 'disabled-nav')
  })

  it('Warning details saved root redirect', () => {
    cy.visit('/breach-notice/00000000-0000-0000-0000-100000000009')
    cy.url().should('include', '/next-appointment/00000000-0000-0000-0000-100000000009')
  })

  it('Warning types saved root redirect', () => {
    cy.visit('/breach-notice/00000000-0000-0000-0000-100000000003')
    cy.url().should('include', '/warning-details/00000000-0000-0000-0000-100000000003')
  })

  it('Basic details saved root redirect', () => {
    cy.visit('/breach-notice/00000000-0000-0000-0000-100000000002')
    cy.url().should('include', '/warning-type/00000000-0000-0000-0000-100000000002')
  })

  it('Next Appointment saved root redirect', () => {
    cy.visit('/breach-notice/00000000-0000-0000-0000-100000000004')
    cy.url().should('include', '/check-your-report/00000000-0000-0000-0000-100000000004')
  })
})
