import { MONEY_DIGITS, TEXT_LIMITS, type FieldConfig } from '../../components/form'
import type { Currency } from '../../currency'
import { formatMessage } from '../../i18n'
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
    {
      name: 'name',
      label: t.field.name,
      placeholder: t.field.namePlaceholder,
      autoComplete: 'off',
      maxLength: TEXT_LIMITS.materialName,
    },
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
    {
      name: 'brand',
      label: t.field.brand,
      placeholder: t.field.brandPlaceholder,
      autoComplete: 'off',
      maxLength: TEXT_LIMITS.brand,
    },
  ]
}

type PriceFieldOptions = {
  /** Materials to pick from; omitted when the dialog is opened for one material. */
  materials?: Material[]
  suppliers: Supplier[]
  /** Show the inline "new supplier" fields. */
  newSupplier: boolean
  /** The currency prices are typed in. */
  currency: Currency
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
      {
        name: 'supplierName',
        label: t.field.supplierName,
        placeholder: t.field.supplierNamePlaceholder,
        autoComplete: 'off',
        maxLength: TEXT_LIMITS.supplierName,
      },
      {
        name: 'supplierBranch',
        label: t.field.supplierBranch,
        placeholder: t.field.supplierBranchPlaceholder,
        autoComplete: 'off',
        maxLength: TEXT_LIMITS.supplierBranch,
      },
      {
        name: 'supplierWebsite',
        label: t.field.supplierWebsite,
        type: 'url',
        placeholder: t.field.supplierWebsitePlaceholder,
        autoComplete: 'url',
        inputMode: 'url',
        maxLength: TEXT_LIMITS.supplierWebsite,
      },
    )
  }
  fields.push(
    {
      name: 'price',
      label: formatMessage(t.field.price, { currency: options.currency }),
      type: 'money',
      maxDigits: MONEY_DIGITS.price,
      placeholder: t.field.pricePlaceholder,
    },
    { name: 'observedOn', label: t.field.observedOn, type: 'date' },
    { name: 'sku', label: t.field.sku, placeholder: t.field.skuPlaceholder, autoComplete: 'off', maxLength: TEXT_LIMITS.sku },
  )
  return fields
}

/** Load failures reuse the shared load messages. */
export function loadKind(kind: string): 'forbidden' | 'notFound' | 'session' | 'generic' {
  if (kind === 'forbidden' || kind === 'notFound' || kind === 'session') return kind
  return 'generic'
}
