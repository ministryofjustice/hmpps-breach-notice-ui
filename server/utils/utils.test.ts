import {
  convertToTitleCase,
  initialiseName,
  combineName,
  formatAddressForSelectMenuDisplay,
  removeDeliusAddressFromDeliusAddressList,
  arrangeSelectItemListAlphabetically,
} from './utils'
import { DeliusAddress, Name } from '../data/ndeliusIntegrationApiClient'
import { SelectItem } from '../data/uiModels'

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

describe('Should Arrange SelectItem List Alphabetically', () => {
  test('Should arrange select item list Alphabetically', () => {
    const selectItemList: SelectItem[] = [
      {
        value: 'zzz',
        text: 'a1',
        selected: false,
      },
      {
        value: 'zzz',
        text: 'a2',
        selected: false,
      },
      {
        value: 'zzz',
        text: '100',
        selected: false,
      },
    ]

    const sortedList = arrangeSelectItemListAlphabetically(selectItemList)
    expect(sortedList[0].text).toBe('100')
    expect(sortedList[1].text).toBe('a1')
    expect(sortedList[2].text).toBe('a2')
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

describe('Removes an address from a list of addresses ', () => {
  const addressToRemove: DeliusAddress = {
    id: 1,
    status: 'Postal',
    buildingName: 'Namy',
    buildingNumber: '23',
    streetName: 'streety',
    townCity: 'towny',
    district: 'district',
    county: 'county',
    postcode: 'NE1 1SA',
  }

  const addressNotInList: DeliusAddress = {
    id: 999,
    status: 'Postal',
    buildingName: 'Namy',
    buildingNumber: '23',
    streetName: 'streety',
    townCity: 'towny',
    district: 'district',
    county: 'county',
    postcode: 'NE1 1SA',
  }

  const testAddressList: DeliusAddress[] = [
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
    {
      id: 3,
      status: 'Reply',
      buildingName: null,
      buildingNumber: null,
      streetName: null,
      townCity: null,
      district: null,
      county: null,
      postcode: null,
    },
  ]

  test('Address should be removed from the list', () => {
    const currentLength = testAddressList.length
    expect(removeDeliusAddressFromDeliusAddressList(testAddressList, addressToRemove).length).toBe(currentLength - 1)
  })

  test('Address should not be removed if it doesnt exist in the list', () => {
    const currentLength = testAddressList.length
    expect(removeDeliusAddressFromDeliusAddressList(testAddressList, addressNotInList).length).toBe(currentLength)
  })
})
