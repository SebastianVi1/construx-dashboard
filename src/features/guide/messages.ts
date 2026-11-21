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
    },
  },
})
