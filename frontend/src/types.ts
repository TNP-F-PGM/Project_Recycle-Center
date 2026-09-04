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
