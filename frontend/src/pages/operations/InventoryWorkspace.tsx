import { useMemo, useRef, useState, type FormEvent } from 'react'
import { AlertTriangle, Boxes, MapPinned, Plus, Search, Warehouse as WarehouseIcon } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Empty, ErrorBox, Loading, Modal, PageIntro, RefreshButton, Status } from '../../components/ui'
import { roles, useApp } from '../../context/AppContext'
import { useApiList } from '../../hooks/useApiList'
import { errorText } from '../../services/api'
import { operationsApi } from '../../services/operationsApi'
import type { InventoryMaterial, StorageZone, Warehouse } from '../../types'
import { number } from '../../utils/format'
import { capacityPercent } from '../../utils/operations'

const MATERIAL_PAGE_SIZE = 10

export function InventoryWorkspace({ materialSearch = false }: { materialSearch?: boolean } = {}) {
  const { workspace, notify } = useApp()
  const warehouses = useApiList<Warehouse>('/warehouses')
  const zones = useApiList<StorageZone>('/storage-zones')
  const materials = useApiList<InventoryMaterial>('/inventory/materials?include=stock')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [showCreate, setShowCreate] = useState<'warehouse' | 'zone' | ''>('')
  const [query, setQuery] = useState('')
  const [typeFilter, setTypeFilter] = useState('all')
  const [gradeFilter, setGradeFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [materialPage, setMaterialPage] = useState(1)
  const [showMinimumManager, setShowMinimumManager] = useState(false)
  const [minimumScope, setMinimumScope] = useState<'unset' | 'all'>('unset')
  const [minimumQuery, setMinimumQuery] = useState('')
  const [pendingMinimumCount, setPendingMinimumCount] = useState(0)
  const [lowOnly, setLowOnly] = useState(false)
  const warehouseRequestID = useRef(crypto.randomUUID())
  const zoneRequestID = useRef(crypto.randomUUID())
  const canManage = workspace?.role === 'warehouse_manager'
  const refresh = () => Promise.all([warehouses.refresh(), zones.refresh(), materials.refresh()])
  const totalCapacity = warehouses.data.reduce((sum, row) => sum + row.totalCapacity, 0)
  const totalStock = warehouses.data.reduce((sum, row) => sum + row.currentQuantity, 0)
  const grouped = useMemo(
    () =>
      warehouses.data.map((warehouse) => ({
        warehouse,
        zones: zones.data.filter((zone) => zone.warehouseID === warehouse.warehouseID),
      })),
    [warehouses.data, zones.data],
  )
  const visibleMaterials = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase('th')
    return materials.data.filter((material) => {
      if (lowOnly && !material.belowMin) return false
      if (typeFilter !== 'all' && String(material.materialTypeID) !== typeFilter) return false
      if (gradeFilter !== 'all' && material.grade !== gradeFilter) return false
      if (statusFilter === 'below' && !material.belowMin) return false
      if (statusFilter === 'normal' && (material.belowMin || !material.minimumStockConfigured)) return false
      if (statusFilter === 'unset' && material.minimumStockConfigured) return false
      return !needle || [material.materialID, material.materialName, material.materialType?.typeName, material.grade].filter(Boolean).join(' ').toLocaleLowerCase('th').includes(needle)
    })
  }, [gradeFilter, lowOnly, materials.data, query, statusFilter, typeFilter])

  const materialPageCount = Math.max(1, Math.ceil(visibleMaterials.length / MATERIAL_PAGE_SIZE))
  const paginatedMaterials = visibleMaterials.slice((materialPage - 1) * MATERIAL_PAGE_SIZE, materialPage * MATERIAL_PAGE_SIZE)

  const materialTypes = useMemo(() => {
    const byID = new Map<string, string>()
    materials.data.forEach((material) => {
      byID.set(String(material.materialTypeID), material.materialType?.typeName || String(material.materialTypeID))
    })
    return [...byID.entries()]
  }, [materials.data])
  const minimumMaterials = useMemo(() => {
    const byID = new Map<string, InventoryMaterial>()
    materials.data.forEach((material) => {
      if (!byID.has(material.materialID)) byID.set(material.materialID, material)
    })
    return [...byID.values()]
  }, [materials.data])
  const missingMinimum = minimumMaterials.filter((material) => !material.minimumStockConfigured)
  const minimumNeedle = minimumQuery.trim().toLocaleLowerCase('th')
  const shownMinimumMaterials = minimumMaterials.filter((material) => {
    if (minimumScope === 'unset' && material.minimumStockConfigured) return false
    return !minimumNeedle || [material.materialID, material.materialName, material.materialType?.typeName]
      .filter(Boolean)
      .join(' ')
      .toLocaleLowerCase('th')
      .includes(minimumNeedle)
  })

  async function createWarehouse(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const target = event.currentTarget
    const form = new FormData(target)
    setBusy(true)
    setError('')
    try {
      await operationsApi.createWarehouse({
        totalCapacity: Number(form.get('capacity')),
        minStock: Number(form.get('minStock')),
        unit: 'kg',
        requestID: warehouseRequestID.current,
      })
      warehouseRequestID.current = crypto.randomUUID()
      target.reset()
      setShowCreate('')
      await refresh()
      notify('เพิ่มคลังสินค้าแล้ว')
    } catch (cause) {
      setError(errorText(cause))
    } finally {
      setBusy(false)
    }
  }
  async function createZone(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const target = event.currentTarget
    const form = new FormData(target)
    const material = materials.data.find((m) => m.materialID === form.get('materialID'))
    if (!material) {
      setError('กรุณาเลือกวัสดุ')
      return
    }
    setBusy(true)
    setError('')
    try {
      await operationsApi.createZone({
        zoneName: String(form.get('zoneName')),
        capacity: Number(form.get('capacity')),
        supportedGrade: String(form.get('grade')),
        stockStatus: 'available',
        warehouseID: String(form.get('warehouseID')),
        materialTypeID: material.materialTypeID,
        materialID: material.materialID,
        requestID: zoneRequestID.current,
      })
      zoneRequestID.current = crypto.randomUUID()
      target.reset()
      setShowCreate('')
      await refresh()
      notify('เพิ่มพื้นที่จัดเก็บแล้ว')
    } catch (cause) {
      setError(errorText(cause))
    } finally {
      setBusy(false)
    }
  }
  async function updateMinimumStock(materialID: string, value: number) {
    if (!Number.isFinite(value) || value <= 0) {
      setError('เกณฑ์ขั้นต่ำต้องมากกว่า 0')
      return false
    }
    setError('')
    try {
      await operationsApi.updateMinimumStock(materialID, value)
      await materials.refresh()
      setMaterialPage(1)
      notify('บันทึกเกณฑ์ขั้นต่ำแล้ว')
      return true
    } catch (cause) {
      setError(errorText(cause))
      return false
    }
  }
  if (warehouses.loading || zones.loading || materials.loading) return <Loading />

  if (materialSearch || workspace?.role === 'warehouse') {
    return (
      <div className="operations-workspace inventory-page inventory-reference-page material-search-reference-exact">
        <PageIntro
          eyebrow={roles[workspace!.role].english}
          title="ค้นหาข้อมูลวัสดุ"
          description="ยอดคงเหลือของวัสดุรีไซเคิลทุกรายการ พร้อมเกณฑ์ขั้นต่ำ"
        >
          <button
            className="button secondary"
            disabled={!minimumMaterials.length}
            onClick={() => {
              setMinimumScope(missingMinimum.length > 0 ? 'unset' : 'all')
              setMinimumQuery('')
              setShowMinimumManager(true)
            }}
          >
            จัดการเกณฑ์ขั้นต่ำ
          </button>
          <RefreshButton
            onClick={() => void refresh()}
            busy={warehouses.refreshing || zones.refreshing || materials.refreshing}
          />
        </PageIntro>

        <ErrorBox message={error || warehouses.error || zones.error || materials.error} />

        {missingMinimum.length > 0 && (
          <section className="minimum-stock-warning" role="status">
            <strong>วัสดุ {missingMinimum.length} ชนิดยังไม่กำหนดเกณฑ์ขั้นต่ำ</strong>
            <span>ตั้งค่าได้ที่ปุ่ม “จัดการเกณฑ์ขั้นต่ำ” เมื่อพร้อม</span>
          </section>
        )}

        <section className="panel inventory-reference-filter-panel">
          <div className="inventory-reference-toolbar">
            <label className="input-with-icon inventory-reference-search">
              <Search size={15} />
              <input
                value={query}
                onChange={(event) => { setQuery(event.target.value); setMaterialPage(1) }}
                placeholder="ค้นหาชื่อวัสดุหรือรหัส..."
              />
            </label>
            <select value={typeFilter} onChange={(event) => { setTypeFilter(event.target.value); setMaterialPage(1) }} aria-label="ประเภทวัสดุ">
              <option value="all">ทุกประเภท</option>
              {materialTypes.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
            </select>
            <select value={gradeFilter} onChange={(event) => { setGradeFilter(event.target.value); setMaterialPage(1) }} aria-label="เกรดวัสดุ">
              <option value="all">ทุกเกรด</option>
              <option value="A">เกรด A</option>
              <option value="B">เกรด B</option>
              <option value="C">เกรด C</option>
            </select>
            <select value={statusFilter} onChange={(event) => { setStatusFilter(event.target.value); setMaterialPage(1) }} aria-label="สถานะวัสดุ">
              <option value="all">ทุกสถานะ</option>
              <option value="normal">ปกติ</option>
              <option value="below">ต่ำกว่าเกณฑ์</option>
              <option value="unset">ยังไม่กำหนดขั้นต่ำ</option>
            </select>
          </div>
        </section>

        <section className="panel inventory-reference-table-panel">
          {!visibleMaterials.length ? (
            <Empty title="ไม่พบรายการวัสดุที่ค้นหา" message="ลองเปลี่ยนคำค้นหาหรือตัวกรอง" />
          ) : (
            <div className="table-scroll">
              <table className="inventory-reference-table">
                <thead>
                  <tr>
                    <th>รหัสวัสดุ</th>
                    <th>ชื่อวัสดุ</th>
                    <th>ประเภท</th>
                    <th>เกรด</th>
                    <th className="numeric">ยอดคงเหลือ</th>
                    <th className="numeric">เกณฑ์ขั้นต่ำ</th>
                    <th>สถานะ</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedMaterials.map((material) => (
                    <tr key={`${material.materialID}-${material.grade || 'none'}`}>
                      <td><strong>{material.materialID}</strong></td>
                      <td><strong>{material.materialName}</strong></td>
                      <td><span className="material-type-chip">{material.materialType?.typeName || '—'}</span></td>
                      <td>{material.grade ? <span className={`material-grade-chip grade-${material.grade.toLowerCase()}`}>เกรด {material.grade}</span> : '—'}</td>
                      <td className="numeric"><strong>{number(material.currentQuantity)} kg</strong></td>
                      <td className="numeric">{material.minimumStockConfigured ? `${number(material.minStockLevel)} kg` : '—'}</td>
                      <td>
                        {!material.minimumStockConfigured ? (
                          <Status value="pending" label="ยังไม่กำหนดขั้นต่ำ" />
                        ) : material.belowMin ? (
                          <span className="stock-alert"><AlertTriangle size={14} /> ต่ำกว่าเกณฑ์</span>
                        ) : (
                          <Status value="available" label="ปกติ" />
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
        <div className="material-search-pagination-wrap">
          <p className="inventory-reference-count">
            แสดง {visibleMaterials.length === 0 ? 0 : (materialPage - 1) * MATERIAL_PAGE_SIZE + 1}-{Math.min(materialPage * MATERIAL_PAGE_SIZE, visibleMaterials.length)} จาก {visibleMaterials.length} รายการ
          </p>
          {materialPageCount > 1 && (
            <nav className="material-search-pagination" aria-label="หน้ารายการวัสดุ">
              <button
                type="button"
                className="button secondary compact"
                disabled={materialPage === 1}
                onClick={() => setMaterialPage((page) => Math.max(1, page - 1))}
              >
                ก่อนหน้า
              </button>
              <div className="material-search-page-numbers">
                {Array.from({ length: materialPageCount }, (_, index) => index + 1).map((page) => (
                  <button
                    type="button"
                    key={page}
                    className={`material-search-page-number ${materialPage === page ? 'active' : ''}`}
                    aria-current={materialPage === page ? 'page' : undefined}
                    onClick={() => setMaterialPage(page)}
                  >
                    {page}
                  </button>
                ))}
              </div>
              <button
                type="button"
                className="button secondary compact"
                disabled={materialPage === materialPageCount}
                onClick={() => setMaterialPage((page) => Math.min(materialPageCount, page + 1))}
              >
                ถัดไป
              </button>
            </nav>
          )}
        </div>

        {showMinimumManager && (
          <Modal
            title="จัดการเกณฑ์ขั้นต่ำ"
            onClose={() => {
              if (pendingMinimumCount > 0) return
              setShowMinimumManager(false)
              setMinimumQuery('')
            }}
            busy={pendingMinimumCount > 0}
            wide
          >
            <div className="modal-body minimum-stock-manager reference-minimum-stock-manager">
              <p>กรอกจำนวนแล้วกดบันทึกทีละวัสดุ เกณฑ์เดียวกันใช้กับทุกเกรด</p>

              <div className="minimum-stock-scope" role="group" aria-label="สถานะการตั้งเกณฑ์">
                <button
                  type="button"
                  className={`button ${minimumScope === 'unset' ? 'primary' : 'secondary'}`}
                  aria-pressed={minimumScope === 'unset'}
                  onClick={() => { setMinimumScope('unset'); setMinimumQuery('') }}
                >
                  ยังไม่กำหนด ({missingMinimum.length})
                </button>
                <button
                  type="button"
                  className={`button ${minimumScope === 'all' ? 'primary' : 'secondary'}`}
                  aria-pressed={minimumScope === 'all'}
                  onClick={() => { setMinimumScope('all'); setMinimumQuery('') }}
                >
                  วัสดุทั้งหมด ({minimumMaterials.length})
                </button>
              </div>

              <label className="input-with-icon minimum-stock-search">
                <Search size={15} />
                <input
                  aria-label="ค้นหาวัสดุเพื่อกำหนดเกณฑ์"
                  placeholder="ค้นหาชื่อวัสดุหรือรหัส..."
                  value={minimumQuery}
                  onChange={(event) => setMinimumQuery(event.target.value)}
                />
              </label>

              <p className="minimum-stock-summary" role="status">
                {minimumScope === 'unset'
                  ? missingMinimum.length === 0
                    ? 'กำหนดเกณฑ์ครบทุกวัสดุแล้ว'
                    : `เหลือ ${missingMinimum.length} วัสดุที่ต้องตั้งค่า · แสดง ${shownMinimumMaterials.length} วัสดุ`
                  : `ตั้งค่าแล้ว ${minimumMaterials.length - missingMinimum.length} · ยังไม่กำหนด ${missingMinimum.length} · แสดง ${shownMinimumMaterials.length} วัสดุ`}
              </p>

              <div className="minimum-stock-list">
                {shownMinimumMaterials.map((material) => (
                  <MinimumStockCard
                    key={material.materialID}
                    material={material}
                    onSave={(value) => updateMinimumStock(material.materialID, value)}
                    onBusyChange={(saving) => setPendingMinimumCount((count) => Math.max(0, count + (saving ? 1 : -1)))}
                  />
                ))}
                {shownMinimumMaterials.length === 0 && (
                  <p className="minimum-stock-empty">
                    {minimumScope === 'unset' && missingMinimum.length === 0
                      ? 'ไม่มีวัสดุที่ยังไม่กำหนด หากต้องการแก้ค่าเดิม เลือก “วัสดุทั้งหมด”'
                      : 'ไม่พบวัสดุ ลองค้นหาด้วยชื่อหรือรหัสอื่น'}
                  </p>
                )}
              </div>

              <div className="modal-actions">
                <button
                  type="button"
                  className="button secondary"
                  disabled={pendingMinimumCount > 0}
                  onClick={() => { setShowMinimumManager(false); setMinimumQuery('') }}
                >
                  ปิด
                </button>
              </div>
            </div>
          </Modal>
        )}
      </div>
    )
  }

  return (
    <div className="operations-workspace inventory-page">
      <PageIntro
        eyebrow={roles[workspace!.role].english}
        title="คลังวัสดุ"
        description="ดูยอดคงเหลือ ความจุ และตำแหน่งจัดเก็บของวัสดุแต่ละชนิด"
      >
        <RefreshButton
          onClick={() => void refresh()}
          busy={warehouses.refreshing || zones.refreshing || materials.refreshing}
        />
        {canManage && (
          <>
            <button
              className="button secondary"
              onClick={() => setShowCreate(showCreate === 'warehouse' ? '' : 'warehouse')}
            >
              <Plus size={16} /> เพิ่มคลัง
            </button>
            <Link className="button primary" to="/zones"><MapPinned size={16} /> จัดการโซน</Link>
          </>
        )}
      </PageIntro>
      <ErrorBox message={error || warehouses.error || zones.error || materials.error} />
      {showCreate === 'warehouse' && (
        <section className="panel inline-create">
          <div>
            <h2>เพิ่มคลังสินค้า</h2>
            <p>กำหนดความจุรวมก่อนสร้างโซนภายในคลัง</p>
          </div>
          <form onSubmit={createWarehouse}>
            <label className="field">
              ความจุรวม (กก.)
              <input name="capacity" type="number" min="0" step="0.01" required />
            </label>
            <label className="field">
              จุดแจ้งเตือนขั้นต่ำ (กก.)
              <input name="minStock" type="number" min="0" step="0.01" defaultValue="0" required />
            </label>
            <button className="button primary" disabled={busy}>
              บันทึกคลัง
            </button>
          </form>
        </section>
      )}
      {showCreate === 'zone' && (
        <section className="panel inline-create">
          <div>
            <h2>เพิ่มพื้นที่จัดเก็บ</h2>
            <p>หนึ่งโซนเก็บวัสดุหนึ่งชนิดและหนึ่งเกรด</p>
          </div>
          <form onSubmit={createZone}>
            <label className="field">
              คลัง
              <select name="warehouseID" required>
                {warehouses.data.map((w) => (
                  <option key={w.warehouseID} value={w.warehouseID}>
                    {w.warehouseID}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              ชื่อโซน
              <input name="zoneName" placeholder="เช่น โซน A1" required />
            </label>
            <label className="field">
              วัสดุ
              <select name="materialID" required>
                {materials.data.map((m) => (
                  <option key={m.materialID} value={m.materialID}>
                    {m.materialName}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              เกรด
              <select name="grade">
                <option>A</option>
                <option>B</option>
                <option>C</option>
              </select>
            </label>
            <label className="field">
              ความจุ (กก.)
              <input name="capacity" type="number" min="0.01" step="0.01" required />
            </label>
            <button className="button primary" disabled={busy}>
              บันทึกโซน
            </button>
          </form>
        </section>
      )}
      <div className="metrics three">
        <div className="metric">
          <span className="metric-icon green">
            <Boxes size={21} />
          </span>
          <div>
            <p>วัสดุคงเหลือรวม</p>
            <strong>{number(totalStock)} กก.</strong>
            <small>จากทุกคลัง</small>
          </div>
        </div>
        <div className="metric">
          <span className="metric-icon blue">
            <WarehouseIcon size={21} />
          </span>
          <div>
            <p>ความจุรวม</p>
            <strong>{number(totalCapacity)} กก.</strong>
            <small>เหลือ {number(Math.max(0, totalCapacity - totalStock))} กก.</small>
          </div>
        </div>
        <div className="metric">
          <span className="metric-icon amber">
            <WarehouseIcon size={21} />
          </span>
          <div>
            <p>พื้นที่จัดเก็บ</p>
            <strong>{number(zones.data.length)}</strong>
            <small>
              {zones.data.filter((z) => z.stockStatus === 'available').length} พื้นที่พร้อมใช้
            </small>
          </div>
        </div>
      </div>
      <section className="panel material-inventory-panel">
        <div className="panel-heading"><div><h2><Boxes size={17} /> ภาพรวมวัสดุ</h2><p>{visibleMaterials.length} รายการ · ต่ำกว่าเกณฑ์ {materials.data.filter((row) => row.belowMin).length}</p></div></div>
        <div className="movement-filters inventory-filters">
          <label className="input-with-icon"><Search size={15} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="ค้นหารหัส ชื่อ หรือประเภทวัสดุ" /></label>
          <label className="check-filter"><input type="checkbox" checked={lowOnly} onChange={(event) => setLowOnly(event.target.checked)} /> แสดงเฉพาะต่ำกว่าเกณฑ์</label>
        </div>
        {!visibleMaterials.length ? <Empty title="ไม่พบวัสดุ" message="ลองเปลี่ยนคำค้นหาหรือตัวกรอง" /> : <div className="table-scroll"><table><thead><tr><th>วัสดุ</th><th>ประเภท / เกรด</th><th className="numeric">คงเหลือ</th><th className="numeric">เกณฑ์ขั้นต่ำ</th><th>สถานะ</th>{canManage && <th>กำหนดขั้นต่ำ</th>}</tr></thead><tbody>{visibleMaterials.map((material) => <tr key={material.materialID}><td><strong>{material.materialName}</strong><br /><small>{material.materialID}</small></td><td>{material.materialType?.typeName || '—'} · {material.grade || '—'}</td><td className="numeric"><strong>{number(material.currentQuantity)} {material.unit}</strong></td><td className="numeric">{material.minimumStockConfigured ? `${number(material.minStockLevel)} ${material.unit}` : 'ยังไม่กำหนด'}</td><td>{material.belowMin ? <span className="stock-alert"><AlertTriangle size={14} /> ต่ำกว่าเกณฑ์</span> : <Status value="available" label="เพียงพอ" />}</td>{canManage && <td><form className="minimum-stock-form" onSubmit={(event) => { event.preventDefault(); const value = Number(new FormData(event.currentTarget).get('minimum')); void updateMinimumStock(material.materialID, value) }}><input name="minimum" type="number" min="0.01" step="0.01" defaultValue={material.minimumStockConfigured ? material.minStockLevel : ''} aria-label={`เกณฑ์ขั้นต่ำ ${material.materialName}`} /><button className="button secondary compact" disabled={busy}>บันทึก</button></form></td>}</tr>)}</tbody></table></div>}
      </section>
      {!grouped.length ? (
        <section className="panel">
          <Empty
            title="ยังไม่มีคลังสินค้า"
            message="หัวหน้าคลังสามารถเพิ่มคลังและพื้นที่จัดเก็บได้จากหน้านี้"
          />
        </section>
      ) : (
        <div className="warehouse-grid">
          {grouped.map(({ warehouse, zones: rows }) => {
            const percent = capacityPercent(warehouse.currentQuantity, warehouse.totalCapacity)
            return (
              <section className="panel warehouse-card" key={warehouse.warehouseID}>
                <div className="warehouse-card-head">
                  <span className="metric-icon green">
                    <WarehouseIcon size={21} />
                  </span>
                  <div>
                    <h2>{warehouse.warehouseID}</h2>
                    <p>
                      {number(warehouse.currentQuantity)} / {number(warehouse.totalCapacity)}{' '}
                      {warehouse.unit}
                    </p>
                  </div>
                  <strong>{number(percent)}%</strong>
                </div>
                <div className="capacity-bar large">
                  <i style={{ width: `${percent}%` }} />
                </div>
                <div className="zone-list">
                  {rows.map((zone) => (
                    <article key={zone.zoneID}>
                      <span>
                        <strong>{zone.zoneName}</strong>
                        <small>
                          {zone.material?.materialName || zone.materialID} · เกรด{' '}
                          {zone.supportedGrade}
                        </small>
                      </span>
                      <span className="numeric">
                        <strong>
                          {number(zone.quantityOnHand)} / {number(zone.capacity)}
                        </strong>
                        <Status value={zone.stockStatus} />
                      </span>
                    </article>
                  ))}
                  {!rows.length && <p className="list-empty">ยังไม่มีโซนในคลังนี้</p>}
                </div>
              </section>
            )
          })}
        </div>
      )}
    </div>
  )
}

function minimumStockError(value: string) {
  if (!value.trim()) return 'กรุณากำหนดเกณฑ์ขั้นต่ำ'
  return !Number.isFinite(Number(value)) || Number(value) <= 0
    ? 'เกณฑ์ขั้นต่ำต้องมากกว่า 0'
    : ''
}

function MinimumStockCard({
  material,
  onSave,
  onBusyChange,
}: {
  material: InventoryMaterial
  onSave: (value: number) => Promise<boolean>
  onBusyChange: (busy: boolean) => void
}) {
  const [value, setValue] = useState(material.minimumStockConfigured ? String(material.minStockLevel) : '')
  const [touched, setTouched] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const validation = minimumStockError(value)
  const unchanged = material.minimumStockConfigured && Number(value) === material.minStockLevel

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setTouched(true)
    setSaveError('')
    if (validation || unchanged || saving) return
    setSaving(true)
    onBusyChange(true)
    try {
      const saved = await onSave(Number(value))
      if (!saved) setSaveError('บันทึกเกณฑ์ขั้นต่ำไม่สำเร็จ')
    } finally {
      setSaving(false)
      onBusyChange(false)
    }
  }

  return (
    <form className="minimum-stock-manager-row reference-minimum-stock-card" noValidate onSubmit={submit}>
      <div className="minimum-stock-material-info">
        <strong>{material.materialName}</strong>
        <small>ประเภท: {material.materialType?.typeName || '—'}</small>
        {material.minimumStockConfigured ? (
          <span>เกณฑ์ปัจจุบัน {number(material.minStockLevel)} kg</span>
        ) : (
          <Status value="pending" label="ยังไม่กำหนดขั้นต่ำ" />
        )}
      </div>
      <label className="minimum-stock-field">
        <span>เกณฑ์ขั้นต่ำ (kg)</span>
        <div className="minimum-stock-input-row">
          <input
            name="minimum"
            type="number"
            min="0"
            step="any"
            value={value}
            disabled={saving}
            aria-invalid={touched && !!validation}
            placeholder="ระบุจำนวน"
            onChange={(event) => {
              setValue(event.target.value)
              setTouched(true)
              setSaveError('')
            }}
            onBlur={() => setTouched(true)}
          />
          <button className="button primary compact" disabled={!!validation || unchanged || saving}>
            {saving ? 'กำลังบันทึก…' : 'บันทึก'}
          </button>
        </div>
        <small className="minimum-stock-field-error" role={(touched && validation) || saveError ? 'alert' : undefined}>
          {touched && validation ? validation : saveError}
        </small>
      </label>
    </form>
  )
}
