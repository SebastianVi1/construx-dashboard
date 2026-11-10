import { defineMessages } from '../defineMessages'

export const commonMessages = defineMessages({
  en: {
    language: 'Language',
    theme: 'Theme',
    themeLight: 'Light',
    themeDark: 'Dark',
    currency: 'Currency',
    rateNote: '1 USD = ${rate} MXN · {date}',
    rateUnavailable: 'Exchange rate unavailable; showing MXN.',
  },
  es: {
    language: 'Idioma',
    theme: 'Tema',
    themeLight: 'Claro',
    themeDark: 'Oscuro',
    currency: 'Moneda',
    rateNote: '1 USD = ${rate} MXN · {date}',
    rateUnavailable: 'Tipo de cambio no disponible; se muestra en MXN.',
  },
})
