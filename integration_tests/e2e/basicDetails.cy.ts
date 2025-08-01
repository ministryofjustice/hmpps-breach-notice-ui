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
    cy.contains(
      'Your Delius account is missing a home area, please contact the service desk to update your account before using this service.',
    ).should('exist')
  })

  it('should show generic 400 error if it isnt home area or is not sentenced type', () => {
    cy.visit('/basic-details/45600000-4560-0000-0000-100000000456')
    cy.url().should('include', '/basic-details')
    cy.get('.govuk-error-summary__title').should('exist').should('contain.text', 'There is a problem')
    cy.contains(
      'An unexpected 400 type error has occurred. Please contact the service desk and report this error.',
    ).should('exist')
  })

  it('should return to check your report if came from check your report', () => {
    cy.visit('/basic-details/00000000-1111-2222-3333-000000000001?returnTo=check-your-report')
    cy.url().should('include', '/basic-details')
    cy.get('#continue-button').click()
    cy.url().should('include', '/check-your-report/')
  })

  it('should show alternate Reply Address choices if no default but alternates to choose from', () => {
    cy.visit('/basic-details/92eb37f7-e315-47ea-870a-7fb6eb6e5b0f')
    cy.url().should('include', '/basic-details')
    cy.contains('Please specify the reply address that the Person on Probation should contact.').should('exist')
    cy.get('#reply-address').should('not.exist')
  })

  it('should stay on page and show NDelius error message if 500 thrown from NDelius integration service', () => {
    cy.visit('/basic-details/00000000-0000-5555-500000000005')
    cy.get('.govuk-error-summary__title').should('exist').should('contain.text', 'There is a problem')
    cy.contains('There has been a problem fetching information from NDelius. Please try again later.').should('exist')
  })

  it('should stay on page and show NDelius error message if 502 thrown from NDelius integration service', () => {
    cy.visit('/basic-details/56780000-0000-5678-500000005678')
    cy.get('.govuk-error-summary__title').should('exist').should('contain.text', 'There is a problem')
    cy.contains('There has been a problem fetching information from NDelius. Please try again later.').should('exist')
  })

  it('should stay on page and show Breach Notice Service error message if 500 thrown from Nat Breach Service', () => {
    cy.visit('/basic-details/00000000-0000-8888-800000000008')
    cy.get('.govuk-error-summary__title').should('exist').should('contain.text', 'There is a problem')
    cy.contains(
      'There has been a problem fetching information from the Breach Notice Service. Please try again later.',
    ).should('exist')
  })

  it('add address button should display when no default or reply addresses are present', () => {
    cy.visit('/basic-details/f1234567-12e3-45ba-9999-1b34bf7b9999')
    cy.url().should('include', '/basic-details')
    cy.get('#AddAddressMessage').should('be.visible')
    cy.contains(
      'No reply address can be found for this responsible officer. Please add an address by selecting the button below',
    )
    cy.get('#add-address-button').should('exist').should('be.visible').click()
    cy.url().should('include', '/add-address')
  })

  it('when address has been added manually and null returned for reply addresses from integration dont show alternate address section', () => {
    cy.visit('/basic-details/29292929-29e3-45ba-2929-1b34bf7b2929')
    cy.url().should('include', '/basic-details')
    cy.get('#alternate-reply-address').should('not.exist')
    cy.get('#update-address-button').should('exist').should('be.visible')
  })

  it('when address has been added manually and an empty list is returned for reply addresses from integration dont show alternate address section', () => {
    cy.visit('/basic-details/12312312-29b1-45c1-2929-123123123123')
    cy.url().should('include', '/basic-details')
    cy.get('#alternate-reply-address').should('not.exist')
    cy.get('#update-address-button').should('exist').should('be.visible')
  })

  it('update address button should display when no default present or reply addresses and stored address id is -1', () => {
    cy.visit('/basic-details/12121212-12e3-45ba-9999-121212121212')
    cy.url().should('include', '/basic-details')
    cy.get('#update-address-button').should('exist').should('be.visible')
  })

  it('basic details correctly shows stored breach notice reply address when none returned from integration', () => {
    cy.visit('/basic-details/a18eab88-7729-4000-a628-33f0b7670393')
    cy.url().should('include', '/basic-details')
    cy.get('#reply-address').should(
      'contain.text',
      '\n                   Description\n                   Name\n                  21 Jump Street\n                    \n                   District 9\n                   London\n                   Westminster\n                   SW1 1AA\n                ',
    )
  })

  it('when breach notice has been deleted, landing page should give useful error', () => {
    cy.visit('/basic-details/9b5fe239-827f-4934-bbd1-4bf6f78b15c0')
    cy.url().should('include', '/basic-details')
    cy.get('.govuk-error-summary__title').should('exist').should('contain.text', 'There is a problem')
    cy.contains('The document has not been found or has been deleted. An error has been logged. 404').should('exist')
  })

  it('should not show default address if previously stored default was a real address from NDelius that is no longer present and should show add instead if no default or alternate addresses now available', () => {
    cy.visit('/basic-details/076767676-827f-4934-bbd1-767676767676')
    cy.url().should('include', '/basic-details')
    cy.get('.govuk-error-summary__title').should('exist').should('contain.text', 'There is a problem')
    cy.contains(
      'Reply Address: The previously selected address is no longer available. Please select an alternative.',
    ).should('exist')
    cy.get('#add-address-button').should('exist')
  })

  it('add address deeplink should appear when only no address available', () => {
    cy.visit('/basic-details/00000000-ff00-0000-0000-000000000001')
    cy.url().should('include', '/basic-details')
    cy.get('#no-address-message')
      .should('be.visible')
      .should('contain.text', 'No Postal Address found in National Delius')
    cy.get('#no-address-supplementary-message')
      .should('be.visible')
      .should('contain.text', 'In order to complete a Breach Notice you must add an address to Delius.')
    cy.get('#no-address-supplementary-message-2')
      .should('be.visible')
      .should('contain.text', 'Please use the below link to add an address.')
    cy.get('#address-deeplink-message').should('be.visible')
    cy.get('#no-address-suffix').should('be.visible')
    cy.get('#postal-address').should('not.exist')
    cy.get('#addAddressDeeplink')
      .should(
        'have.attr',
        'href',
        'http://localhost:7001/NDelius-war/delius/JSP/deeplink.xhtml?component=AddressandAccommodation&CRN=X100500',
      )
      .should('contain.text', 'click this hyperlink to open a new tab to add an address to Delius')
  })
})
