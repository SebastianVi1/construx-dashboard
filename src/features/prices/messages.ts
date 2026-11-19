import { defineMessages } from '../../i18n/defineMessages'

export const pricesMessages = defineMessages({
  en: {
    title: 'Prices',
    description: 'Cost catalog for your company.',
    placeholder: 'This catalog is not available yet.',
    tabsLabel: 'Catalog sections',
    tab: { materials: 'Materials', labor: 'Labor', equipment: 'Equipment', workItems: 'Work items', suppliers: 'Suppliers', import: 'Import' },
    filters: {
      label: 'Filter resources', search: 'Search', searchPlaceholder: 'Code, name or description',
      family: 'Family', unit: 'Unit', supplier: 'Supplier', any: 'Any',
      discontinued: 'Discontinued', showAll: 'Show all', archived: 'Archived',
      includeArchived: 'Include archived', clear: 'Clear filters',
    },
    column: { code: 'Code', name: 'Name', unit: 'Unit', family: 'Family', supplier: 'Supplier', currentCost: 'Cost', costUpdatedAt: 'Cost updated' },
  },
  es: {
    title: 'Precios',
    description: 'Catálogo de costos de tu empresa.',
    placeholder: 'Este catálogo aún no está disponible.',
    tabsLabel: 'Secciones del catálogo',
    tab: { materials: 'Insumos', labor: 'Mano de obra', equipment: 'Maquinaria', workItems: 'Conceptos', suppliers: 'Proveedores', import: 'Importar' },
    filters: {
      label: 'Filtrar insumos', search: 'Buscar', searchPlaceholder: 'Clave, nombre o descripción',
      family: 'Familia', unit: 'Unidad', supplier: 'Proveedor', any: 'Cualquiera',
      discontinued: 'Descontinuados', showAll: 'Mostrar todos', archived: 'Archivados',
      includeArchived: 'Incluir archivados', clear: 'Quitar filtros',
    },
    column: { code: 'Clave', name: 'Nombre', unit: 'Unidad', family: 'Familia', supplier: 'Proveedor', currentCost: 'Costo', costUpdatedAt: 'Costo actualizado' },
  },
})
