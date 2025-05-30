context('Next Appointment page', () => {
  it('can default readonly fields', () => {
    cy.visit('/next-appointment/00000000-0000-0000-0000-000000000001')
    cy.get('#responsible-officer').should('contain.text', 'ROForename ROSurname')
    cy.get('#contact-number').should('contain.text', '01234567891')
  })

  it('selecting no on use RO contact number radio and leaving new field blank causes a validation error', () => {
    cy.visit('/next-appointment/00000000-0000-0000-0000-000000000001')
    cy.get('#useContactNumber-2').click()
    cy.get('#continue-button').click()
    cy.get('.govuk-error-summary__title').should('exist').should('contain.text', 'There is a problem')
    cy.get('#contact-by-phone-error')
      .should('exist')
      .should('contain.text', 'A number is required when using a different contact number.')
  })

  it('entering more than 35 characters in the contact number field causes validation error', () => {
    cy.visit('/next-appointment/00000000-0000-0000-0000-000000000001')
    cy.get('#useContactNumber-2').click()
    cy.get('#contact-by-phone').type('0123456789012345678901234567890123456')
    cy.get('#continue-button').click()
    cy.get('.govuk-error-summary__title').should('exist').should('contain.text', 'There is a problem')
    cy.get('#contact-by-phone-error')
      .should('exist')
      .should('contain.text', 'The contact number entered is invalid. Numbers must be less than 35 characters long.')
  })

  it('entering non-numeric characters in the contact number field causes validation error', () => {
    cy.visit('/next-appointment/00000000-0000-0000-0000-000000000001')
    cy.get('#useContactNumber-2').click()
    cy.get('#contact-by-phone').type('0123a56t8pO')
    cy.get('#continue-button').click()
    cy.get('.govuk-error-summary__title').should('exist').should('contain.text', 'There is a problem')
    cy.get('#contact-by-phone-error')
      .should('exist')
      .should(
        'contain.text',
        'The contact number entered is invalid. Numbers must consist of numerals and spaces only.',
      )
  })

  it('should return to check your report if came from check your report', () => {
    cy.visit('/next-appointment/00000000-1111-2222-3333-000000000001?returnTo=check-your-report')
    cy.url().should('include', '/next-appointment')
    cy.get('#continue-button').click()
    cy.url().should('include', '/check-your-report/')
  })

  it('appointments should only show when select a next appointment is yes', () => {
    cy.visit('/next-appointment/00000000-0000-0000-0000-000000000001')
    cy.get('#selectNextAppointment').should('be.checked')
    cy.get('#selectNextAppointment-2').should('not.be.checked')
    cy.get('#conditional-selectNextAppointment-2').should('not.be.visible')
    cy.get('#selectNextAppointment-2').should('exist').click()
    cy.get('#selectNextAppointment').should('not.be.checked')
    cy.get('#selectNextAppointment-2').should('be.checked')
    cy.get('#conditional-selectNextAppointment-2').should('be.visible')
    cy.get('#appointmentSelection').should('exist').click()
  })

  it('message should appear when no appointments exist for offender', () => {
    cy.visit('/next-appointment/00000000-0000-0000-0000-100000000002')
    cy.get('#selectNextAppointment-2').should('exist').click()
    cy.get('#conditional-selectNextAppointment-2').should('exist')
    cy.get('#appointmentSelection-error')
      .should('exist')
      .should(
        'contain.text',
        'No future appointments are available to select at this time. Please add an appointment in NDelius and refresh this screen if one is required',
      )
  })

  it('message should appear when officer has no number in LDAP', () => {
    cy.visit('/next-appointment/00000000-0000-0000-0000-100000000002')
    cy.get('#contact-number').should('exist')
    cy.get('#contact-number')
      .should('be.visible')
      .should('contain.text', 'No Contact Number found for this Responsible Officer')
  })

  it('should stay on page and show Breach Notice Service error message if 500 thrown from Nat Breach Service', () => {
    cy.visit('/next-appointment/88888888-1111-8888-800000000008')
    cy.url().should('include', '/next-appointment')
    cy.get('.govuk-error-summary__title').should('exist').should('contain.text', 'There is a problem')
    cy.contains(
      'There has been a problem fetching information from the Breach Notice Service. Please try again later.',
    ).should('exist')
  })

  it('should stay on page and show NDelius error message if 500 thrown from NDelius integration service with no buttons', () => {
    cy.visit('/next-appointment/12345678-7777-5555-500000000005')
    cy.get('.govuk-error-summary__title').should('exist').should('contain.text', 'There is a problem')
    cy.contains('There has been a problem fetching information from NDelius. Please try again later.').should('exist')
    cy.get('#close-button').should('not.exist')
  })
})
