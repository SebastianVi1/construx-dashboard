import { defineMessages } from '../../i18n/defineMessages'

export const rolesMessages = defineMessages({
  en: {
    list: {
      title: 'Roles & permissions',
      description: 'What each role can see and do in this company. Every member holds exactly one role.',
      label: 'Roles',
      loadError: 'We could not load the roles.',
    },
    kind: {
      OWNER: 'Owner',
      BUILT_IN: 'Built-in',
      CUSTOM: 'Custom',
    },
    customized: 'Customized',
    viewOnly: 'View only',
    members: {
      none: 'No members',
      one: '1 member',
      many: '{count} members',
    },
    invitations: {
      one: '1 pending invitation',
      many: '{count} pending invitations',
    },
    role: {
      back: 'Roles & permissions',
      permissions: 'Permissions',
      loadError: 'We could not load this role.',
      notFound: 'This role does not exist in this company. It may have been deleted.',
      catalogError: 'We could not load the list of permissions.',
      empty: 'Members with this role can sign in but see nothing.',
    },
    readOnly: {
      ownerLocked: 'The Owner role is locked: it always holds every permission.',
      ownRole: 'This is your own role, so you cannot change its permissions.',
      aboveCaller: 'This role holds permissions you don’t have, so you cannot change it.',
    },
    scope: {
      none: 'None',
      OWN: 'Own tasks',
      PROJECT: 'Assigned sites',
      ORGANIZATION: 'Whole company',
    },
    retry: 'Try again',
  },
  es: {
    list: {
      title: 'Roles y permisos',
      description: 'Qué puede ver y hacer cada rol en esta empresa. Cada miembro tiene exactamente un rol.',
      label: 'Roles',
      loadError: 'No pudimos cargar los roles.',
    },
    kind: {
      OWNER: 'Propietario',
      BUILT_IN: 'Predefinido',
      CUSTOM: 'Personalizado',
    },
    customized: 'Modificado',
    viewOnly: 'Solo lectura',
    members: {
      none: 'Sin miembros',
      one: '1 miembro',
      many: '{count} miembros',
    },
    invitations: {
      one: '1 invitación pendiente',
      many: '{count} invitaciones pendientes',
    },
    role: {
      back: 'Roles y permisos',
      permissions: 'Permisos',
      loadError: 'No pudimos cargar este rol.',
      notFound: 'Este rol no existe en esta empresa. Puede que lo hayan eliminado.',
      catalogError: 'No pudimos cargar la lista de permisos.',
      empty: 'Los miembros con este rol pueden iniciar sesión, pero no ven nada.',
    },
    readOnly: {
      ownerLocked: 'El rol Propietario está bloqueado: siempre tiene todos los permisos.',
      ownRole: 'Es tu propio rol, así que no puedes cambiar sus permisos.',
      aboveCaller: 'Este rol tiene permisos que tú no tienes, así que no puedes cambiarlo.',
    },
    scope: {
      none: 'Ninguno',
      OWN: 'Sus tareas',
      PROJECT: 'Obras asignadas',
      ORGANIZATION: 'Toda la empresa',
    },
    retry: 'Intentar de nuevo',
  },
})
