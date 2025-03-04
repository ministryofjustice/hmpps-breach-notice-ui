import { DateTimeFormatter } from '@js-joda/core'

export function fromUserDate(str: string): string {
  if (str) {
    return DateTimeFormatter.ISO_LOCAL_DATE.format(DateTimeFormatter.ofPattern('d/M/yyyy').parse(str))
  }
  return ''
}

export function toUserDate(str: string): string {
  if (str) {
    const timeStrippedString = str.includes('T') ? str.split('T')[0] : str
    return DateTimeFormatter.ofPattern('d/M/yyyy').format(DateTimeFormatter.ISO_LOCAL_DATE.parse(timeStrippedString))
  }
  return ''
}

export function toUserTime(str: string): string {
  if (str) {
    return DateTimeFormatter.ofPattern('HH:mm').format(DateTimeFormatter.ISO_LOCAL_DATE_TIME.parse(str))
  }
  return ''
}

export function toUserTimeFromDateTime(str: string): string {
  if (str) {
    return DateTimeFormatter.ofPattern('HH:mm').format(DateTimeFormatter.ISO_LOCAL_DATE_TIME.parse(str))
  }
  return ''
}

export function toUserDateFromDateTime(str: string): string {
  if (str) {
    return DateTimeFormatter.ofPattern('d/M/yyyy').format(DateTimeFormatter.ISO_LOCAL_DATE_TIME.parse(str))
  }
  return ''
}
