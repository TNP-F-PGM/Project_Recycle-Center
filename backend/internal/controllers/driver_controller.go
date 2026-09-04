package controllers

import (
	"errors"
	"net/http"
	"net/mail"
	"regexp"
	"strings"
	"time"

	"github.com/SA-1-69/T20/backend/internal/dto"
	"github.com/SA-1-69/T20/backend/internal/models"
	"github.com/SA-1-69/T20/backend/internal/utils"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

type DriverController struct{ db *gorm.DB }

func NewDriverController(db *gorm.DB) *DriverController { return &DriverController{db} }

// These are staffing rules, not authentication. Replace caller-supplied
// supervisor_id with the authenticated user when the team adds login.
func requireDriverSupervisor(tx *gorm.DB, id string) error {
	if strings.TrimSpace(id) == "" {
		return invalid("supervisor_id is required")
	}
	var count int64
	if err := tx.Model(&models.TransportSupervisor{}).Where("user_id = ?", id).Count(&count).Error; err != nil {
		return err
	}
	if count == 0 {
		return &requestError{http.StatusForbidden, "only a transport supervisor can manage drivers"}
	}
	return nil
}

func driverEligible(d models.Driver) bool {
	// Expiry remains valid throughout its calendar date in Thailand.
	today := time.Now().In(time.FixedZone("ICT", 7*3600)).Format(time.DateOnly)
	return d.Status == "active" && d.LicenseNumber != nil && strings.TrimSpace(*d.LicenseNumber) != "" && d.LicenseExpiry != nil && d.LicenseExpiry.Format(time.DateOnly) >= today
}

func driverResponse(db *gorm.DB, d models.Driver) (dto.DriverResponse, error) {
	var u models.User
	if err := db.First(&u, "user_id = ?", d.UserID).Error; err != nil {
		return dto.DriverResponse{}, err
	}
	r := dto.DriverResponse{EmployeeResponse: dto.EmployeeResponse{EmployeeID: d.EmployeeID, UserID: d.UserID, Name: u.Name, Position: d.Position, HireDate: d.HireDate}, Phone: u.Phone, Email: u.Email, Status: d.Status, LicenseNumber: d.LicenseNumber}
	if d.LicenseExpiry != nil {
		date := d.LicenseExpiry.Format(time.DateOnly)
		r.LicenseExpiry = &date
	}
	var trucks []models.Truck
	if err := db.Where("driver_id = ? AND request_id IS NOT NULL", d.EmployeeID).Limit(1).Find(&trucks).Error; err != nil {
		return r, err
	}
	if len(trucks) > 0 {
		r.ActiveRequestID = trucks[0].RequestID
	}
	r.Eligible = driverEligible(d) && r.ActiveRequestID == nil
	return r, nil
}

func (h *DriverController) List(c *gin.Context) {
	db := h.db.WithContext(c.Request.Context())
	var drivers []models.Driver
	if err := db.Order("employee_id").Find(&drivers).Error; err != nil {
		workflowError(c, err)
		return
	}
	rows := make([]dto.DriverResponse, 0, len(drivers))
	for _, d := range drivers {
		r, err := driverResponse(db, d)
		if err != nil {
			workflowError(c, err)
			return
		}
		rows = append(rows, r)
	}
	c.JSON(http.StatusOK, rows)
}
func (h *DriverController) Get(c *gin.Context) {
	db := h.db.WithContext(c.Request.Context())
	var d models.Driver
	if err := db.First(&d, "employee_id = ?", c.Param("id")).Error; err != nil {
		workflowError(c, err)
		return
	}
	r, err := driverResponse(db, d)
	if err != nil {
		workflowError(c, err)
		return
	}
	c.JSON(http.StatusOK, r)
}
func (h *DriverController) Create(c *gin.Context) { h.save(c, true) }
func (h *DriverController) Update(c *gin.Context) { h.save(c, false) }

var driverPhone = regexp.MustCompile(`^[+0-9() -]{7,25}$`)

func applyDriverInput(in dto.DriverInput, d *models.Driver, u *models.User, create bool) error {
	for _, f := range []struct {
		input  *string
		target *string
	}{{in.Name, &u.Name}, {in.Phone, &u.Phone}, {in.Email, &u.Email}, {in.Position, &d.Position}, {in.Status, &d.Status}} {
		if f.input != nil {
			*f.target = strings.TrimSpace(*f.input)
		}
	}
	if u.Name == "" || len([]rune(u.Name)) > 150 {
		return invalid("driver name is required (maximum 150 characters)")
	}
	if !driverPhone.MatchString(u.Phone) {
		return invalid("driver phone is invalid")
	}
	u.Email = strings.ToLower(u.Email)
	address, err := mail.ParseAddress(u.Email)
	if err != nil || address.Address != u.Email || len(u.Email) > 254 {
		return invalid("driver email is invalid")
	}
	if d.Position == "" || len([]rune(d.Position)) > 100 {
		return invalid("driver position is required")
	}
	if d.Status != "active" && d.Status != "suspended" && d.Status != "resigned" {
		return invalid("invalid driver status")
	}
	if in.HireDate != nil {
		if *in.HireDate == "" {
			return invalid("dates must use YYYY-MM-DD")
		}
		date, err := dateValue(*in.HireDate, time.Time{})
		if err != nil {
			return err
		}
		d.HireDate = date
	}
	if in.LicenseNumber != nil {
		value := strings.TrimSpace(*in.LicenseNumber)
		if value == "" || len([]rune(value)) > 50 {
			return invalid("driver license number is required (maximum 50 characters)")
		}
		d.LicenseNumber = &value
	}
	if in.LicenseExpiry != nil {
		if *in.LicenseExpiry == "" {
			return invalid("dates must use YYYY-MM-DD")
		}
		date, err := dateValue(*in.LicenseExpiry, time.Time{})
		if err != nil {
			return err
		}
		d.LicenseExpiry = &date
	}
	if create && (d.LicenseNumber == nil || d.LicenseExpiry == nil) {
		return invalid("driver license number and expiry are required")
	}
	return nil
}

func (h *DriverController) save(c *gin.Context, create bool) {
	var input dto.DriverInput
	if !utils.ReadJSON(c, &input) {
		return
	}
	if strings.TrimSpace(input.SupervisorID) == "" {
		workflowError(c, invalid("supervisor_id is required"))
		return
	}
	var result dto.DriverResponse
	err := h.db.WithContext(c.Request.Context()).Transaction(func(tx *gorm.DB) error {
		if err := requireDriverSupervisor(tx, strings.TrimSpace(input.SupervisorID)); err != nil {
			return err
		}
		d := models.Driver{Status: "active", Position: "พนักงานขับรถ", HireDate: time.Now()}
		u := models.User{Role: models.RoleDriver}
		if create {
			var err error
			d.EmployeeID, err = utils.GenerateID("DRV")
			if err != nil {
				return err
			}
			u.UserID, err = utils.GenerateID("USR")
			if err != nil {
				return err
			}
			d.UserID = u.UserID
			// An unusable password marker, never a shared/default login password.
			u.Password = "!login-disabled"
		} else {
			if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).First(&d, "employee_id = ?", c.Param("id")).Error; err != nil {
				return err
			}
			if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).First(&u, "user_id = ?", d.UserID).Error; err != nil {
				return err
			}
		}
		if err := applyDriverInput(input, &d, &u, create); err != nil {
			return err
		}
		if !create && d.Status != "active" {
			var count int64
			if err := tx.Model(&models.Truck{}).Where("driver_id = ? AND request_id IS NOT NULL", d.EmployeeID).Count(&count).Error; err != nil {
				return err
			}
			if count > 0 {
				return conflict("reassign or finish the active delivery before suspending or resigning a driver")
			}
		}
		if err := tx.Omit(clause.Associations).Save(&u).Error; err != nil {
			return err
		}
		if err := tx.Omit(clause.Associations).Save(&d).Error; err != nil {
			return err
		}
		var err error
		result, err = driverResponse(tx, d)
		return err
	})
	if errors.Is(err, gorm.ErrDuplicatedKey) {
		err = conflict("driver email or license number already exists")
	}
	if err != nil {
		workflowError(c, err)
		return
	}
	status := http.StatusOK
	if create {
		status = http.StatusCreated
	}
	c.JSON(status, result)
}
