package routes

import (
	"net/http"

	"github.com/SA-1-69/T20/backend/internal/controllers"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

// NewRouter receives a database connection so handlers can be tested separately
// from startup and migrations.
func NewRouter(db *gorm.DB) *gin.Engine {
	trucks := controllers.NewTruckController(db)
	lookups := controllers.NewLookupController(db)
	factories := controllers.NewFactoryController(db)
	contracts := controllers.NewSalesContractController(db)
	orders := controllers.NewPurchaseOrderController(db)
	deliveries := controllers.NewDeliveryController(db)
	locations := controllers.NewLocationController()
	drivers := controllers.NewDriverController(db)
	inventory := controllers.NewHandler(db)
	router := gin.New()
	router.Use(gin.Logger(), gin.Recovery())
	_ = router.SetTrustedProxies(nil)
	router.HandleMethodNotAllowed = true
	router.RedirectTrailingSlash = false
	router.GET("/trucks", trucks.ListTrucks)
	router.HEAD("/trucks", trucks.ListTrucks)
	router.POST("/trucks", trucks.CreateTruck)
	router.GET("/trucks/:id", trucks.GetTruck)
	router.HEAD("/trucks/:id", trucks.GetTruck)
	router.PATCH("/trucks/:id", trucks.UpdateTruck)

	router.GET("/factories", lookups.ListFactories)
	router.POST("/factories", factories.Create)
	router.GET("/factories/:id", factories.Get)
	router.PATCH("/factories/:id", factories.Update)
	router.POST("/locations/search", locations.Search)
	router.GET("/materials", lookups.ListMaterials)
	router.GET("/drivers", drivers.List)
	router.POST("/drivers", drivers.Create)
	router.GET("/drivers/:id", drivers.Get)
	router.PATCH("/drivers/:id", drivers.Update)
	router.GET("/sales-staff", lookups.ListSalesStaff)
	router.GET("/transport-supervisors", lookups.ListSupervisors)

	router.GET("/sales-contracts", contracts.List)
	router.POST("/sales-contracts", contracts.Create)
	router.GET("/sales-contracts/:id", contracts.Get)
	router.PATCH("/sales-contracts/:id", contracts.Update)
	router.GET("/sales-contracts/:id/revisions", contracts.ListRevisions)
	router.POST("/sales-contracts/:id/revisions", contracts.CreateRevision)
	router.PATCH("/sales-contracts/:id/revisions/:revisionID", contracts.ReviewRevision)

	router.GET("/purchase-orders", orders.List)
	router.POST("/purchase-orders", orders.Create)
	router.GET("/purchase-orders/:id", orders.Get)
	router.PATCH("/purchase-orders/:id", orders.Update)

	router.GET("/delivery-requests", deliveries.List)
	router.GET("/delivery-requests/:id", deliveries.Get)
	router.PATCH("/delivery-requests/:id", deliveries.Update)
	router.PATCH("/delivery-requests/:id/assignment", deliveries.Assign)
	router.PATCH("/delivery-requests/:id/status", deliveries.UpdateStatus)
	router.POST("/delivery-requests/:id/incidents", deliveries.ReportIncident)
	router.POST("/delivery-requests/:id/cancellation", deliveries.Cancel)

	// ผู้ใช้และข้อมูลคลัง
	router.GET("/users", inventory.ListUsers)
	router.POST("/users", inventory.CreateUser)
	router.GET("/users/:userID", inventory.GetUser)
	router.PATCH("/users/:userID", inventory.UpdateUser)
	router.DELETE("/users/:userID", inventory.DeleteUser)
	router.GET("/document-codes", inventory.ReserveDocumentCode)
	router.POST("/document-codes", inventory.ReserveDocumentCode)

	router.GET("/material-types", inventory.ListMaterialTypes)
	router.POST("/material-types", inventory.CreateMaterialType)
	router.GET("/material-types/:typeID", inventory.GetMaterialType)
	router.PATCH("/material-types/:typeID", inventory.UpdateMaterialType)
	router.DELETE("/material-types/:typeID", inventory.DeleteMaterialType)
	router.POST("/materials", inventory.DocumentWrite((*controllers.Handler).CreateMaterial))
	router.GET("/materials/:materialID", inventory.GetMaterial)
	router.PATCH("/materials/:materialID", inventory.UpdateMaterial)
	router.PATCH("/materials/:materialID/min-stock", inventory.UpdateMaterialMinimumStock)
	router.DELETE("/materials/:materialID", inventory.DeleteMaterial)
	router.GET("/inventory/materials", inventory.ListMaterials)

	router.GET("/warehouses", inventory.ListWarehouses)
	router.POST("/warehouses", inventory.DocumentWrite((*controllers.Handler).CreateWarehouse))
	router.GET("/warehouses/:warehouseID", inventory.GetWarehouse)
	router.PATCH("/warehouses/:warehouseID", inventory.UpdateWarehouse)
	router.DELETE("/warehouses/:warehouseID", inventory.DeleteWarehouse)
	router.GET("/storage-zones", inventory.ListStorageZones)
	router.POST("/storage-zones", inventory.DocumentWrite((*controllers.Handler).CreateStorageZone))
	router.GET("/storage-zones/:zoneID", inventory.GetStorageZone)
	router.PATCH("/storage-zones/:zoneID", inventory.UpdateStorageZone)
	router.DELETE("/storage-zones/:zoneID", inventory.DeleteStorageZone)
	router.POST("/storage-zones/:zoneID/issues", inventory.DocumentWrite((*controllers.Handler).IssueFromZone))
	router.POST("/storage-zones/:zoneID/adjustments", inventory.CreateStockAdjustmentRequest)

	// ประเมิน รับเข้า และเบิกจ่ายวัสดุ
	router.GET("/assessment-sellers", inventory.SearchAssessmentSellers)
	router.GET("/sellers/check-national-id", inventory.CheckSellerNationalID)
	router.GET("/sellers", inventory.ListSellers)
	router.POST("/sellers", inventory.RegisterSeller)
	router.GET("/sellers/:sellerCode", inventory.GetSeller)
	router.PATCH("/sellers/:sellerCode/status", inventory.UpdateSellerStatus)
	router.GET("/assessment-batches", inventory.ListAssessmentBatches)
	router.POST("/assessment-batches", inventory.DocumentWrite((*controllers.Handler).CreateAssessmentBatch))
	router.GET("/assessment-batches/:assessmentBatchID", inventory.GetAssessmentBatch)
	router.POST("/assessment-batches/:assessmentBatchID/assessments", inventory.CreateQualityAssessment)
	router.PATCH("/assessment-batches/:assessmentBatchID/complete", inventory.CompleteAssessmentBatch)
	router.GET("/quality-assessments", inventory.ListQualityAssessments)
	router.GET("/quality-assessments/:assessmentID", inventory.GetQualityAssessment)
	router.POST("/quality-assessments/:assessmentID/purchases", inventory.CreateScrapPurchase)
	router.GET("/scrap-purchases", inventory.ListScrapPurchases)
	router.GET("/scrap-purchases/:purchaseID", inventory.GetScrapPurchase)
	router.PATCH("/scrap-purchases/:purchaseID/payment", inventory.UpdateScrapPurchasePayment)
	router.POST("/scrap-purchases/:purchaseID/transfer", inventory.TransferScrapPurchase)
	router.GET("/pending-warehouse-items", inventory.ListPendingWarehouseItems)
	router.GET("/pending-warehouse-items/:pendingID", inventory.GetPendingWarehouseItem)
	router.GET("/pending-warehouse-items/:pendingID/eligible-zones", inventory.ListEligibleStorageZones)
	router.POST("/pending-warehouse-items/:pendingID/receive", inventory.DocumentWrite((*controllers.Handler).ReceivePendingItem))
	router.GET("/stock-transactions", inventory.ListStockTransactions)
	router.GET("/stock-transactions/:transactionID", inventory.GetStockTransaction)
	router.GET("/receive-transactions", inventory.ListReceiveTransactions)
	router.GET("/receive-transactions/:receiveNo", inventory.GetReceiveTransaction)
	router.GET("/issue-transactions", inventory.ListIssueTransactions)
	router.GET("/issue-transactions/:issueNo", inventory.GetIssueTransaction)

	// คำขอปรับยอด คำร้องเรียน และการรับคืน
	router.GET("/stock-adjustments", inventory.ListStockAdjustmentRequests)
	router.GET("/stock-adjustments/:requestNo", inventory.GetStockAdjustmentRequest)
	router.POST("/stock-adjustments/:requestNo/decision", inventory.DecideStockAdjustment)
	router.GET("/adjustment-approvals", inventory.ListAdjustmentApprovals)
	router.GET("/adjustment-approvals/:approvalID", inventory.GetAdjustmentApproval)
	router.GET("/adjustment-evidence/:filename", inventory.GetAdjustmentEvidence)
	router.GET("/complaints", inventory.ListComplaints)
	router.POST("/complaints", inventory.CreateComplaint)
	router.GET("/complaints/:complaintID", inventory.GetComplaint)
	router.PATCH("/complaints/:complaintID/review", inventory.ReviewComplaint)
	router.GET("/return-records", inventory.ListReturnRecords)
	router.POST("/return-records", inventory.CreateReturnRecord)
	router.NoRoute(func(c *gin.Context) {
		c.JSON(http.StatusNotFound, gin.H{"error": "route not found"})
	})
	router.NoMethod(func(c *gin.Context) {
		c.JSON(http.StatusMethodNotAllowed, gin.H{"error": "method not allowed"})
	})
	return router
}
