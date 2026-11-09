import { defineMessages } from '../../i18n/defineMessages'

export const invitationsMessages = defineMessages({
  en: {
    title: 'Join a company',
    description: 'Accept the invitation you received by email.',
    missingToken: 'This invitation link is incomplete. Open the link from the email again.',
    signedOut:
      'Sign in with the email address the invitation was sent to, or create an account with it. You come back here afterwards to accept.',
    signIn: 'Sign in to accept',
    register: 'Create an account',
    signedInAs: 'You are signed in as {email}. Accepting adds this account to the company that invited you.',
    accept: 'Accept invitation',
    pending: 'Joining…',
    switchAccount: 'Use another account',
    toWorkspace: 'Go to your workspace',
    error: {
      notForYou: 'This invitation is not for this account, or it does not exist. Sign in with the email address it was sent to.',
      unavailable:
        'This invitation was already used, has expired or was revoked, or you are already a member of this company.',
      session: 'Your session has ended. Sign in again to accept.',
      generic: 'We could not accept the invitation. Try again.',
    },
  },
  es: {
    title: 'Unirte a una empresa',
    description: 'Acepta la invitación que recibiste por correo.',
    missingToken: 'Este enlace de invitación está incompleto. Abre de nuevo el enlace del correo.',
    signedOut:
      'Inicia sesión con el correo al que llegó la invitación o crea una cuenta con él. Después vuelves aquí para aceptarla.',
    signIn: 'Iniciar sesión para aceptar',
    register: 'Crear una cuenta',
    signedInAs: 'Iniciaste sesión como {email}. Al aceptar, esta cuenta se une a la empresa que te invitó.',
    accept: 'Aceptar invitación',
    pending: 'Uniéndote…',
    switchAccount: 'Usar otra cuenta',
    toWorkspace: 'Ir a tu espacio de trabajo',
    error: {
      notForYou: 'Esta invitación no es para esta cuenta o no existe. Inicia sesión con el correo al que fue enviada.',
      unavailable:
        'Esta invitación ya se usó, venció o fue revocada, o ya eres miembro de esta empresa.',
      session: 'Tu sesión terminó. Inicia sesión de nuevo para aceptar.',
      generic: 'No pudimos aceptar la invitación. Inténtalo de nuevo.',
    },
  },
})
