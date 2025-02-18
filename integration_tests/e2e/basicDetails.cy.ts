import Page from '../pages/page'
import IndexPage from '../pages'

context('Basic Details page', () => {
  it('can default readonly fields', () => {
    cy.visit('/basic-details/00000000-0000-0000-0000-000000000001')
    cy.get('#title-and-full-name').should('contain.text', 'Mr Billy The Kid')
    cy.get('#crn').should('contain.text', 'X017052')
    cy.get('#postal-address').should('contain.text', '21 Postal Street')
    cy.get('#postal-address').should('contain.text', 'NE30 3ZZ')
    cy.get('#offenderAddressSelectOne').should('be.checked')
    cy.get('#offenderAddressSelectOne-2').should('not.be.checked')
    cy.get('#reply-address').should('contain.text', '21 Reply Street')
    cy.get('#reply-address').should('contain.text', 'NE22 3AA')
    cy.get('#replyAddressSelectOne').should('be.checked')
    cy.get('#replyAddressSelectOne-2').should('not.be.checked')
    cy.get('#date-of-letter').should('have.value', '')
    cy.get('#office-reference').should('have.value', '')
  })

  // it('entering date more than 7 days in the future causes validation', () => {
  //   cy.visit('/basic-details/00000000-0000-0000-0000-000000000001')
  //   cy.get('#date-of-letter').type('17/05/2200')
  //   cy.
  //
  //   cy.get('#title-and-full-name').should('contain.text', 'Mr Billy The Kid')
  //   cy.get('#crn').should('contain.text', 'X017052')
  //   cy.get('#postal-address').should('contain.text', '21 Postal Street')
  //   cy.get('#postal-address').should('contain.text', 'NE30 3ZZ')
  //   cy.get('#offenderAddressSelectOne').should('be.checked')
  //   cy.get('#offenderAddressSelectOne-2').should('not.be.checked')
  //   cy.get('#reply-address').should('contain.text', '21 Reply Street')
  //   cy.get('#reply-address').should('contain.text', 'NE22 3AA')
  //   cy.get('#replyAddressSelectOne').should('be.checked')
  //   cy.get('#replyAddressSelectOne-2').should('not.be.checked')
  //   cy.get('#office-reference').should('have.value', '')
  // })
})
