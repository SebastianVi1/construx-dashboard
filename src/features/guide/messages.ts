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
      finance: 'Finance',
    },
    steps: {
      createSite: {
        title: 'Create your first site',
        body: 'A site holds its team, phases, tasks and budget. Everything else starts here.',
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
    sections: {
      runCompany: 'Dirige tu empresa',
      finance: 'Finanzas',
    },
    steps: {
      createSite: {
        title: 'Crea tu primera obra',
        body: 'Una obra reúne su equipo, fases, tareas y presupuesto. Todo lo demás empieza aquí.',
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
