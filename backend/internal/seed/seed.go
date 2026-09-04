// Package seed provides optional demo data for local development and Postman.
package seed

import (
	"fmt"
	"time"

	"github.com/SA-1-69/T20/backend/internal/models"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

// Run adds missing demo records in one transaction. Existing records are never
// updated, so rerunning the seed preserves edits and active delivery assignments.
// The schema must already exist; the seed command runs migrations before Run.
func Run(db *gorm.DB) error {
	return db.Transaction(func(tx *gorm.DB) error {
		// Serialize concurrent seeds, including the material-type lookup below.
		// PostgreSQL releases this transaction lock on commit or rollback.
		if err := tx.Exec("SELECT pg_advisory_xact_lock(20, 1)").Error; err != nil {
			return fmt.Errorf("lock demo seed: %w", err)
		}

		now := time.Now()
		// Example location for demo data only; existing factories are not overwritten.
		latitude, longitude := 13.7563, 100.5018
		hireDate := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, now.Location())
		licenseNumber, licenseExpiry := "DEMO-LICENSE-001", hireDate.AddDate(5, 0, 0)
		// This marker is deliberately not a login credential.
		const disabledPassword = "DEMO_DISABLED_LOGIN"
		users := []models.User{
			{UserID: "DEMO-USER-SALES", Name: "Demo Sales", Phone: "0000000000", Email: "sales@t20.example.test", Password: disabledPassword, Role: models.RoleSales},
			{UserID: "DEMO-USER-SUP", Name: "Demo Supervisor", Phone: "0000000000", Email: "supervisor@t20.example.test", Password: disabledPassword, Role: models.RoleTransportSupervisor},
			{UserID: "DEMO-USER-DRIVER", Name: "Demo Driver", Phone: "0000000000", Email: "driver@t20.example.test", Password: disabledPassword, Role: models.RoleDriver},
		}

		// Parent records precede their foreign-key references.
		for _, step := range []struct {
			name  string
			key   string
			value any
		}{
			{"users", "user_id", &users},
			{"sales staff", "employee_id", &models.SalesStaff{
				EmployeeID: "DEMO-S001", UserID: "DEMO-USER-SALES", Position: "Sales", HireDate: hireDate,
			}},
			{"transport supervisor", "employee_id", &models.TransportSupervisor{
				EmployeeID: "DEMO-SUP001", UserID: "DEMO-USER-SUP", Position: "Transport supervisor", HireDate: hireDate,
			}},
			{"driver", "employee_id", &models.Driver{
				EmployeeID: "DEMO-D001", UserID: "DEMO-USER-DRIVER", Position: "Driver", HireDate: hireDate, Status: "active", LicenseNumber: &licenseNumber, LicenseExpiry: &licenseExpiry,
			}},
			{"factory", "factory_id", &models.Factory{
				FactoryID: "DEMO-F001", CompanyName: "Demo Factory", ContactPerson: "Demo Contact", Phone: "0000000000", Address: "Demo factory address",
				Latitude: &latitude, Longitude: &longitude,
			}},
		} {
			if err := createMissing(tx, step.key, step.value); err != nil {
				return fmt.Errorf("seed %s: %w", step.name, err)
			}
		}

		var materialType models.MaterialType
		if err := tx.Where(models.MaterialType{TypeName: "Demo recyclable materials"}).
			Order("type_id").FirstOrCreate(&materialType).Error; err != nil {
			return fmt.Errorf("seed material type: %w", err)
		}
		materials := []models.Material{
			{MaterialID: "DEMO-M001", MaterialName: "Demo Steel", Unit: "kg", Status: "active", Grade: "A", MaterialTypeID: materialType.TypeID},
			{MaterialID: "DEMO-M002", MaterialName: "Demo Copper", Unit: "kg", Status: "active", Grade: "A", MaterialTypeID: materialType.TypeID},
		}
		if err := createMissing(tx, "material_id", &materials); err != nil {
			return fmt.Errorf("seed materials: %w", err)
		}
		truck := models.Truck{
			TruckID: "DEMO-TR001", LicensePlate: "DEMO-TRUCK-001", Status: "available", Capacity: 5000,
		}
		if err := createMissing(tx, "truck_id", &truck); err != nil {
			return fmt.Errorf("seed truck: %w", err)
		}
		return nil
	})
}

func createMissing(db *gorm.DB, primaryKey string, value any) error {
	return db.Omit(clause.Associations).Clauses(clause.OnConflict{
		Columns:   []clause.Column{{Name: primaryKey}},
		DoNothing: true,
	}).Create(value).Error
}
