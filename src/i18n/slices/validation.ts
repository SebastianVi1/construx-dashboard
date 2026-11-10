import { defineMessages } from '../defineMessages'

export const validationMessages = defineMessages({
  en: {
    nameRequired: 'Enter your name',
    nameMax: 'Use at most 80 characters',
    emailRequired: 'Enter your email address',
    emailInvalid: 'Enter a valid email address',
    passwordRequired: 'Enter your password',
    passwordMin: 'Use at least 12 characters',
    passwordMax: 'Use at most 72 characters',
    passwordMismatch: 'The passwords do not match',
  },
  es: {
    nameRequired: 'Ingresa tu nombre',
    nameMax: 'Usa como máximo 80 caracteres',
    emailRequired: 'Ingresa tu correo electrónico',
    emailInvalid: 'Ingresa un correo electrónico válido',
    passwordRequired: 'Ingresa tu contraseña',
    passwordMin: 'Usa al menos 12 caracteres',
    passwordMax: 'Usa como máximo 72 caracteres',
    passwordMismatch: 'Las contraseñas no coinciden',
  },
})
