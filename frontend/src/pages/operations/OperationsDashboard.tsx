import {
  Boxes,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  PackageCheck,
  ScanLine,
  Warehouse,
  UsersRound,
  ShoppingBag,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import {
  Empty,
  ErrorBox,
  Loading,
  Metric,
  PageIntro,
  RefreshButton,
  Status,
} from '../../components/ui'
import { roles, useApp } from '../../context/AppContext'
import { useApiList } from '../../hooks/useApiList'
import type {
  AssessmentBatch,
  Complaint,
  PendingWarehouseItem,
  StockAdjustment,
  StorageZone,
  Seller,
  ScrapPurchase,
  Warehouse as WarehouseRow,
} from '../../types'
import { dateLabel, number } from '../../utils/format'

export function OperationsDashboard() {
  const { workspace } = useApp()
  const role = workspace!.role
  if (role === 'quality') return <QualityDashboard />
  if (role === 'customer_service') return <ComplaintDashboard />
  if (role === 'purchasing') return <PurchasingDashboard />
  if (role === 'manager') return <ManagerDashboard />
  return <WarehouseDashboard manager={role === 'warehouse_manager'} />
}

function QualityDashboard() {
  const batches = useApiList<AssessmentBatch>('/assessment-batches')
  const assessments = useApiList<{ result: string; assessedQuantity: number }>(
    '/quality-assessments',
  )
  const refresh = () => Promise.all([batches.refresh(), assessments.refresh()])
  if (batches.loading || assessments.loading) return <Loading />
  return (
    <DashboardFrame
      role="quality"
      busy={batches.refreshing || assessments.refreshing}
      error={batches.error || assessments.error}
      refresh={refresh}
      title="ภาพรวมงานประเมินคุณภาพ"
      description="ติดตามชุดวัสดุที่เข้ามาและผลการคัดแยกทั้งหมด"
    >
      <div className="metrics">
        <Metric
          label="ชุดประเมินวันนี้"
          value={number(
            batches.data.filter(
              (b) => b.assessmentDate.slice(0, 10) === new Date().toISOString().slice(0, 10),
            ).length,
          )}
          detail="รายการที่สร้างวันนี้"
          icon={ScanLine}
        />
        <Metric
          label="กำลังประเมิน"
          value={number(batches.data.filter((b) => b.status === 'in_progress').length)}
          detail="รอบันทึกผลให้ครบ"
          icon={Clock3}
          tone="amber"
        />
        <Metric
          label="ผ่านเกณฑ์"
          value={number(assessments.data.filter((a) => a.result === 'passed').length)}
          detail="พร้อมเข้าสู่กระบวนการซื้อ"
          icon={CheckCircle2}
          tone="blue"
        />
        <Metric
          label="น้ำหนักประเมินแล้ว"
          value={`${number(assessments.data.reduce((sum, a) => sum + a.assessedQuantity, 0))} กก.`}
          detail="รวมทุกผลการประเมิน"
          icon={PackageCheck}
          tone="purple"
        />
      </div>
      <RecentBatches batches={batches.data} />
    </DashboardFrame>
  )
}

function ComplaintDashboard() {
  const complaints = useApiList<Complaint>('/complaints')
  const returns = useApiList<unknown>('/return-records')
  const refresh = () => Promise.all([complaints.refresh(), returns.refresh()])
  if (complaints.loading || returns.loading) return <Loading />
  return (
    <DashboardFrame
      role="customer_service"
      busy={complaints.refreshing || returns.refreshing}
      error={complaints.error || returns.error}
      refresh={refresh}
      title="ภาพรวมคำร้องเรียน"
      description="ตรวจคำร้อง ตัดสินใจ และติดตามการรับคืนในที่เดียว"
    >
      <div className="metrics three">
        <Metric
          label="รอพิจารณา"
          value={number(complaints.data.filter((c) => c.status === 'pending').length)}
          detail="ต้องตรวจสอบหลักฐาน"
          icon={Clock3}
          tone="amber"
        />
        <Metric
          label="อนุมัติแล้ว"
          value={number(complaints.data.filter((c) => c.status === 'approved').length)}
          detail="พร้อมประสานการรับคืน"
          icon={CheckCircle2}
        />
        <Metric
          label="รับคืนแล้ว"
          value={number(returns.data.length)}
          detail="รายการที่คลังบันทึกแล้ว"
          icon={PackageCheck}
          tone="blue"
        />
      </div>
      <ComplaintPreview rows={complaints.data} />
    </DashboardFrame>
  )
}

function PurchasingDashboard() {
  const sellers = useApiList<Seller>('/sellers')
  const purchases = useApiList<ScrapPurchase>('/scrap-purchases')
  const refresh = () => Promise.all([sellers.refresh(), purchases.refresh()])
  if (sellers.loading || purchases.loading) return <Loading />
  return (
    <DashboardFrame
      role="purchasing"
      busy={sellers.refreshing || purchases.refreshing}
      error={sellers.error || purchases.error}
      refresh={refresh}
      title="ภาพรวมงานรับซื้อ"
      description="ตรวจผู้ขาย สร้างรายการรับซื้อ และส่งวัสดุต่อเข้าคลัง"
    >
      <div className="metrics three">
        <Metric
          label="ผู้ขายทั้งหมด"
          value={number(sellers.data.length)}
          detail={`${sellers.data.filter((s) => s.account_status === 'active').length} รายพร้อมใช้งาน`}
          icon={UsersRound}
        />
        <Metric
          label="รายการรับซื้อ"
          value={number(purchases.data.length)}
          detail="รายการที่บันทึกแล้ว"
          icon={ShoppingBag}
          tone="blue"
        />
        <Metric
          label="มูลค่ารวม"
          value={`฿${number(purchases.data.reduce((sum, row) => sum + row.totalAmount, 0))}`}
          detail="รวมรายการรับซื้อ"
          icon={PackageCheck}
          tone="purple"
        />
      </div>
      <section className="panel">
        <div className="panel-heading">
          <div>
            <h2>ทางลัดสำหรับงานรับซื้อ</h2>
            <p>เริ่มจากตรวจผู้ขายก่อนสร้างรายการรับซื้อ</p>
          </div>
        </div>
        <div className="quick-actions">
          <Link className="button primary" to="/sellers">
            ค้นหาผู้ขาย
          </Link>
          <Link className="button secondary" to="/sellers/new">
            ลงทะเบียนผู้ขาย
          </Link>
          <Link className="button soft" to="/purchases">
            เปิดรายการรับซื้อ
          </Link>
        </div>
      </section>
    </DashboardFrame>
  )
}

function ManagerDashboard() {
  const sellers = useApiList<Seller>('/sellers')
  if (sellers.loading) return <Loading />
  return (
    <DashboardFrame
      role="manager"
      busy={sellers.refreshing}
      error={sellers.error}
      refresh={sellers.refresh}
      title="ภาพรวมสำหรับผู้จัดการ"
      description="ตรวจสอบข้อมูลที่ต้องใช้ประกอบการอนุมัติและติดตามสถานะผู้ขาย"
    >
      <div className="metrics three">
        <Metric
          label="ผู้ขายทั้งหมด"
          value={number(sellers.data.length)}
          detail="ข้อมูลที่ลงทะเบียนในระบบ"
          icon={UsersRound}
        />
        <Metric
          label="ใช้งานปกติ"
          value={number(sellers.data.filter((seller) => seller.account_status === 'active').length)}
          detail="พร้อมเข้าสู่กระบวนการรับซื้อ"
          icon={CheckCircle2}
        />
        <Metric
          label="ถูกระงับ"
          value={number(
            sellers.data.filter((seller) => seller.account_status === 'suspended').length,
          )}
          detail="รอตรวจสอบหรือแก้ไขข้อมูล"
          icon={Clock3}
          tone="amber"
        />
      </div>
      <section className="panel">
        <div className="panel-heading">
          <div>
            <h2>การตรวจสอบผู้ขาย</h2>
            <p>ดูรายละเอียดและสถานะบัญชีผู้ขายทั้งหมด</p>
          </div>
          <Link className="button primary" to="/sellers">
            เปิดรายการผู้ขาย
          </Link>
        </div>
      </section>
    </DashboardFrame>
  )
}

function WarehouseDashboard({ manager }: { manager: boolean }) {
  const warehousesSource = useApiList<WarehouseRow>('/warehouses')
  const zonesSource = useApiList<StorageZone>('/storage-zones')
  const pendingSource = useApiList<PendingWarehouseItem>('/pending-warehouse-items')
  const adjustmentsSource = useApiList<StockAdjustment>('/stock-adjustments')
  const refresh = () =>
    Promise.all([
      warehousesSource.refresh(),
      zonesSource.refresh(),
      pendingSource.refresh(),
      adjustmentsSource.refresh(),
    ])
  if (
    warehousesSource.loading ||
    zonesSource.loading ||
    pendingSource.loading ||
    adjustmentsSource.loading
  )
    return <Loading />
  const warehouses = warehousesSource.data
  const zones = zonesSource.data
  const pending = pendingSource.data
  const adjustments = adjustmentsSource.data
  const used = warehouses.reduce((sum, row) => sum + row.currentQuantity, 0)
  const capacity = warehouses.reduce((sum, row) => sum + row.totalCapacity, 0)
  return (
    <DashboardFrame
      role={manager ? 'warehouse_manager' : 'warehouse'}
      busy={
        warehousesSource.refreshing ||
        zonesSource.refreshing ||
        pendingSource.refreshing ||
        adjustmentsSource.refreshing
      }
      error={
        warehousesSource.error ||
        zonesSource.error ||
        pendingSource.error ||
        adjustmentsSource.error
      }
      refresh={refresh}
      title={manager ? 'ภาพรวมการควบคุมคลัง' : 'ภาพรวมคลังสินค้า'}
      description="ยอดคงเหลือ งานรับเข้า และรายการที่ต้องดำเนินการล่าสุด"
    >
      <div className="metrics">
        <Metric
          label="วัสดุคงเหลือ"
          value={`${number(used)} กก.`}
          detail={`${capacity ? number((used / capacity) * 100) : 0}% ของความจุ`}
          icon={Boxes}
        />
        <Metric
          label="พื้นที่จัดเก็บ"
          value={number(zones.length)}
          detail={`${zones.filter((z) => z.stockStatus === 'available').length} พื้นที่พร้อมใช้`}
          icon={Warehouse}
          tone="blue"
        />
        <Metric
          label="รอรับเข้าคลัง"
          value={number(pending.filter((p) => p.receivingStatus === 'waiting_receipt').length)}
          detail="ผ่านการประเมินแล้ว"
          icon={Clock3}
          tone="amber"
        />
        <Metric
          label="รออนุมัติปรับยอด"
          value={number(adjustments.filter((a) => a.status === 'pending').length)}
          detail="ผลต่างจากการตรวจนับ"
          icon={ClipboardCheck}
          tone="purple"
        />
      </div>
      <ZonePreview zones={zones} />
    </DashboardFrame>
  )
}

function DashboardFrame({
  role,
  busy,
  error,
  refresh,
  title,
  description,
  children,
}: {
  role: keyof typeof roles
  busy: boolean
  error: string
  refresh: () => Promise<unknown>
  title: string
  description: string
  children: React.ReactNode
}) {
  return (
    <>
      <PageIntro eyebrow={roles[role].english} title={title} description={description}>
        <RefreshButton onClick={() => void refresh()} busy={busy} />
      </PageIntro>
      <ErrorBox message={error} retry={() => void refresh()} />
      {children}
    </>
  )
}

function RecentBatches({ batches }: { batches: AssessmentBatch[] }) {
  return (
    <section className="panel">
      <div className="panel-heading">
        <div>
          <h2>ชุดประเมินล่าสุด</h2>
          <p>งานรับวัสดุจากผู้ขายที่กำลังดำเนินการ</p>
        </div>
        <Link className="text-link" to="/quality">
          เปิดพื้นที่คัดแยก
        </Link>
      </div>
      {!batches.length ? (
        <Empty title="ยังไม่มีชุดประเมิน" message="เริ่มสร้างชุดประเมินเมื่อผู้ขายนำวัสดุเข้ามา" />
      ) : (
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>รหัสชุด / ผู้ขาย</th>
                <th>วันที่</th>
                <th>จำนวนรายการ</th>
                <th>สถานะ</th>
              </tr>
            </thead>
            <tbody>
              {batches.slice(0, 6).map((b) => (
                <tr key={b.assessmentBatchID}>
                  <td>
                    <strong>{b.assessmentBatchID}</strong>
                    <br />
                    <small>{b.sellerCode}</small>
                  </td>
                  <td>{dateLabel(b.assessmentDate)}</td>
                  <td>{number(b.assessments?.length || 0)}</td>
                  <td>
                    <Status value={b.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

function ZonePreview({ zones }: { zones: StorageZone[] }) {
  return (
    <section className="panel">
      <div className="panel-heading">
        <div>
          <h2>สถานะพื้นที่จัดเก็บ</h2>
          <p>เรียงตามโซนเพื่อเห็นพื้นที่ใกล้เต็มได้เร็ว</p>
        </div>
        <Link className="text-link" to="/inventory">
          ดูคลังทั้งหมด
        </Link>
      </div>
      {!zones.length ? (
        <Empty title="ยังไม่มีพื้นที่จัดเก็บ" message="เพิ่มคลังและโซนก่อนเริ่มรับวัสดุ" />
      ) : (
        <div className="zone-summary-grid">
          {zones.slice(0, 8).map((z) => {
            const percent = z.capacity ? Math.min(100, (z.quantityOnHand / z.capacity) * 100) : 0
            return (
              <article className="zone-summary-card" key={z.zoneID}>
                <div>
                  <span>{z.zoneName}</span>
                  <small>
                    {z.material?.materialName || z.materialID} · เกรด {z.supportedGrade}
                  </small>
                </div>
                <strong>
                  {number(z.quantityOnHand)} / {number(z.capacity)} กก.
                </strong>
                <div className="capacity-bar">
                  <i style={{ width: `${percent}%` }} />
                </div>
              </article>
            )
          })}
        </div>
      )}
    </section>
  )
}

function ComplaintPreview({ rows }: { rows: Complaint[] }) {
  return (
    <section className="panel">
      <div className="panel-heading">
        <div>
          <h2>คำร้องล่าสุด</h2>
          <p>รายการจากคู่ค้าที่รอการตัดสินใจ</p>
        </div>
        <Link className="text-link" to="/complaints">
          ดูทั้งหมด
        </Link>
      </div>
      {!rows.length ? (
        <Empty title="ยังไม่มีคำร้องเรียน" message="คำร้องใหม่จะแสดงในหน้านี้" />
      ) : (
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>เลขคำร้อง</th>
                <th>คำสั่งซื้อ</th>
                <th>วันที่แจ้ง</th>
                <th>สถานะ</th>
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, 6).map((row) => (
                <tr key={row.complaint_id}>
                  <td>
                    <strong>{row.complaint_id}</strong>
                  </td>
                  <td>{row.order_id}</td>
                  <td>{dateLabel(row.complaint_date)}</td>
                  <td>
                    <Status
                      value={row.status}
                      label={row.status === 'pending' ? 'รอพิจารณา' : undefined}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
