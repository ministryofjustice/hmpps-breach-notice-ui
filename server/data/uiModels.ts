export interface SelectItem {
  value: string | null
  text: string | null
  selected: boolean
}

export interface RadioButton {
  value: string
  text: string
  checked: boolean
}

export interface ErrorMessages {
  [key: string]: { text: string }
}
