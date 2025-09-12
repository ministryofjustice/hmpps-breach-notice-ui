context('Domain Event checks', () => {
  it('Basic Details Merge Alert', () => {
    cy.visit('/basic-details/00000000-0000-0000-0000-100000000101')
    cy.get('#reviewAlert').should('exist')
  })

  it('Warning Details Merge Alert', () => {
    cy.visit('/warning-details/00000000-0000-0000-0000-100000000101')
    cy.get('#reviewAlert').should('exist')
  })

  it('Warning Type Merge Alert', () => {
    cy.visit('/warning-type/00000000-0000-0000-0000-100000000101')
    cy.get('#reviewAlert').should('exist')
  })

  it('Next Appointment Merge Alert', () => {
    cy.visit('/next-appointment/00000000-0000-0000-0000-100000000101')
    cy.get('#reviewAlert').should('exist')
  })

  it('Check your report Merge Alert', () => {
    cy.visit('/check-your-report/00000000-0000-0000-0000-100000000101')
    cy.get('#reviewAlert').should('exist')
  })

  it('Basic Details UnMerge Alert', () => {
    cy.visit('/basic-details/00000000-0000-0000-0000-100000000102')
    cy.get('#reviewAlert').should('exist')
  })

  it('Warning Details UnMerge Alert', () => {
    cy.visit('/warning-details/00000000-0000-0000-0000-100000000102')
    cy.get('#reviewAlert').should('exist')
  })

  it('Warning Type UnMerge Alert', () => {
    cy.visit('/warning-type/00000000-0000-0000-0000-100000000102')
    cy.get('#reviewAlert').should('exist')
  })

  it('Next Appointment UnMerge Alert', () => {
    cy.visit('/next-appointment/00000000-0000-0000-0000-100000000102')
    cy.get('#reviewAlert').should('exist')
  })

  it('Check your report UnMerge Alert', () => {
    cy.visit('/check-your-report/00000000-0000-0000-0000-100000000102')
    cy.get('#reviewAlert').should('exist')
  })

  it('Basic Details No Alert', () => {
    cy.visit('/basic-details/00000000-0000-0000-0000-000000000001')
    cy.get('#reviewAlert').should('not.exist')
  })

  it('Warning Details No Alert', () => {
    cy.visit('/warning-details/00000000-0000-0000-0000-000000000001')
    cy.get('#reviewAlert').should('not.exist')
  })

  it('Warning Type No Alert', () => {
    cy.visit('/warning-type/00000000-0000-0000-0000-000000000001')
    cy.get('#reviewAlert').should('not.exist')
  })

  it('Next Appointment No Alert', () => {
    cy.visit('/next-appointment/00000000-0000-0000-0000-000000000001')
    cy.get('#reviewAlert').should('not.exist')
  })

  it('Check your report No Alert', () => {
    cy.visit('/check-your-report/00000000-0000-0000-0000-000000000001')
    cy.get('#reviewAlert').should('not.exist')
  })
})
