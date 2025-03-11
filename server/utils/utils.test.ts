import { convertToTitleCase, initialiseName, combineName, formatAddressForSelectMenuDisplay } from './utils'
import { DeliusAddress, Name } from '../data/ndeliusIntegrationApiClient'

describe('convert to title case', () => {
  it.each([
    [null, null, ''],
    ['empty string', '', ''],
    ['Lower case', 'robert', 'Robert'],
    ['Upper case', 'ROBERT', 'Robert'],
    ['Mixed case', 'RoBErT', 'Robert'],
    ['Multiple words', 'RobeRT SMiTH', 'Robert Smith'],
    ['Leading spaces', '  RobeRT', '  Robert'],
    ['Trailing spaces', 'RobeRT  ', 'Robert  '],
    ['Hyphenated', 'Robert-John SmiTH-jONes-WILSON', 'Robert-John Smith-Jones-Wilson'],
  ])('%s convertToTitleCase(%s, %s)', (_: string, a: string, expected: string) => {
    expect(convertToTitleCase(a)).toEqual(expected)
  })
})

describe('initialise name', () => {
  it.each([
    [null, null, null],
    ['Empty string', '', null],
    ['One word', 'robert', 'r. robert'],
    ['Two words', 'Robert James', 'R. James'],
    ['Three words', 'Robert James Smith', 'R. Smith'],
    ['Double barrelled', 'Robert-John Smith-Jones-Wilson', 'R. Smith-Jones-Wilson'],
  ])('%s initialiseName(%s, %s)', (_: string, a: string, expected: string) => {
    expect(initialiseName(a)).toEqual(expected)
  })
})

describe('Combine name', () => {
  it.each([
    ['Mr', { forename: 'Test', middleName: null, surname: 'Test' }, 'Mr Test Test'],
    ['Mr', { forename: 'Test', middleName: 'Test', surname: 'Test' }, 'Mr Test Test Test'],
    [null, { forename: 'Test', middleName: 'Test', surname: 'Test' }, 'Test Test Test'],
  ])('%s combineName(%s, %s)', (_: string, a: Name, expected: string) => {
    expect(combineName(_, a)).toEqual(expected)
  })
})

describe('Format address for select menu', () => {
  it.each([
    [
      {
        id: 1,
        status: 'Postal',
        buildingName: 'Namy',
        buildingNumber: '23',
        streetName: 'streety',
        townCity: 'towny',
        district: 'district',
        county: 'county',
        postcode: 'NE1 1SA',
      },
      'Namy, 23 streety, district, towny, county, NE1 1SA',
    ],
    [
      {
        id: 2,
        status: 'Main',
        buildingName: null,
        buildingNumber: null,
        streetName: null,
        townCity: null,
        district: null,
        county: 'county',
        postcode: 'NE1 1SA',
      },
      'county, NE1 1SA',
    ],
    [
      {
        id: 2,
        status: 'Main',
        buildingName: null,
        buildingNumber: null,
        streetName: null,
        townCity: null,
        district: null,
        county: null,
        postcode: null,
      },
      '',
    ],
  ])('%s formatAddressForSelectMenuDisplay(%s)', (deliusAddress: DeliusAddress, expected: string) => {
    expect(formatAddressForSelectMenuDisplay(deliusAddress)).toEqual(expected)
  })
})
