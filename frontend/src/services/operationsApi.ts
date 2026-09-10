import { api } from './api'
import type {
  AssessmentBatch,
  AssessmentSellerOption,
  CreateAdjustmentInput,
  CreateAssessmentBatchInput,
  CreateAssessmentInput,
  CreateWarehouseInput,
  CreateZoneInput,
  EligibleStorageZone,
  InventoryMaterial,
  IssueFromZoneInput,
  PendingWarehouseItem,
  QualityAssessment,
  ReceivePendingInput,
  StockAdjustment,
  StockDecisionInput,
  StockTransaction,
  StorageZone,
  UpdateZoneInput,
  Warehouse,
} from '../types'

function resource(path: string, id: string | number) {
  return `${path}/${encodeURIComponent(String(id))}`
}

type EligibleWarehouse = {
  warehouseID: string
  currentQuantity: number
  totalCapacity: number
  unit: string
  zones: Omit<EligibleStorageZone, 'warehouseID'>[]
}

export const operationsApi = {
  listInventoryMaterials: () => api<InventoryMaterial[]>('/inventory/materials'),
  updateMinimumStock: (materialID: string, minStockLevel: number) =>
    api(`${resource('/materials', materialID)}/min-stock`, 'PATCH', { minStockLevel }),
  listWarehouses: () => api<Warehouse[]>('/warehouses'),
  listZones: () => api<StorageZone[]>('/storage-zones'),
  createWarehouse: (input: CreateWarehouseInput) => api<Warehouse>('/warehouses', 'POST', input),
  createZone: (input: CreateZoneInput) => api<StorageZone>('/storage-zones', 'POST', input),
  updateZone: (zoneID: string, input: UpdateZoneInput) =>
    api<StorageZone>(resource('/storage-zones', zoneID), 'PATCH', input),
  deleteZone: (zoneID: string) => api<void>(resource('/storage-zones', zoneID), 'DELETE'),

  searchAssessmentSellers: (query: string) =>
    api<AssessmentSellerOption[]>(
      `/assessment-sellers?q=${encodeURIComponent(query.trim())}`,
    ),
  listAssessmentBatches: () => api<AssessmentBatch[]>('/assessment-batches'),
  listAssessments: () => api<QualityAssessment[]>('/quality-assessments'),
  createAssessmentBatch: (input: CreateAssessmentBatchInput) =>
    api<AssessmentBatch>('/assessment-batches', 'POST', input),
  addAssessment: (batchID: string, input: CreateAssessmentInput) =>
    api<QualityAssessment>(
      `${resource('/assessment-batches', batchID)}/assessments`,
      'POST',
      input,
    ),
  completeAssessmentBatch: (batchID: string) =>
    api<AssessmentBatch>(`${resource('/assessment-batches', batchID)}/complete`, 'PATCH'),

  listPendingItems: () => api<PendingWarehouseItem[]>('/pending-warehouse-items'),
  getPendingItem: (pendingID: number) =>
    api<PendingWarehouseItem>(resource('/pending-warehouse-items', pendingID)),
  listEligibleZones: async (pendingID: number) => {
    const warehouses = await api<EligibleWarehouse[]>(
      `${resource('/pending-warehouse-items', pendingID)}/eligible-zones`,
    )
    return warehouses.flatMap((warehouse) =>
      warehouse.zones.map((zone) => ({ ...zone, warehouseID: warehouse.warehouseID })),
    )
  },
  receivePendingItem: (pendingID: number, input: ReceivePendingInput) =>
    api(`${resource('/pending-warehouse-items', pendingID)}/receive`, 'POST', input),
  issueFromZone: (zoneID: string, input: IssueFromZoneInput) =>
    api(`${resource('/storage-zones', zoneID)}/issues`, 'POST', input),

  listStockTransactions: () => api<StockTransaction[]>('/stock-transactions'),
  listReceiveTransactions: () => api<unknown[]>('/receive-transactions'),
  listIssueTransactions: () => api<unknown[]>('/issue-transactions'),
  listAdjustments: () => api<StockAdjustment[]>('/stock-adjustments'),
  createAdjustment: (zoneID: string, input: CreateAdjustmentInput) =>
    api<StockAdjustment>(`${resource('/storage-zones', zoneID)}/adjustments`, 'POST', input),
  decideAdjustment: (requestNo: number, input: StockDecisionInput) =>
    api<StockAdjustment>(`${resource('/stock-adjustments', requestNo)}/decision`, 'POST', input),
}
