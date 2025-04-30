import { LocalDate } from '@js-joda/core'
import { toUserDate } from '../utilities/dateUtils'

context('Basic Details page', () => {
  it('can default readonly fields', () => {
    cy.visit('/basic-details/00000000-0000-0000-0000-000000000001')
    cy.get('#title-and-full-name').should('contain.text', 'Mr Billy The Kid')
    cy.get('#crn').should('contain.text', 'X017052')
    cy.get('#postal-address').should('contain.text', '281 Postal Default Street')
    cy.get('#postal-address').should('contain.text', 'NE30 3ZZ')
    cy.get('#offenderAddressSelectOne').should('be.checked')
    cy.get('#offenderAddressSelectOne-2').should('not.be.checked')
    cy.get('#reply-address').should('contain.text', '100 Bail Street')
    cy.get('#reply-address').should('contain.text', 'Marked as Default')
    cy.get('#replyAddressSelectOne').should('be.checked')
    cy.get('#replyAddressSelectOne-2').should('not.be.checked')
    cy.get('#date-of-letter').should('have.value', '')
    cy.get('#office-reference').should('have.value', '')
  })

  it('entering a date more than 7 days in the future causes a validation error', () => {
    const dateSevenDaysInTheFuture = toUserDate(LocalDate.now().plusDays(8).toString())
    cy.visit('/basic-details/00000000-0000-0000-0000-000000000001')
    cy.get('#date-of-letter').type(dateSevenDaysInTheFuture)
    cy.get('#continue-button').click()
    cy.get('.govuk-error-summary__title').should('exist').should('contain.text', 'There is a problem')
    cy.get('#date-of-letter-error')
      .should('exist')
      .should('contain.text', 'The proposed date for this letter is a week in the future.')
  })

  it('entering a date in the past causes a validation error', () => {
    const dateInThePast = toUserDate(LocalDate.now().minusDays(1).toString())
    cy.visit('/basic-details/00000000-0000-0000-0000-000000000001')
    cy.get('#date-of-letter').type(dateInThePast)
    cy.get('#continue-button').click()
    cy.get('.govuk-error-summary__title').should('exist').should('contain.text', 'There is a problem')
    cy.get('#date-of-letter-error')
      .should('exist')
      .should('contain.text', 'The letter has not been completed and so the date cannot be before today.')
  })

  it('entering a date in an invalid format causes a validation error', () => {
    cy.visit('/basic-details/00000000-0000-0000-0000-000000000001')
    cy.get('#date-of-letter').type('123456')
    cy.get('#continue-button').click()
    cy.get('.govuk-error-summary__title').should('exist').should('contain.text', 'There is a problem')
    cy.get('#date-of-letter-error')
      .should('exist')
      .should('contain.text', 'The proposed date for this letter is in an invalid format')
  })

  it('entering an Office Reference with more than 30 characterst causes a validation error', () => {
    cy.visit('/basic-details/00000000-0000-0000-0000-000000000001')
    cy.get('#office-reference').type('1234567891-1234567891-1234567891')
    cy.get('#continue-button').click()
    cy.get('.govuk-error-summary__title').should('exist').should('contain.text', 'There is a problem')
    cy.get('#office-reference-error')
      .should('exist')
      .should('contain.text', 'Office Reference must be 30 characters or less')
  })

  it('return to screen after save and address no longer returned from integrations', () => {
    cy.visit('/basic-details/f1234567-12e3-45ba-ba67-1b34bf7b0099')
    cy.get('.govuk-error-summary__title').should('exist').should('contain.text', 'There is a problem')
    cy.get('.govuk-error-summary__list > li > a').should('have.attr', 'href').and('include', 'reply-address')
    cy.get('.govuk-error-summary__list > li > a').should(
      'have.text',
      'Reply Address: The previously selected address is no longer available. Please select an alternative.',
    )
  })

  it('ordered lists should always have please select first', () => {
    cy.visit('/basic-details/f1234567-12e3-45ba-ba67-1b34bf7b0099')
    cy.get('#alternate-address').should('exist')
    cy.get('#alternate-address').children().first().should('have.text', 'Please Select')
    cy.get('#alternate-reply-address').should('exist')
    cy.get('#alternate-reply-address').children().first().should('have.text', 'Please Select')
  })

  it('should show error page with home area message if 400 error returned from integrations that contains home area', () => {
    cy.visit('/basic-details/f9999999-12e3-45ba-ba67-1b34bf7b9999')
    cy.url().should('include', '/basic-details')
    cy.get('.govuk-error-summary__title').should('exist').should('contain.text', 'There is a problem')
    cy.get('.govuk-error-summary__list > li > a').should('have.attr', 'href').and('include', '#')
    cy.get('.govuk-error-summary__list > li > a').should(
      'have.text',
      'Your Delius account is missing a home area, please contact the service desk to update your account before using this service.',
    )
  })

  it('should return to check your report if came from check your report', () => {
    cy.visit('/basic-details/00000000-1111-2222-3333-000000000001?returnTo=check-your-report')
    cy.url().should('include', '/basic-details')
    cy.get('#continue-button').click()
    cy.url().should('include', '/check-your-report/')
  })
})
