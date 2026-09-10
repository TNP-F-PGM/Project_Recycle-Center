import { useMemo, useState } from 'react'
import { Grid2x2, Layers, Warehouse as WarehouseIcon } from 'lucide-react'
import { Empty, ErrorBox, Loading, PageIntro, RefreshButton, Status } from '../../components/ui'
import { roles } from '../../context/AppContext'
import { useApiList } from '../../hooks/useApiList'
import type { StorageZone, Warehouse } from '../../types'
import { number } from '../../utils/format'
import { capacityPercent } from '../../utils/operations'

type GroupMode = 'grade' | 'all'

export function WarehouseInventoryZones() {
  const warehouses = useApiList<Warehouse>('/warehouses')
  const zones = useApiList<StorageZone>('/storage-zones')
  const [warehouseFilter, setWarehouseFilter] = useState('all')
  const [groupMode, setGroupMode] = useState<GroupMode>('grade')

  const refresh = () => Promise.all([warehouses.refresh(), zones.refresh()])
  const filteredZones = useMemo(
    () => zones.data.filter((zone) => warehouseFilter === 'all' || zone.warehouseID === warehouseFilter),
    [warehouseFilter, zones.data],
  )
  const zonesByGrade = useMemo(
    () => ({
      A: filteredZones.filter((zone) => zone.supportedGrade === 'A'),
      B: filteredZones.filter((zone) => zone.supportedGrade === 'B'),
      C: filteredZones.filter((zone) => zone.supportedGrade === 'C'),
    }),
    [filteredZones],
  )
  const zonesByWarehouse = useMemo(
    () => warehouses.data
      .map((warehouse) => ({ warehouse, rows: filteredZones.filter((zone) => zone.warehouseID === warehouse.warehouseID) }))
      .filter(({ rows }) => rows.length),
    [filteredZones, warehouses.data],
  )

  if (warehouses.loading || zones.loading) return <Loading />

  return (
    <div className="operations-workspace zone-workspace zone-reference-exact warehouse-staff-zone-page">
      <PageIntro
        eyebrow={roles.warehouse.english}
        title="คลังวัสดุ"
        description="ตรวจสอบพื้นที่จัดเก็บ ความจุ และวัสดุประจำโซน"
      >
        <RefreshButton onClick={() => void refresh()} busy={warehouses.refreshing || zones.refreshing} />
      </PageIntro>

      <ErrorBox message={warehouses.error || zones.error} />

      <section className="panel zone-reference-filter-card">
        <div className="zone-reference-filter-left">
          <span>กรองตามคลัง:</span>
          <select value={warehouseFilter} onChange={(event) => setWarehouseFilter(event.target.value)}>
            <option value="all">ทุกคลังสินค้า</option>
            {warehouses.data.map((warehouse) => (
              <option key={warehouse.warehouseID} value={warehouse.warehouseID}>{warehouse.warehouseID}</option>
            ))}
          </select>
        </div>
        <div className="zone-reference-filter-right">
          <span>มุมมองการจัดกลุ่ม:</span>
          <button className={`button small ${groupMode === 'grade' ? 'primary' : 'secondary'}`} onClick={() => setGroupMode('grade')}>
            <Layers size={14} /> ตามเกรดคุณภาพ
          </button>
          <button className={`button small ${groupMode === 'all' ? 'primary' : 'secondary'}`} onClick={() => setGroupMode('all')}>
            <Grid2x2 size={14} /> โซนทั้งหมด
          </button>
        </div>
      </section>

      {!filteredZones.length ? (
        <section className="panel"><Empty title="ไม่พบโซนจัดเก็บในคลังที่เลือก" message="ลองเปลี่ยนตัวกรองคลัง" /></section>
      ) : groupMode === 'grade' ? (
        <div className="zone-reference-groups">
          {(['A', 'B', 'C'] as const).map((grade) => {
            const rows = zonesByGrade[grade]
            if (!rows.length) return null
            return (
              <section className="zone-reference-grade-section" key={grade}>
                <div className="zone-reference-section-heading">
                  <span className={`zone-reference-grade-badge grade-${grade.toLowerCase()}`}>เกรด {grade}</span>
                  <h2>โซนสำหรับวัสดุเกรด {grade}</h2>
                  <span className="zone-reference-count">{rows.length} โซน</span>
                </div>
                <div className="zone-reference-card-grid">{rows.map((zone) => <StaffZoneCard key={zone.zoneID} zone={zone} />)}</div>
              </section>
            )
          })}
        </div>
      ) : (
        <div className="zone-reference-groups">
          {zonesByWarehouse.map(({ warehouse, rows }) => {
            const percent = capacityPercent(warehouse.currentQuantity, warehouse.totalCapacity)
            return (
              <section className="zone-reference-warehouse-section" key={warehouse.warehouseID}>
                <div className="zone-reference-warehouse-heading">
                  <span className="zone-reference-warehouse-icon"><WarehouseIcon size={20} /></span>
                  <div>
                    <h2>คลังสินค้า {warehouse.warehouseID}</h2>
                    <p>ความจุรวม {number(warehouse.totalCapacity)} {warehouse.unit} · ใช้ไปแล้ว {number(warehouse.currentQuantity)} {warehouse.unit} ({number(percent)}%)</p>
                  </div>
                  <span className="zone-reference-count">{rows.length} โซนจัดเก็บ</span>
                </div>
                <div className="zone-reference-card-grid">{rows.map((zone) => <StaffZoneCard key={zone.zoneID} zone={zone} />)}</div>
              </section>
            )
          })}
        </div>
      )}
    </div>
  )
}

function StaffZoneCard({ zone }: { zone: StorageZone }) {
  const percent = capacityPercent(zone.quantityOnHand, zone.capacity)
  const available = Math.max(0, zone.capacity - zone.quantityOnHand)
  const tone = percent >= 85 ? 'danger' : percent >= 65 ? 'warning' : 'safe'
  return (
    <article className="zone-reference-card">
      <div className="zone-reference-card-header">
        <div>
          <h3>{zone.zoneName}</h3>
          <div className="zone-reference-card-meta"><span>{zone.warehouseID}</span><small>{zone.zoneID}</small></div>
        </div>
        <span className={`zone-reference-percent ${tone}`}>{number(percent)}%</span>
      </div>
      <dl className="zone-reference-material-info">
        <div><dt>วัสดุที่จัดเก็บ</dt><dd>{zone.material?.materialName || zone.materialID}{zone.material?.materialName ? <small> ({zone.materialID})</small> : null}</dd></div>
        <div><dt>ประเภทวัสดุ</dt><dd>{zone.material?.materialType?.typeName || `ประเภท ${zone.materialTypeID}`}</dd></div>
      </dl>
      <div className={`zone-reference-progress ${tone}`}><i style={{ width: `${percent}%` }} /></div>
      <div className="zone-reference-capacity-stats">
        <div><p>ความจุรวม</p><strong>{number(zone.capacity)}</strong><small>กก.</small></div>
        <div><p>ใช้ไปแล้ว</p><strong>{number(zone.quantityOnHand)}</strong><small>กก.</small></div>
        <div><p>ว่างคงเหลือ</p><strong>{number(available)}</strong><small>กก.</small></div>
      </div>
      <div className="zone-reference-card-footer">
        <div><span className={`zone-reference-grade-badge grade-${zone.supportedGrade.toLowerCase()}`}>เกรด {zone.supportedGrade}</span><Status value={zone.stockStatus} /></div>
      </div>
    </article>
  )
}
