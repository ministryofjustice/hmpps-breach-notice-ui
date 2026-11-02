export interface SelectItem {
  value: string | null
  text: string | null
  selected: boolean | string
}

export interface RadioButton {
  value: string
  text: string
  checked: boolean | string
}

export interface ErrorMessages {
  [key: string]: { text: string }
}
