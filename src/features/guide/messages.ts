import { defineMessages } from '../../i18n/defineMessages'

/**
 * Getting-started guide copy. Section titles live under `sections` and step
 * texts under `steps`, keyed by the `titleKey` / `textKey` of their entries in
 * `catalog.ts`: a new section or step adds its keys here in both languages.
 */
export const guideMessages = defineMessages({
  en: {
    title: 'Getting started',
    description: 'Each step ticks itself off when you do it in Construx.',
    progress: '{done} of {total} done',
    count: '{done}/{total}',
    navEntry: 'Guide',
    launcher: 'Getting started',
    launcherLabel: 'Open the getting-started guide, {done} of {total} done',
    close: 'Close the guide',
    skip: 'Skip',
    skipLabel: 'Skip “{step}”',
    done: 'Done',
    skipped: 'Skipped',
    hide: 'Hide guide',
    hideHint: 'Open it again any time from Guide.',
    show: 'Show the guide button',
    learnMore: 'Learn more',
    learnMoreLabel: 'about “{step}” (opens in a new tab)',
    landingEntryLabel: '(opens the Construx guide in a new tab)',
    complete: {
      title: "You're set up",
      body: 'Every step is done. Guide keeps this list for later.',
    },
    sections: {
      runCompany: 'Run your company',
    },
    steps: {
      createSite: {
        title: 'Create your first site',
        body: 'A site holds its team, phases, tasks and budget. Everything else starts here.',
      },
      siteDetails: {
        title: "Complete the site's details",
        body: 'Add its address, dates and status. Reports and Finance rely on them.',
      },
      inviteMember: {
        title: 'Invite a teammate',
        body: 'Send an invitation by email with a role. The role decides what they can do in your company.',
      },
      siteTeam: {
        title: "Add someone to the site's team",
        body: "Joining the company doesn't put someone on a site. Add them to its team so they can work there.",
      },
      createPhase: {
        title: 'Create a phase',
        body: "A phase is a stage of the site's work with its own dates, such as Foundations or Finishes.",
      },
      assignTask: {
        title: 'Create a task and assign it',
        body: 'Add a task to a phase and choose who does it. The first person you add leads it.',
      },
    },
    showMe: 'Show me',
    showMeLabel: 'Show me how: “{step}”',
    needsSite: 'Open a site first, then choose Show me again.',
    onPage: "You're on the right page. Do this step here.",
    targetMissing: "Construx couldn't find it on this page. It may still be loading, or your role may not include it.",
    help: 'Show how this page works',
    tour: {
      next: 'Next',
      previous: 'Back',
      done: 'Got it',
      close: 'Close the tour',
      progress: '{{current}} of {{total}}',
    },
    /** Popover text for one `data-tour` target; without an entry the step's own text shows. */
    targets: {
      'site-create': {
        title: 'Add your site here',
        body: 'Give it a name and save. The address, dates and status can wait.',
      },
      'site-details-form': {
        title: 'Fill in the details',
        body: 'Set the address, start and end dates and status, then choose Save changes.',
      },
      'member-invite': {
        title: 'Invite by email',
        body: 'Enter their email, pick a role and choose Send invitation. They get a link to join.',
      },
      'site-team': {
        title: "The site's team",
        body: 'Choose a company member under Add a person, then Add to site. Only people on the team can be given tasks here.',
      },
      'phase-create': {
        title: 'Add a phase',
        body: 'Give it a name and its start and due dates, then save.',
      },
      'task-create': {
        title: 'Add a task to a phase',
        body: 'Choose Add task on a phase, then add at least one person to its team before saving.',
      },
    },
  },
  es: {
    title: 'Primeros pasos',
    description: 'Cada paso se marca solo cuando lo haces en Construx.',
    progress: '{done} de {total} hechos',
    count: '{done}/{total}',
    navEntry: 'Guía',
    launcher: 'Primeros pasos',
    launcherLabel: 'Abrir la guía de primeros pasos, {done} de {total} hechos',
    close: 'Cerrar la guía',
    skip: 'Omitir',
    skipLabel: 'Omitir «{step}»',
    done: 'Hecho',
    skipped: 'Omitido',
    hide: 'Ocultar guía',
    hideHint: 'Vuelve a abrirla cuando quieras desde Guía.',
    show: 'Mostrar el botón de la guía',
    learnMore: 'Más información',
    learnMoreLabel: 'sobre «{step}» (se abre en una pestaña nueva)',
    landingEntryLabel: '(abre la guía de Construx en una pestaña nueva)',
    complete: {
      title: 'Todo listo',
      body: 'Terminaste todos los pasos. Guía conserva esta lista para después.',
    },
    sections: {
      runCompany: 'Dirige tu empresa',
    },
    steps: {
      createSite: {
        title: 'Crea tu primera obra',
        body: 'Una obra reúne su equipo, fases, tareas y presupuesto. Todo lo demás empieza aquí.',
      },
      siteDetails: {
        title: 'Completa los datos de la obra',
        body: 'Agrega su dirección, fechas y estado. Los reportes y Finanzas dependen de ellos.',
      },
      inviteMember: {
        title: 'Invita a un compañero',
        body: 'Envía una invitación por correo con un rol. El rol define lo que puede hacer en tu empresa.',
      },
      siteTeam: {
        title: 'Agrega a alguien al equipo de la obra',
        body: 'Unirse a la empresa no pone a nadie en una obra. Agrégalo a su equipo para que pueda trabajar ahí.',
      },
      createPhase: {
        title: 'Crea una fase',
        body: 'Una fase es una etapa del trabajo de la obra con sus propias fechas, como Cimentación o Acabados.',
      },
      assignTask: {
        title: 'Crea una tarea y asígnala',
        body: 'Agrega una tarea a una fase y elige quién la hace. La primera persona que agregues la dirige.',
      },
    },
    showMe: 'Muéstrame',
    showMeLabel: 'Muéstrame cómo: «{step}»',
    needsSite: 'Abre una obra primero y vuelve a elegir Muéstrame.',
    onPage: 'Ya estás en la página correcta. Haz este paso aquí.',
    targetMissing: 'Construx no lo encontró en esta página. Puede que siga cargando o que tu rol no lo incluya.',
    help: 'Ver cómo funciona esta página',
    tour: {
      next: 'Siguiente',
      previous: 'Atrás',
      done: 'Entendido',
      close: 'Cerrar el recorrido',
      progress: '{{current}} de {{total}}',
    },
    targets: {
      'site-create': {
        title: 'Agrega tu obra aquí',
        body: 'Ponle nombre y guarda. La dirección, las fechas y el estado pueden esperar.',
      },
      'site-details-form': {
        title: 'Completa los datos',
        body: 'Pon la dirección, las fechas de inicio y fin y el estado, y elige Guardar cambios.',
      },
      'member-invite': {
        title: 'Invita por correo',
        body: 'Escribe su correo, elige un rol y elige Enviar invitación. Recibirá un enlace para unirse.',
      },
      'site-team': {
        title: 'El equipo de la obra',
        body: 'Elige a un miembro de la empresa en Agregar una persona y luego Agregar a la obra. Solo el equipo puede recibir tareas aquí.',
      },
      'phase-create': {
        title: 'Agrega una fase',
        body: 'Ponle nombre y sus fechas de inicio y fin, y guarda.',
      },
      'task-create': {
        title: 'Agrega una tarea a una fase',
        body: 'Elige Agregar tarea en una fase y agrega al menos una persona a su equipo antes de guardar.',
      },
    },
  },
})
