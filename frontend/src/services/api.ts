export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message)
  }
}

// Vite forwards /api to Gin. Browser requests stay on the same origin.
export async function api<T>(
  path: string,
  method = 'GET',
  body?: unknown,
  signal?: AbortSignal,
): Promise<T> {
  let response: Response
  try {
    response = await fetch(`/api${path}`, {
      method,
      signal: signal
        ? AbortSignal.any([signal, AbortSignal.timeout(15000)])
        : AbortSignal.timeout(15000),
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  } catch (error) {
    if (signal?.aborted) throw error
    throw new ApiError(
      0,
      'เชื่อมต่อระบบไม่ได้ กรุณาตรวจว่าเปิด API และฐานข้อมูลแล้ว แล้วลองอีกครั้ง',
    )
  }
  const payload = await response.json().catch(() => null)
  if (!response.ok)
    throw new ApiError(response.status, payload?.error || 'ระบบไม่พร้อมใช้งาน กรุณาลองอีกครั้ง')
  return payload as T
}

const translations: Record<string, string> = {
  'only a transport supervisor can manage drivers':
    'เฉพาะหัวหน้าขนส่งเท่านั้นที่จัดการข้อมูลคนขับได้',
  'supervisor_id is required': 'กรุณาเลือกผู้ใช้งานหัวหน้าขนส่งก่อน',
  'driver name is required (maximum 150 characters)': 'กรุณากรอกชื่อคนขับไม่เกิน 150 ตัวอักษร',
  'driver phone is invalid':
    'กรุณากรอกเบอร์โทร 7–25 ตัวอักษร ใช้ตัวเลข + วงเล็บ ขีด หรือช่องว่างได้',
  'driver email is invalid': 'กรุณากรอกอีเมลให้ถูกต้อง',
  'driver position is required': 'กรุณากรอกตำแหน่งไม่เกิน 100 ตัวอักษร',
  'invalid driver status': 'สถานะพนักงานไม่ถูกต้อง',
  'driver license number is required (maximum 50 characters)':
    'กรุณากรอกเลขใบขับขี่ไม่เกิน 50 ตัวอักษร',
  'driver license number and expiry are required': 'กรุณากรอกเลขใบขับขี่และวันหมดอายุให้ครบ',
  'dates must use YYYY-MM-DD': 'กรุณาระบุวันที่ให้ถูกต้อง',
  'driver email or license number already exists':
    'อีเมลหรือเลขใบขับขี่นี้มีอยู่แล้ว กรุณาตรวจสอบข้อมูลเดิม',
  'driver must be active with a valid license':
    'คนขับต้องทำงานอยู่และมีข้อมูลใบขับขี่ที่ยังไม่หมดอายุ กรุณาตรวจที่หน้าพนักงานขับรถ',
  'reassign or finish the active delivery before suspending or resigning a driver':
    'คนขับยังมีงานอยู่ กรุณาเปลี่ยนผู้รับงานหรือจบงานก่อนตั้งเป็นพักงานหรือลาออก',
  'driver_id and incident details (1-2000 characters) are required':
    'กรุณาเลือกคนขับและกรอกรายละเอียดปัญหา 1–2,000 ตัวอักษร',
  'invalid incident reason': 'กรุณาเลือกประเภทปัญหา',
  'incidents can only be reported for assigned or in-transit deliveries':
    'แจ้งปัญหาได้หลังมอบหมายงานหรือระหว่างขนส่ง กรุณารีเฟรชสถานะงาน',
  'only the assigned driver can report an incident':
    'เฉพาะคนขับที่ได้รับงานนี้เท่านั้นที่แจ้งปัญหาได้',
  'incident_id and resolution_note are required':
    'กรุณาเลือกรายการปัญหาและกรอกวิธีแก้ไขไม่เกิน 2,000 ตัวอักษร',
  'incident was already resolved or does not belong to this delivery':
    'ปัญหานี้ถูกแก้ไขแล้วหรือไม่ตรงกับงาน กรุณารีเฟรช',
  'supervisor_id and cancellation reason are required': 'กรุณาเลือกหัวหน้าขนส่งและกรอกเหตุผลยกเลิก',
  'only a transport supervisor can cancel delivery':
    'เฉพาะหัวหน้าขนส่งเท่านั้นที่ยกเลิกการจัดส่งได้',
  'confirm material handling before cancelling an interrupted delivery':
    'กรุณายืนยันการประสานฝ่ายขายและการจัดการวัสดุก่อนยกเลิก',
  'cancellation requires a pending, assigned, or on-hold delivery':
    'งานที่กำลังขนส่งต้องแจ้งปัญหาให้หยุดรอแก้ไขก่อน งานที่สิ้นสุดแล้วจะยกเลิกไม่ได้',
  'only the assigned driver can update delivery status':
    'เฉพาะคนขับที่ได้รับงานนี้เท่านั้นที่แจ้งเริ่มเดินทางหรือส่งสำเร็จได้',
  'driver_id is required to update delivery status':
    'กรุณาเลือกพื้นที่ทำงานของคนขับที่ได้รับงานนี้',
  'factory latitude and longitude are required': 'กรุณาปักหมุดหรือกรอกพิกัดโรงงานให้ครบทั้งคู่',
  'provide both factory coordinates': 'กรุณากรอกละติจูดและลองจิจูดโรงงานให้ครบทั้งคู่',
  'factory has no coordinates; save its location before creating an order':
    'โรงงานนี้ยังไม่มีพิกัด กรุณาแก้ไขโรงงานและปักหมุดก่อนสร้างคำขอซื้อ',
  'truck already has an active delivery':
    'รถคันนี้ถูกมอบหมายให้กับงานอื่นแล้ว กรุณารีเฟรชและเลือกใหม่',
  'driver already has an active delivery': 'คนขับคนนี้มีงานที่กำลังดำเนินการอยู่ กรุณาเลือกคนอื่น',
  'truck must be available': 'รถคันนี้ยังไม่พร้อมใช้งาน กรุณาเลือกรถที่ว่าง',
  'order can only be edited while delivery is pending': 'แก้ไขคำขอซื้อได้เฉพาะก่อนจัดรถเท่านั้น',
  'delivery details can only be edited while pending':
    'แก้ไขรายละเอียดได้เฉพาะงานที่รอมอบหมายเท่านั้น',
  'only deliveries that have not departed can be cancelled': 'ยกเลิกได้เฉพาะงานที่ยังไม่ออกเดินทาง',
  'license_plate already exists': 'ทะเบียนรถนี้มีอยู่ในระบบแล้ว',
  'truck_id or license_plate already exists': 'รหัสรถหรือทะเบียนรถนี้มีอยู่ในระบบแล้ว',
  'record not found': 'ไม่พบรายการนี้ในระบบ',
  'truck not found': 'ไม่พบรถคันนี้ในระบบ',
  'delivery must move from assigned to in_transit to delivered':
    'สถานะงานเปลี่ยนไปแล้ว กรุณารีเฟรชก่อนดำเนินการ',
}
export function errorText(error: unknown) {
  const message = error instanceof Error ? error.message : 'เกิดข้อผิดพลาด กรุณาลองอีกครั้ง'
  return translations[message] || message
}
