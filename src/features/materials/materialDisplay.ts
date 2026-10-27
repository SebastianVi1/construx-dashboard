import type { FieldConfig } from '../../components/form'
import type { Messages } from '../../i18n'
import { NEW_SUPPLIER } from './materialForm'
import { materialCategories, materialUnits, type Material, type Supplier } from './pricingApi'

type MaterialsMessages = Messages['materials']

/** "Home Depot · Periférico Sur", or the name alone. */
export function supplierLabel(supplier: { name: string; branch: string | null }): string {
  return supplier.branch ? `${supplier.name} · ${supplier.branch}` : supplier.name
}

/** "Cemento gris · Cemex (bag)" for pickers. */
export function materialLabel(material: Pick<Material, 'name' | 'brand' | 'unit'>, t: MaterialsMessages): string {
  const name = material.brand ? `${material.name} · ${material.brand}` : material.name
  return `${name} (${t.unit[material.unit]})`
}

export function materialFields(t: MaterialsMessages): FieldConfig[] {
  return [
    { name: 'name', label: t.field.name, placeholder: t.field.namePlaceholder, autoComplete: 'off' },
    {
      name: 'unit',
      label: t.field.unit,
      type: 'select',
      options: [{ value: '', label: t.field.unitPlaceholder }, ...materialUnits.map((unit) => ({ value: unit, label: t.unit[unit] }))],
    },
    {
      name: 'category',
      label: t.field.category,
      type: 'select',
      options: [
        { value: '', label: t.field.categoryPlaceholder },
        ...materialCategories.map((category) => ({ value: category, label: t.category[category] })),
      ],
    },
    { name: 'brand', label: t.field.brand, placeholder: t.field.brandPlaceholder, autoComplete: 'off' },
  ]
}

type PriceFieldOptions = {
  /** Materials to pick from; omitted when the dialog is opened for one material. */
  materials?: Material[]
  suppliers: Supplier[]
  /** Show the inline "new supplier" fields. */
  newSupplier: boolean
}

/** Record-price fields; the new supplier's fields appear right under the picker when chosen. */
export function priceFields(t: MaterialsMessages, options: PriceFieldOptions): FieldConfig[] {
  const fields: FieldConfig[] = []
  if (options.materials) {
    fields.push({
      name: 'materialId',
      label: t.field.material,
      type: 'select',
      options: [
        { value: '', label: t.field.materialPlaceholder },
        ...options.materials.map((material) => ({ value: material.id, label: materialLabel(material, t) })),
      ],
    })
  }
  fields.push({
    name: 'supplierId',
    label: t.field.supplier,
    type: 'select',
    options: [
      { value: '', label: t.field.supplierPlaceholder },
      ...options.suppliers.map((supplier) => ({ value: supplier.id, label: supplierLabel(supplier) })),
      { value: NEW_SUPPLIER, label: t.field.newSupplier },
    ],
  })
  if (options.newSupplier) {
    fields.push(
      { name: 'supplierName', label: t.field.supplierName, placeholder: t.field.supplierNamePlaceholder, autoComplete: 'off' },
      { name: 'supplierBranch', label: t.field.supplierBranch, placeholder: t.field.supplierBranchPlaceholder, autoComplete: 'off' },
      {
        name: 'supplierWebsite',
        label: t.field.supplierWebsite,
        type: 'url',
        placeholder: t.field.supplierWebsitePlaceholder,
        autoComplete: 'url',
        inputMode: 'url',
      },
    )
  }
  fields.push(
    { name: 'price', label: t.field.price, placeholder: t.field.pricePlaceholder, autoComplete: 'off' },
    { name: 'observedOn', label: t.field.observedOn, type: 'date' },
    { name: 'sku', label: t.field.sku, placeholder: t.field.skuPlaceholder, autoComplete: 'off' },
  )
  return fields
}

/** Load failures reuse the shared load messages. */
export function loadKind(kind: string): 'forbidden' | 'notFound' | 'session' | 'generic' {
  if (kind === 'forbidden' || kind === 'notFound' || kind === 'session') return kind
  return 'generic'
}
