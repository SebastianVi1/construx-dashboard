import type { ReactNode } from 'react'
import { useRemoteData } from '../../components/data/useRemoteData'
import { Notice } from '../../components/page'
import { useCurrency } from '../../currency'
import { formatMessage, useLocale, type Messages } from '../../i18n'
import { listStandbyPercentages, type Analysis, type EquipmentDetail, type EquipmentLine, type LaborDetail, type ResourceDetail } from './pricesApi'
import { analysisLineLabel, fractionToPercent } from './pricesView'

type CompositionMessages = Messages['prices']['composition']

/** Opens another Resource in the same drawer. */
type Navigate = (resourceId: string) => void

/** The analysis, wage, machinery and "used in" parts of a Resource's detail; each shows only when it applies. */
export function ResourceComposition({ organizationId, detail, onOpen }: { organizationId: string; detail: ResourceDetail; onOpen: Navigate }) {
  return (
    <>
      {detail.analysis ? <AnalysisSection analysis={detail.analysis} onOpen={onOpen} /> : null}
      {detail.type === 'LABOR' && !detail.isComposite ? <LaborSection labor={detail.laborDetail} /> : null}
      {detail.equipmentDetail ? (
        <EquipmentSection organizationId={organizationId} equipment={detail.equipmentDetail} onOpen={onOpen} />
      ) : null}
      <UsedInSection usedIn={detail.usedIn} onOpen={onOpen} />
    </>
  )
}

function AnalysisSection({ analysis, onOpen }: { analysis: Analysis; onOpen: Navigate }) {
  const { messages: m } = useLocale()
  const { money } = useCurrency()
  const c = m.prices.composition
  return (
    <section aria-label={c.analysisTitle}>
      <h3>{c.analysisTitle}</h3>
      <p className="cell-muted">{c.derivedNote}</p>
      <dl className="prices-fields">
        <div className="prices-fields__row">
          <dt>{c.derivedCost}</dt>
          <dd className="data-mono">
            {money(analysis.derivedCost)}
            {analysis.mismatch ? (
              <span className="badge prices-composition__badge" data-tone="warning" title={c.mismatchHint}>
                {c.mismatch}
              </span>
            ) : null}
          </dd>
        </div>
        {analysis.importedCost ? (
          <div className="prices-fields__row">
            <dt>{c.importedCost}</dt>
            <dd className="data-mono">{money(analysis.importedCost)}</dd>
          </div>
        ) : null}
        <div className="prices-fields__row">
          <dt>{c.laborSubtotal}</dt>
          <dd className="data-mono">{money(analysis.laborSubtotal)}</dd>
        </div>
      </dl>
      {analysis.mismatch ? <p className="cell-muted">{c.mismatchHint}</p> : null}
      {analysis.incomplete ? <Notice>{c.incomplete}</Notice> : null}
      {analysis.lines.length === 0 ? (
        <p className="cell-muted">{c.noLines}</p>
      ) : (
        <div className="table-scroll">
          <table className="data-table data-table--compact">
            <thead>
              <tr>
                <th scope="col">{c.column.lineNo}</th>
                <th scope="col">{c.column.component}</th>
                <th scope="col">{c.column.unit}</th>
                <th scope="col" className="prices-table__number">
                  {c.column.quantity}
                </th>
                <th scope="col" className="prices-table__number">
                  {c.column.cost}
                </th>
                <th scope="col" className="prices-table__number">
                  {c.column.amount}
                </th>
              </tr>
            </thead>
            <tbody>
              {analysis.lines.map((line) => {
                const label = analysisLineLabel(line)
                return (
                  <tr key={line.lineNo}>
                    <td className="data-mono">{line.lineNo}</td>
                    <td>
                      <button
                        type="button"
                        className="table-link data-mono"
                        aria-label={formatMessage(c.open, { code: line.component.code })}
                        onClick={() => onOpen(line.component.id)}
                      >
                        {line.component.code}
                      </button>{' '}
                      {line.component.name}
                      <span className="cell-muted"> · {m.prices.type[line.component.type]}</span>
                    </td>
                    <td className="data-mono">{line.component.unitCode}</td>
                    <td className="data-mono prices-table__number" title={label.kind === 'output' ? c.outputHint : undefined}>
                      {formatMessage(c[label.kind], { value: label.value })}
                    </td>
                    <td className="data-mono prices-table__number">
                      {line.component.currentCost === null ? <span className="cell-muted">{m.prices.noCost}</span> : money(line.component.currentCost)}
                    </td>
                    <td className="data-mono prices-table__number">{money(line.amount)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

function LaborSection({ labor }: { labor: LaborDetail | null }) {
  const { messages: m } = useLocale()
  const { money } = useCurrency()
  const c = m.prices.composition
  const none = <span className="cell-muted">{m.prices.detail.none}</span>
  if (!labor) {
    return (
      <section aria-label={c.laborTitle}>
        <h3>{c.laborTitle}</h3>
        <p className="cell-muted">{c.noLaborDetail}</p>
      </section>
    )
  }
  const rows: [string, ReactNode][] = [
    [c.nominalWage, money(labor.nominalWage)],
    [c.fsr, labor.fsr],
    [c.fsrSource, c.fsrSourceValue[labor.fsrSource]],
    [c.fsbc, labor.fsbc ?? none],
    [c.sbc, labor.sbc ? money(labor.sbc) : none],
    [c.perDiem, money(labor.perDiem)],
    [c.mealsLodging, money(labor.mealsLodging)],
    [c.funeralExpenses, money(labor.funeralExpenses)],
    [c.otherBenefits, money(labor.otherBenefits)],
    [c.realWage, labor.realWage ? <strong>{money(labor.realWage)}</strong> : none],
  ]
  if (labor.fasarType !== null) rows.push([c.fasarType, String(labor.fasarType)])
  if (labor.imported.fsr) rows.push([c.importedFsr, labor.imported.fsr])
  if (labor.imported.realWage) rows.push([c.importedRealWage, money(labor.imported.realWage)])
  return (
    <section aria-label={c.laborTitle}>
      <h3>{c.laborTitle}</h3>
      <FieldList rows={rows} />
      <p className="cell-muted">{c.realWageNote}</p>
      {labor.fsrMismatch ? <Notice>{c.fsrMismatch}</Notice> : null}
    </section>
  )
}

/** Fractions stored as `0.12` read as percentages. */
const percentFields = new Set<keyof EquipmentDetail>(['salvagePct', 'insurancePct', 'interestRate'])

const equipmentFields = [
  'brand',
  'model',
  'serialNumber',
  'capacity',
  'location',
  'owner',
  'availability',
  'usefulLife',
  'commercialValue',
  'powerUnit',
  'power',
  'economicLifeHours',
  'hoursPerYear',
  'tiresLifeHours',
  'specialPartsLifeHours',
  'oilChangeHours',
  'calculationType',
  'operationFactor',
  'fuelType',
  'fuelFactor',
  'fuelQtyPerHour',
  'lubricantFactor',
  'lubricantQtyPerHour',
  'otherEnergyFactor',
  'crankcaseCapacity',
  'salvagePct',
  'insurancePct',
  'maintenanceFactor',
  'interestRate',
  'fixedChargeCode',
  'acquisitionValueCode',
  'standbyCode',
  'reserveCode',
  'tiresCode',
  'specialPartsCode',
  'fuelCode',
  'lubricantCode',
  'otherEnergyCode',
] as const satisfies readonly (keyof CompositionMessages['equipment'] & keyof EquipmentDetail)[]

function EquipmentSection({ organizationId, equipment, onOpen }: { organizationId: string; equipment: EquipmentDetail; onOpen: Navigate }) {
  const { messages: m } = useLocale()
  const { money } = useCurrency()
  const c = m.prices.composition
  const rows: [string, ReactNode][] = []
  for (const field of equipmentFields) {
    const value = equipment[field]
    if (value === null) continue
    const shown =
      field === 'commercialValue'
        ? money(String(value))
        : percentFields.has(field)
          ? `${fractionToPercent(String(value))} %`
          : String(value)
    rows.push([c.equipment[field], shown])
  }
  return (
    <section aria-label={c.equipmentTitle}>
      <h3>{c.equipmentTitle}</h3>
      <Notice>{c.equipmentNotice}</Notice>
      <FieldList rows={rows} />
      <EquipmentLines title={c.operationLines} lines={equipment.operationLines} onOpen={onOpen} c={c} />
      <EquipmentLines title={c.consumptionLines} lines={equipment.consumptionLines} onOpen={onOpen} c={c} />
      <StandbyPercentages organizationId={organizationId} c={c} />
    </section>
  )
}

function EquipmentLines({ title, lines, onOpen, c }: { title: string; lines: EquipmentLine[]; onOpen: Navigate; c: CompositionMessages }) {
  const { messages: m } = useLocale()
  return (
    <>
      <h4>{title}</h4>
      {lines.length === 0 ? (
        <p className="cell-muted">{c.noEquipmentLines}</p>
      ) : (
        <div className="table-scroll">
          <table className="data-table data-table--compact">
            <thead>
              <tr>
                <th scope="col">{c.column.component}</th>
                <th scope="col">{c.column.unit}</th>
                <th scope="col" className="prices-table__number">
                  {c.column.quantity}
                </th>
              </tr>
            </thead>
            <tbody>
              {lines.map((line) => (
                <tr key={`${line.lineNo}-${line.component.id}`}>
                  <td>
                    <button
                      type="button"
                      className="table-link data-mono"
                      aria-label={formatMessage(c.open, { code: line.component.code })}
                      onClick={() => onOpen(line.component.id)}
                    >
                      {line.component.code}
                    </button>{' '}
                    {line.component.name}
                    <span className="cell-muted"> · {m.prices.type[line.component.type]}</span>
                  </td>
                  <td className="data-mono">{line.component.unit.code}</td>
                  <td className="data-mono prices-table__number">
                    {formatMessage(line.operator === '/' ? c.output : c.consumption, { value: line.quantity })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}

function StandbyPercentages({ organizationId, c }: { organizationId: string; c: CompositionMessages }) {
  const standby = useRemoteData(`${organizationId}:equipment-standby-percentages`, () => listStandbyPercentages(organizationId))
  if (!standby.data) return null
  return (
    <>
      <h4>{c.standbyTitle}</h4>
      {standby.data.length === 0 ? (
        <p className="cell-muted">{c.standbyEmpty}</p>
      ) : (
        <div className="table-scroll">
          <table className="data-table data-table--compact">
            <thead>
              <tr>
                <th scope="col">{c.charge}</th>
                <th scope="col" className="prices-table__number">
                  {c.standby}
                </th>
                <th scope="col" className="prices-table__number">
                  {c.reserve}
                </th>
              </tr>
            </thead>
            <tbody>
              {standby.data.map((row) => (
                <tr key={row.charge}>
                  <td>{row.charge}</td>
                  <td className="data-mono prices-table__number">{fractionToPercent(row.standbyPct)} %</td>
                  <td className="data-mono prices-table__number">{fractionToPercent(row.reservePct)} %</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}

function UsedInSection({ usedIn, onOpen }: { usedIn: ResourceDetail['usedIn']; onOpen: Navigate }) {
  const { messages: m } = useLocale()
  const c = m.prices.composition
  return (
    <section aria-label={c.usedInTitle}>
      <h3>{c.usedInTitle}</h3>
      {usedIn.count === 0 ? (
        <p className="cell-muted">{c.usedInNone}</p>
      ) : (
        <>
          <p className="cell-muted">
            {formatMessage(c.usedInCount, { count: usedIn.count })}
            {usedIn.count > usedIn.sample.length ? ` ${formatMessage(c.usedInSample, { count: usedIn.sample.length })}` : ''}
          </p>
          <ul className="prices-used-in">
            {usedIn.sample.map((parent) => (
              <li key={parent.id}>
                <button
                  type="button"
                  className="table-link data-mono"
                  aria-label={formatMessage(c.open, { code: parent.code })}
                  onClick={() => onOpen(parent.id)}
                >
                  {parent.code}
                </button>{' '}
                {parent.name}
                <span className="cell-muted"> · {m.prices.type[parent.type]}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  )
}

function FieldList({ rows }: { rows: [string, ReactNode][] }) {
  return (
    <dl className="prices-fields">
      {rows.map(([label, value]) => (
        <div key={label} className="prices-fields__row">
          <dt>{label}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  )
}
