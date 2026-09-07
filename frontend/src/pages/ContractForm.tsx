import { useState, type SyntheticEvent } from 'react'
import { ArrowRight, Building2, CalendarDays, FileText, Package, Plus, Save, ScrollText, Trash2 } from 'lucide-react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { ErrorBox, Info, Loading, PageIntro } from '../components/ui'
import { useApp } from '../context/AppContext'
import { useRecord } from '../hooks/useRecord'
import { api, errorText } from '../services/api'
import { number, today } from '../utils/format'
import type { SalesContract } from '../types'

interface MaterialLine {
  material_id: string
  contract_quantity: string
  unit_price: string
  volume_discount_percent: string
}

const emptyLine = (): MaterialLine => ({
  material_id: '',
  contract_quantity: '1',
  unit_price: '0',
  volume_discount_percent: '0',
})

export function ContractFormPage() {
  const { id } = useParams()
  const { workspace } = useApp()
  if (workspace?.role !== 'sales') return <Navigate to="/" replace />
  return id ? <EditContract id={id} /> : <ContractForm />
}

function EditContract({ id }: { id: string }) {
  const record = useRecord<SalesContract>(`/sales-contracts/${encodeURIComponent(id)}`)
  if (record.loading) return <Loading />
  if (!record.data) return <ErrorBox message={record.error} retry={record.reload} />
  return <ContractForm contract={record.data} />
}

function ContractForm({ contract }: { contract?: SalesContract }) {
  const { data, workspace, notify } = useApp()
  const navigate = useNavigate()
  const [factoryId, setFactoryId] = useState(contract?.factory_id || '')
  const [contractDate, setContractDate] = useState(contract?.contract_date.slice(0, 10) || today())
  const [validFrom, setValidFrom] = useState(contract?.valid_from.slice(0, 10) || today())
  const [validTo, setValidTo] = useState(contract?.valid_to.slice(0, 10) || '')
  const [terms, setTerms] = useState(contract?.terms || '')
  const [documentUrl, setDocumentUrl] = useState(contract?.document_url || '')
  const [lines, setLines] = useState<MaterialLine[]>(
    contract?.materials.map((line) => ({
      material_id: line.material_id,
      contract_quantity: String(line.contract_quantity),
      unit_price: String(line.unit_price),
      volume_discount_percent: String(line.volume_discount_percent),
    })) || [emptyLine()],
  )
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const factory = data.factories.find((item) => item.factory_id === factoryId)
  const canEdit =
    !contract ||
    (contract.sales_staff_id === workspace?.employeeId &&
      ['draft', 'pending_approval'].includes(contract.status))

  if (!canEdit)
    return (
      <>
        <ErrorBox message="สัญญานี้แก้ไขรายละเอียดไม่ได้ เพราะผ่านขั้นตอนอนุมัติแล้วหรือเป็นสัญญาของพนักงานคนอื่น" />
        <Link className="button secondary" to={`/contracts/${encodeURIComponent(contract!.contract_id)}`}>กลับไปดูสัญญา</Link>
      </>
    )

  function changeLine(index: number, field: keyof MaterialLine, value: string) {
    setLines((rows) => rows.map((row, rowIndex) => rowIndex === index ? { ...row, [field]: value } : row))
  }

  async function submit(event: SyntheticEvent, nextStatus: 'draft' | 'pending_approval') {
    event.preventDefault()
    if (busy) return
    setError('')
    if (!factoryId || !validFrom || !validTo || !terms.trim())
      return setError('กรุณากรอกโรงงาน วันที่มีผล วันหมดอายุ และเงื่อนไขสัญญาให้ครบ')
    if (validTo < validFrom) return setError('วันหมดอายุต้องไม่อยู่ก่อนวันที่เริ่มมีผล')
    if (!lines.length || lines.some((line) =>
      !line.material_id || Number(line.contract_quantity) <= 0 || Number(line.unit_price) < 0 ||
      Number(line.volume_discount_percent) < 0 || Number(line.volume_discount_percent) > 100 ||
      !Number.isFinite(Number(line.contract_quantity)) || !Number.isFinite(Number(line.unit_price)),
    )) return setError('กรุณากรอกวัสดุ จำนวน ราคา และส่วนลดให้ถูกต้อง')
    if (new Set(lines.map((line) => line.material_id)).size !== lines.length)
      return setError('วัสดุหนึ่งชนิดใส่ได้เพียงหนึ่งรายการ')
    setBusy(true)
    try {
      const payload = {
        factory_id: factoryId,
        sales_staff_id: workspace!.employeeId,
        contract_date: contractDate,
        valid_from: validFrom,
        valid_to: validTo,
        status: nextStatus,
        terms: terms.trim(),
        document_url: documentUrl.trim(),
        materials: lines.map((line) => ({
          material_id: line.material_id,
          contract_quantity: Number(line.contract_quantity),
          unit_price: Number(line.unit_price),
          volume_discount_percent: Number(line.volume_discount_percent),
        })),
      }
      const result = await api<SalesContract>(
        contract ? `/sales-contracts/${encodeURIComponent(contract.contract_id)}` : '/sales-contracts',
        contract ? 'PATCH' : 'POST',
        payload,
      )
      notify(nextStatus === 'draft' ? 'บันทึกร่างสัญญาแล้ว' : 'ส่งสัญญาเพื่อขออนุมัติแล้ว')
      navigate(`/contracts/${encodeURIComponent(result.contract_id)}`)
    } catch (reason) {
      setError(errorText(reason))
    } finally {
      setBusy(false)
    }
  }

  const gross = lines.reduce((sum, line) => sum + Number(line.contract_quantity || 0) * Number(line.unit_price || 0), 0)
  const net = lines.reduce((sum, line) => {
    const subtotal = Number(line.contract_quantity || 0) * Number(line.unit_price || 0)
    return sum + subtotal * (1 - Number(line.volume_discount_percent || 0) / 100)
  }, 0)

  return (
    <>
      <PageIntro
        eyebrow="SALES CONTRACT"
        title={contract ? 'แก้ไขสัญญา' : 'สร้างสัญญาซื้อขาย'}
        description="กำหนดคู่ค้า ระยะเวลา วัสดุ ราคา และเงื่อนไขให้ครบก่อนส่งอนุมัติ"
        back={contract ? `/contracts/${encodeURIComponent(contract.contract_id)}` : '/contracts'}
      />
      <form onSubmit={(event) => void submit(event, 'draft')}>
        <fieldset className="form-fieldset" disabled={busy}>
          <div className="form-layout contract-form-layout">
            <div className="form-sections">
              <section className="panel form-panel">
                <h2><Building2 size={19} />คู่สัญญาและระยะเวลา</h2>
                <div className="form-grid">
                  <label className="field">โรงงาน / คู่ค้า <span className="required">*</span>
                    <select required value={factoryId} onChange={(event) => setFactoryId(event.target.value)}>
                      <option value="">เลือกโรงงาน</option>
                      {data.factories.map((item) => <option key={item.factory_id} value={item.factory_id}>{item.company_name}</option>)}
                    </select>
                  </label>
                  <label className="field">วันที่ทำสัญญา <span className="required">*</span>
                    <input required type="date" value={contractDate} onChange={(event) => setContractDate(event.target.value)} />
                  </label>
                  <label className="field">วันที่เริ่มมีผล <span className="required">*</span>
                    <input required type="date" value={validFrom} onChange={(event) => setValidFrom(event.target.value)} />
                  </label>
                  <label className="field">วันหมดอายุ <span className="required">*</span>
                    <input required type="date" min={validFrom} value={validTo} onChange={(event) => setValidTo(event.target.value)} />
                  </label>
                </div>
                {factory && <dl className="factory-preview"><Info label="ผู้ติดต่อ">{factory.contact_person}</Info><Info label="โทรศัพท์">{factory.phone}</Info><Info label="ที่อยู่">{factory.address}</Info></dl>}
              </section>

              <section className="panel form-panel">
                <div className="section-heading"><h2><Package size={19} />วัสดุและราคาที่ตกลง</h2><span className="muted">{lines.length} รายการ</span></div>
                <div className="contract-material-lines">
                  {lines.map((line, index) => (
                    <div className="contract-material-line" key={index}>
                      <span className="line-number">{String(index + 1).padStart(2, '0')}</span>
                      <label className="field">วัสดุ
                        <select required value={line.material_id} onChange={(event) => changeLine(index, 'material_id', event.target.value)}>
                          <option value="">เลือกวัสดุ</option>
                          {data.materials.map((material) => <option key={material.material_id} value={material.material_id} disabled={lines.some((other, rowIndex) => rowIndex !== index && other.material_id === material.material_id)}>{material.material_name} · {material.unit}</option>)}
                        </select>
                      </label>
                      <label className="field">จำนวนตามสัญญา
                        <input required type="number" min="0.001" step="0.001" value={line.contract_quantity} onChange={(event) => changeLine(index, 'contract_quantity', event.target.value)} />
                      </label>
                      <label className="field">ราคาต่อหน่วย (บาท)
                        <input required type="number" min="0" step="0.01" value={line.unit_price} onChange={(event) => changeLine(index, 'unit_price', event.target.value)} />
                      </label>
                      <label className="field">ส่วนลด (%)
                        <input required type="number" min="0" max="100" step="0.01" value={line.volume_discount_percent} onChange={(event) => changeLine(index, 'volume_discount_percent', event.target.value)} />
                      </label>
                      <button type="button" className="icon-button danger-text" disabled={lines.length === 1} aria-label={`ลบวัสดุรายการที่ ${index + 1}`} onClick={() => setLines(lines.filter((_, rowIndex) => rowIndex !== index))}><Trash2 size={17} /></button>
                    </div>
                  ))}
                </div>
                <button type="button" className="button soft" disabled={lines.length >= data.materials.length} onClick={() => setLines([...lines, emptyLine()])}><Plus size={16} />เพิ่มวัสดุ</button>
              </section>

              <section className="panel form-panel">
                <h2><FileText size={19} />เงื่อนไขและเอกสาร</h2>
                <label className="field">เงื่อนไขการซื้อขาย <span className="required">*</span>
                  <textarea required rows={7} placeholder="เช่น ราคาตามที่ระบุ ชำระภายใน 30 วัน และส่งมอบตามรอบที่ตกลง" value={terms} onChange={(event) => setTerms(event.target.value)} />
                </label>
                <label className="field">ลิงก์หรือที่อยู่ไฟล์ร่างสัญญา
                  <input placeholder="https://... หรือชื่อไฟล์ PDF" value={documentUrl} onChange={(event) => setDocumentUrl(event.target.value)} />
                </label>
                <p className="hint">ช่องเอกสารเว้นไว้ก่อนได้ แล้วค่อยเพิ่มไฟล์ฉบับลงนามในขั้นตอนถัดไป</p>
              </section>
            </div>
            <aside className="panel order-summary contract-summary">
              <span className="summary-icon"><ScrollText size={24} /></span>
              <h2>สรุปสัญญา</h2>
              <dl>
                <Info label="คู่ค้า">{factory?.company_name || 'ยังไม่ได้เลือก'}</Info>
                <Info label="ระยะเวลา"><CalendarDays size={13} /> {validFrom && validTo ? `${validFrom} – ${validTo}` : 'ยังระบุไม่ครบ'}</Info>
                <Info label="วัสดุ">{lines.filter((line) => line.material_id).length} รายการ</Info>
                <Info label="มูลค่าก่อนส่วนลด">{number(gross)} บาท</Info>
                <Info label="มูลค่าหลังส่วนลด">{number(net)} บาท</Info>
              </dl>
              <div className="summary-note">บันทึกร่างเพื่อกลับมาแก้ไขภายหลัง หรือส่งอนุมัติเมื่อข้อมูลพร้อมแล้ว</div>
              <ErrorBox message={error} />
              <button type="button" className="button primary full" onClick={(event) => void submit(event, 'pending_approval')} disabled={busy}>
                {busy ? 'กำลังบันทึก…' : 'บันทึกและส่งอนุมัติ'}<ArrowRight size={16} />
              </button>
              <button className="button secondary full" disabled={busy}>{contract ? <Save size={16} /> : <ScrollText size={16} />}บันทึกร่าง</button>
              <Link className="button secondary full" to={contract ? `/contracts/${encodeURIComponent(contract.contract_id)}` : '/contracts'}>ยกเลิก</Link>
            </aside>
          </div>
        </fieldset>
      </form>
    </>
  )
}
