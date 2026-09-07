export type Role = 'transport' | 'sales' | 'driver'
export interface Workspace {
  role: Role
  employeeId: string
}
export interface Employee {
  employee_id: string
  user_id: string
  name: string
  position: string
}
export interface Factory {
  latitude: number | null
  longitude: number | null
  factory_id: string
  company_name: string
  contact_person: string
  phone: string
  address: string
}
export interface Driver extends Employee {
  phone: string
  email: string
  hire_date: string
  status: 'active' | 'suspended' | 'resigned'
  license_number: string | null
  license_expiry: string | null
  active_request_id: string | null
  eligible: boolean
}
export interface Material {
  material_id: string
  material_name: string
  unit: string
  status: string
  grade: string
  type_name: string
}
export type ContractStatus =
  | 'draft'
  | 'pending_approval'
  | 'pending_signature'
  | 'active'
  | 'expired'
  | 'cancelled'
export type RevisionStatus = 'pending_review' | 'pending_signature' | 'completed' | 'rejected'
export interface ContractMaterial {
  contract_id: string
  material_id: string
  contract_quantity: number
  unit_price: number
  volume_discount_percent: number
}
export interface ContractRevision {
  revision_id: string
  contract_id: string
  request_type: 'renewal' | 'price_change' | 'discount_change' | 'terms_change' | 'mixed'
  reason: string
  original_valid_to: string
  new_valid_to: string | null
  original_terms: string
  new_terms: string | null
  price_adjustment_percent: number | null
  new_volume_discount_percent: number | null
  draft_document: string | null
  signed_document: string | null
  request_status: RevisionStatus
  requested_by: string
  requested_at: string
  reviewed_by: string | null
  reviewed_at: string | null
  review_note: string | null
}
export interface SalesContract {
  contract_id: string
  contract_date: string
  valid_from: string
  valid_to: string
  status: ContractStatus
  terms: string
  document_url: string | null
  factory_id: string
  sales_staff_id: string
  created_at: string
  updated_at: string
  factory?: Factory | null
  materials: ContractMaterial[]
  revisions?: ContractRevision[]
}
export interface Truck {
  truck_id: string
  license_plate: string
  status: string
  capacity: number
  driver_id: string | null
  request_id: string | null
}
export interface OrderRow {
  order_id: string
  factory_id: string
  sales_staff_id: string
  order_date: string
  status: string
  request_id: string | null
}
export interface Order extends OrderRow {
  factory: Factory | null
  materials: {
    material_id: string
    material_name: string
    unit: string
    requested_quantity: number
  }[]
}
export interface DeliveryRow {
  destination_latitude?: number
  destination_longitude?: number
  has_coordinates?: boolean
  request_id: string
  order_id: string
  customer_name: string
  address: string
  request_date: string
  status: string
  supervisor_id: string | null
  truck_id: string | null
  driver_id: string | null
}
export interface Delivery extends Omit<DeliveryRow, 'truck_id' | 'driver_id'> {
  incidents: DeliveryIncident[]
  has_coordinates?: boolean
  phone_number: string
  destination_latitude: number
  destination_longitude: number
  materials: {
    material_id: string
    material_name: string
    unit: string
    delivery_quantity: number
  }[]
  assignment: { truck_id: string; driver_id: string; assigned_at: string } | null
  cancellation: {
    cancel_id: string
    truck_id: string | null
    cancel_date: string
    reason?: string
    supervisor_id?: string | null
  } | null
}
export interface DeliveryIncident {
  incident_id: string
  truck_id: string
  driver_id: string
  reason: string
  details: string
  previous_status: string
  reported_at: string
  resolved_at: string | null
  supervisor_id: string | null
  resolution: string
  resolution_note: string
  replacement_truck_id: string | null
  replacement_driver_id: string | null
}
export interface AppData {
  factories: Factory[]
  materials: Material[]
  trucks: Truck[]
  orders: OrderRow[]
  deliveries: DeliveryRow[]
  sales: Employee[]
  supervisors: Employee[]
  drivers: Driver[]
}
