import { useState } from 'react'
import { CalendarClock, CheckCircle2, Clock3, Plus, ScrollText } from 'lucide-react'
import { Link, Navigate } from 'react-router-dom'
import { Empty, ErrorBox, Loading, Metric, PageIntro, RefreshButton, SearchBox, Status } from '../components/ui'
import { useApp } from '../context/AppContext'
import { useRecord } from '../hooks/useRecord'
import { dateLabel, shortId, statusLabels } from '../utils/format'
import type { SalesContract } from '../types'

export function Contracts() {
  const { data, workspace } = useApp()
  const record = useRecord<SalesContract[]>('/sales-contracts')
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('')
  if (workspace?.role !== 'sales') return <Navigate to="/" replace />
  if (record.loading) return <Loading />
  if (!record.data) return <ErrorBox message={record.error} retry={record.reload} />
  const factoryName = (id: string) =>
    data.factories.find((factory) => factory.factory_id === id)?.company_name || id
  const contracts = record.data.filter((contract) => contract.sales_staff_id === workspace.employeeId)
  const rows = contracts.filter(
    (contract) =>
      (!status || contract.status === status) &&
      `${contract.contract_id} ${factoryName(contract.factory_id)}`
        .toLowerCase()
        .includes(query.toLowerCase()),
  )
  const activeCount = contracts.filter((contract) => contract.status === 'active').length
  const waitingCount = contracts.filter((contract) =>
    ['pending_approval', 'pending_signature'].includes(contract.status),
  ).length
  const expiringCount = (() => {
    const limit = new Date()
    limit.setDate(limit.getDate() + 60)
    return contracts.filter((contract) => {
      const end = new Date(`${contract.valid_to.slice(0, 10)}T12:00:00`)
      return contract.status === 'active' && end <= limit
    }).length
  })()
  return (
    <>
      <PageIntro
        eyebrow="SALES CONTRACT"
        title="สัญญาซื้อขายวัสดุ"
        description="จัดทำข้อตกลงกับโรงงาน ติดตามการอนุมัติและวันหมดอายุ"
      >
        <RefreshButton onClick={record.reload} busy={record.loading} />
        <Link className="button primary" to="/contracts/new">
          <Plus size={17} />
          สร้างสัญญา
        </Link>
      </PageIntro>
      <div className="metrics three">
        <Metric label="สัญญาทั้งหมด" value={contracts.length} detail="รายการที่ฉันดูแล" icon={ScrollText} />
        <Metric label="มีผลใช้งาน" value={activeCount} detail="พร้อมใช้สร้างรายการขาย" icon={CheckCircle2} tone="green" />
        <Metric label="รอดำเนินการ" value={waitingCount} detail={`${expiringCount} สัญญาใกล้หมดอายุ`} icon={Clock3} tone="amber" />
      </div>
      <div className="section-label">
        <ScrollText size={18} />
        รายการสัญญา<span>{rows.length} รายการ</span>
      </div>
      <section className="panel">
        <div className="table-toolbar">
          <SearchBox value={query} onChange={setQuery} placeholder="ค้นหารหัสสัญญาหรือโรงงาน" />
          <select aria-label="กรองสถานะสัญญา" value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="">ทุกสถานะ</option>
            {['draft', 'pending_approval', 'pending_signature', 'active', 'expired', 'cancelled'].map((value) => (
              <option key={value} value={value}>{statusLabels[value]}</option>
            ))}
          </select>
        </div>
        {!rows.length ? (
          <Empty
            title={query || status ? 'ไม่พบสัญญาที่ตรงกับตัวกรอง' : 'ยังไม่มีสัญญาซื้อขาย'}
            message={query || status ? 'ลองเปลี่ยนคำค้นหาหรือสถานะ' : 'กดสร้างสัญญาเพื่อกำหนดวัสดุ ราคา และระยะเวลา'}
            action={!query && !status ? <Link className="button primary" to="/contracts/new"><Plus size={16} />สร้างสัญญาแรก</Link> : undefined}
          />
        ) : (
          <div className="table-scroll">
            <table>
              <thead>
                <tr><th>สัญญา / โรงงาน</th><th>ระยะเวลาสัญญา</th><th>วัสดุ</th><th>สถานะ</th><th>ดำเนินการ</th></tr>
              </thead>
              <tbody>
                {rows.map((contract) => (
                  <tr key={contract.contract_id}>
                    <td>
                      <Link className="row-identity" to={`/contracts/${encodeURIComponent(contract.contract_id)}`}>
                        <span className="row-avatar"><ScrollText size={17} /></span>
                        <span><strong title={contract.contract_id}>{shortId(contract.contract_id)}</strong><small>{factoryName(contract.factory_id)}</small></span>
                      </Link>
                    </td>
                    <td><span className="stacked"><span>{dateLabel(contract.valid_from)} – {dateLabel(contract.valid_to)}</span><small><CalendarClock size={12} /> ทำเมื่อ {dateLabel(contract.contract_date)}</small></span></td>
                    <td>{contract.materials.length} รายการ</td>
                    <td><Status value={contract.status} /></td>
                    <td><Link className="button small soft" to={`/contracts/${encodeURIComponent(contract.contract_id)}`}>ดูรายละเอียด</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="table-footer"><span>ทั้งหมด {rows.length} รายการ</span></div>
      </section>
    </>
  )
}
