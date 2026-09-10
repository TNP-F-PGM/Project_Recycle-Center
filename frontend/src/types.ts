export type Role =
  | 'transport'
  | 'sales'
  | 'driver'
  | 'customer_service'
  | 'purchasing'
  | 'manager'
  | 'quality'
  | 'warehouse'
  | 'warehouse_manager'
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
  'draft' | 'pending_approval' | 'pending_signature' | 'active' | 'expired' | 'cancelled'
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

export interface Warehouse {
  warehouseID: string
  currentQuantity: number
  totalCapacity: number
  lastUpdated: string
  minStock: number
  unit: string
  storageZones?: StorageZone[]
}

export interface InventoryMaterial {
  materialID: string
  materialName: string
  unit: string
  status: string
  grade: string
  currentQuantity: number
  minStockLevel: number
  minimumStockConfigured: boolean
  belowMin: boolean
  materialTypeID: number
  materialType?: { typeID: number; typeName: string }
  warehouseStocks: { warehouseID: string; quantity: number }[]
}

export interface StorageZone {
  zoneID: string
  zoneName: string
  capacity: number
  supportedGrade: string
  lastUpdated: string
  stockStatus: string
  quantityOnHand: number
  warehouseID: string
  materialTypeID: number
  materialID: string
  material?: InventoryMaterial
}

export interface QualityAssessment {
  assessmentID: number
  assessedGrade: string
  cleanlinessLevel: string
  result: string
  detail?: string | null
  assessedQuantity: number
  assessedAt: string
  assessmentBatchID: string
  materialID: string
  material?: InventoryMaterial
  assessmentBatch?: { assessmentBatchID: string; sellerCode: string; employeeID: string }
  scrapPurchaseItem?: ScrapPurchase | null
}

export interface ScrapPurchase {
  purchaseID: string
  paymentID?: string | null
  purchaseDate: string
  sellerCode: string
  wasteType: string
  weight: number
  pricePerKg: number
  totalAmount: number
  employeeID: string
  materialID: string
  assessmentID: number
  material?: InventoryMaterial
  pendingWarehouseItem?: PendingWarehouseItem | null
}

export interface AssessmentBatch {
  assessmentBatchID: string
  sellerCode: string
  employeeID: string
  assessmentDate: string
  status: string
  assessments: QualityAssessment[]
}

export interface PendingWarehouseItem {
  pendingID: number
  quantity: number
  assessedGrade: string
  assessedBy: string
  transferredDate: string
  stockRouteType: string
  purchaseID: string
  receivingStatus: string
  materialID: string
  material?: InventoryMaterial
  receivedZoneID?: string
  remainingCapacityAfter?: number
}

export interface StockTransaction {
  transactionID: number
  quantity: number
  transactionDate: string
  employeeID: string
  zoneID: string
  balanceAfter: number
  zone?: StorageZone
  receiveTransaction?: { receiveNo: string }
  issueTransaction?: { issueNo: string; referenceNo: string; requestingUnit: string }
}

export interface StockAdjustment {
  requestNo: number
  systemQuantity: number
  countedQuantity: number
  description: string
  attachmentURL?: string | null
  requestDate: string
  status: string
  employeeID: string
  zoneID: string
  zone?: StorageZone
}

export interface Complaint {
  complaint_id: string
  complaint_date: string
  problem_description: string
  evidence_file: string
  status: string
  result?: string | null
  rejection_reason?: string | null
  reviewed_by?: string | null
  order_id: string
}

export interface Seller {
  seller_code: string
  national_id: string
  user_id: string
  name: string
  phone: string
  email: string
  address: string
  seller_type: string
  account_status: 'active' | 'suspended'
  suspended_reason?: string
  registration_date: string
  identity_documents?: string[]
  purchasing_staff_id?: string | null
}

export interface ReturnRecord {
  return_id: string
  return_date: string
  return_quantity: number
  processed_by: string
  warehouse_id: string
  complaint_id: string
}

export interface AssessmentSellerOption {
  sellerCode: string
  name: string
}

export interface EligibleStorageZone {
  zoneID: string
  zoneName: string
  capacity: number
  quantityOnHand: number
  availableCapacity: number
  supportedGrade: string
  stockStatus: string
  warehouseID?: string
}

export interface CreateAssessmentBatchInput {
  sellerCode: string
  employeeID: string
  requestID: string
}

export interface CreateAssessmentInput {
  materialID: string
  assessedQuantity: number
  assessedGrade: string
  cleanlinessLevel: string
  result: string
  detail: string | null
}

export interface ReceivePendingInput {
  receiveNo: string
  zoneID: string
  employeeID: string
  quantity: number
  requestID: string
}

export interface IssueFromZoneInput {
  issueNo: string
  referenceNo: string
  requestingUnit: string
  employeeID: string
  quantity: number
  requestID: string
}

export interface CreateAdjustmentInput {
  countedQuantity: number
  description: string
  attachmentURL?: string | null
  employeeID: string
}

export interface StockDecisionInput {
  employeeID: string
  decision: 'approved' | 'rejected'
  approvedQuantity?: number
  decisionReason?: string | null
}

export interface CreateWarehouseInput {
  totalCapacity: number
  minStock: number
  unit: string
  requestID: string
}

export interface CreateZoneInput {
  zoneName: string
  capacity: number
  supportedGrade: string
  stockStatus: string
  warehouseID: string
  materialTypeID: number
  materialID: string
  requestID: string
}

export interface UpdateZoneInput {
  zoneName?: string
  capacity?: number
  supportedGrade?: string
  stockStatus?: string
}
