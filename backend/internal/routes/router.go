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
	orders := controllers.NewPurchaseOrderController(db)
	deliveries := controllers.NewDeliveryController(db)
	locations := controllers.NewLocationController()
	drivers := controllers.NewDriverController(db)
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
	router.NoRoute(func(c *gin.Context) {
		c.JSON(http.StatusNotFound, gin.H{"error": "route not found"})
	})
	router.NoMethod(func(c *gin.Context) {
		c.JSON(http.StatusMethodNotAllowed, gin.H{"error": "method not allowed"})
	})
	return router
}
