import { LocalDate } from '@js-joda/core'
import { toUserDate } from '../utilities/dateUtils'

context('Check your report page', () => {
  it('Change button for new report', () => {
    cy.visit('/check-your-report/00000000-0000-0000-0000-100000000001')
    cy.get('#change-basic-details').should('exist')
    cy.get('#change-warning-types').should('not.exist')
    cy.get('#change-warning-details').should('not.exist')
    cy.get('#change-next-appointment').should('not.exist')
  })

  it('Change button for new report', () => {
    cy.visit('/check-your-report/00000000-0000-0000-0000-100000000002')
    cy.get('#change-basic-details').should('exist')
    cy.get('#change-warning-types').should('exist')
    cy.get('#change-warning-details').should('not.exist')
    cy.get('#change-next-appointment').should('not.exist')
  })

  it('Change button for new report', () => {
    cy.visit('/check-your-report/00000000-0000-0000-0000-100000000003')
    cy.get('#change-basic-details').should('exist')
    cy.get('#change-warning-types').should('exist')
    cy.get('#change-warning-details').should('exist')
    cy.get('#change-next-appointment').should('not.exist')
  })

  it('Change button for new report', () => {
    cy.visit('/check-your-report/00000000-0000-0000-0000-100000000004')
    cy.get('#change-basic-details').should('exist')
    cy.get('#change-warning-types').should('exist')
    cy.get('#change-warning-details').should('exist')
    cy.get('#change-next-appointment').should('exist')
  })

  it('Publish button not present when not complete', () => {
    cy.visit('/check-your-report/00000000-0000-0000-0000-100000000001')
    cy.get('#publish-button').should('not.exist')
  })
  it('Publish button present when complete', () => {
    cy.visit('/check-your-report/00000000-0000-0000-0000-100000000004')
    cy.get('#publish').should('exist')
  })
})
