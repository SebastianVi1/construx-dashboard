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
    preview: {
      note: 'Preview: the guide as a new member sees it. Nothing you do here is saved.',
      empty: 'Your role has no guide steps.',
    },
    sections: {
      runCompany: 'Run your company',
      manageSites: 'Manage your sites',
      finance: 'Finance',
    },
    steps: {
      createSite: {
        title: 'Create your first site',
        body: 'A site holds its team, phases, tasks and budget. Everything else starts here.',
      },
      openSite: {
        title: 'Open your site',
        body: 'Your sites are listed under Sites. Open one to see its details, team, phases and tasks.',
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
      siteBudget: {
        title: 'Set a site budget',
        body: 'Give a site the amount it can spend, so Construx can show what is used and what is left.',
      },
      recordExpense: {
        title: 'Record an expense',
        body: "Add a purchase or payment to a site. It counts against the site's budget right away.",
      },
      viewFinance: {
        title: 'Review company finance',
        body: 'See the budget, spending and balance of every site in one place.',
      },
    },
    /** Shown under an open step that sets `noSiteHint` while the member is on no Site. */
    hints: {
      askAdmin: "Don't see a site? Ask your administrator to add you to one.",
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
      'site-list': {
        title: 'Your sites',
        body: 'Every site you work on is here. Open one to see its work.',
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
      'site-budget-set': {
        title: 'Set the budget here',
        body: 'Type the amount and save. You can change or remove it later.',
      },
      'expense-add': {
        title: 'Add an expense here',
        body: 'Fill in the concept, amount, date and category, then save.',
      },
      'finance-totals': {
        title: 'Company totals',
        body: 'Budget, spending and balance across all your sites.',
      },
      'finance-sites': {
        title: 'Every site at a glance',
        body: 'Each site with its budget, what it spent and whether it is over budget.',
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
    preview: {
      note: 'Vista previa: la guía como la ve un miembro nuevo. Nada de lo que hagas aquí se guarda.',
      empty: 'Tu rol no tiene pasos en la guía.',
    },
    sections: {
      runCompany: 'Dirige tu empresa',
      manageSites: 'Gestiona tus obras',
      finance: 'Finanzas',
    },
    steps: {
      createSite: {
        title: 'Crea tu primera obra',
        body: 'Una obra reúne su equipo, fases, tareas y presupuesto. Todo lo demás empieza aquí.',
      },
      openSite: {
        title: 'Abre tu obra',
        body: 'Tus obras aparecen en Obras. Abre una para ver sus datos, su equipo, sus fases y sus tareas.',
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
      siteBudget: {
        title: 'Asigna el presupuesto de una obra',
        body: 'Indica cuánto puede gastar la obra para que Construx muestre lo usado y lo que queda.',
      },
      recordExpense: {
        title: 'Registra un gasto',
        body: 'Agrega una compra o un pago a una obra. Se descuenta de su presupuesto al momento.',
      },
      viewFinance: {
        title: 'Revisa las finanzas de la empresa',
        body: 'Consulta el presupuesto, el gasto y el saldo de cada obra en un solo lugar.',
      },
    },
    hints: {
      askAdmin: '¿No ves ninguna obra? Pide a tu administrador que te agregue a una.',
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
      'site-list': {
        title: 'Tus obras',
        body: 'Aquí están todas las obras en las que trabajas. Abre una para ver su trabajo.',
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
      'site-budget-set': {
        title: 'Asigna el presupuesto aquí',
        body: 'Escribe el monto y guarda. Puedes cambiarlo o quitarlo después.',
      },
      'expense-add': {
        title: 'Agrega un gasto aquí',
        body: 'Llena el concepto, el monto, la fecha y la categoría, y guarda.',
      },
      'finance-totals': {
        title: 'Totales de la empresa',
        body: 'Presupuesto, gasto y saldo de todas tus obras.',
      },
      'finance-sites': {
        title: 'Cada obra de un vistazo',
        body: 'Cada obra con su presupuesto, lo que gastó y si se pasó del presupuesto.',
      },
    },
  },
})
