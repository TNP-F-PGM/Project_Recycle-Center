package controllers

import (
	"net/http"
	"strings"
	"time"

	"github.com/SA-1-69/T20/backend/internal/dto"
	"github.com/SA-1-69/T20/backend/internal/models"
	"github.com/SA-1-69/T20/backend/internal/utils"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

type SalesContractController struct{ db *gorm.DB }

func NewSalesContractController(db *gorm.DB) *SalesContractController {
	return &SalesContractController{db: db}
}

func contractDetails(db *gorm.DB, id string) (models.SalesContract, error) {
	var contract models.SalesContract
	err := db.Preload("Factory").Preload("SalesStaff").
		Preload("Materials", func(q *gorm.DB) *gorm.DB { return q.Order("material_id") }).
		Preload("Materials.Material").
		Preload("Revisions", func(q *gorm.DB) *gorm.DB { return q.Order("requested_at DESC") }).
		First(&contract, "contract_id = ?", id).Error
	return contract, err
}

func requiredContractDate(value, name string) (time.Time, error) {
	value, err := requireText(value, name)
	if err != nil {
		return time.Time{}, err
	}
	parsed, err := time.Parse(time.DateOnly, value)
	if err != nil {
		return time.Time{}, invalid(name + " must use YYYY-MM-DD")
	}
	return parsed, nil
}

func validContractStatus(status string) bool {
	switch status {
	case "draft", "pending_approval", "pending_signature", "active", "expired", "cancelled":
		return true
	default:
		return false
	}
}

func validContractTransition(from, to string) bool {
	if from == to {
		return true
	}
	allowed := map[string]map[string]bool{
		"draft":             {"pending_approval": true, "cancelled": true},
		"pending_approval":  {"draft": true, "pending_signature": true, "cancelled": true},
		"pending_signature": {"draft": true, "active": true, "cancelled": true},
		"active":            {"expired": true, "cancelled": true},
	}
	return allowed[from][to]
}

func normalizeContractMaterials(items []dto.SalesContractMaterialInput) error {
	if len(items) == 0 {
		return invalid("materials must contain at least one item")
	}
	seen := make(map[string]bool, len(items))
	for i := range items {
		items[i].MaterialID = strings.TrimSpace(items[i].MaterialID)
		if items[i].MaterialID == "" {
			return invalid("each contract material needs material_id")
		}
		if items[i].ContractQuantity <= 0 {
			return invalid("contract_quantity must be greater than zero")
		}
		if items[i].UnitPrice < 0 {
			return invalid("unit_price cannot be negative")
		}
		if items[i].VolumeDiscountPercent < 0 || items[i].VolumeDiscountPercent > 100 {
			return invalid("volume_discount_percent must be between 0 and 100")
		}
		if seen[items[i].MaterialID] {
			return invalid("materials must not contain duplicate material_id values")
		}
		seen[items[i].MaterialID] = true
	}
	return nil
}

func saveContractMaterials(tx *gorm.DB, contractID string, items []dto.SalesContractMaterialInput) error {
	lines := make([]models.SalesContractMaterial, 0, len(items))
	for _, item := range items {
		if err := requireReference(tx, "materials", "material_id", item.MaterialID); err != nil {
			return err
		}
		lines = append(lines, models.SalesContractMaterial{
			ContractID: contractID, MaterialID: item.MaterialID,
			ContractQuantity: item.ContractQuantity, UnitPrice: item.UnitPrice,
			VolumeDiscountPercent: item.VolumeDiscountPercent,
		})
	}
	return tx.Omit(clause.Associations).Create(&lines).Error
}

func (h *SalesContractController) List(c *gin.Context) {
	contracts := make([]models.SalesContract, 0)
	query := h.db.WithContext(c.Request.Context()).Preload("Factory").
		Preload("Materials", func(q *gorm.DB) *gorm.DB { return q.Order("material_id") }).
		Preload("Materials.Material")
	if factoryID := strings.TrimSpace(c.Query("factory_id")); factoryID != "" {
		query = query.Where("factory_id = ?", factoryID)
	}
	if status := strings.TrimSpace(c.Query("status")); status != "" {
		query = query.Where("status = ?", status)
	}
	if err := query.Order("contract_date DESC, contract_id").Find(&contracts).Error; err != nil {
		workflowError(c, err)
		return
	}
	c.JSON(http.StatusOK, contracts)
}

func (h *SalesContractController) Get(c *gin.Context) {
	contract, err := contractDetails(h.db.WithContext(c.Request.Context()), c.Param("id"))
	if err != nil {
		workflowError(c, err)
		return
	}
	c.JSON(http.StatusOK, contract)
}

func (h *SalesContractController) Create(c *gin.Context) {
	var input dto.CreateSalesContractRequest
	if !utils.ReadJSON(c, &input) {
		return
	}
	var err error
	if input.FactoryID, err = requireText(input.FactoryID, "factory_id"); err != nil {
		workflowError(c, err)
		return
	}
	if input.SalesStaffID, err = requireText(input.SalesStaffID, "sales_staff_id"); err != nil {
		workflowError(c, err)
		return
	}
	if input.Terms, err = requireText(input.Terms, "terms"); err != nil {
		workflowError(c, err)
		return
	}
	if err = normalizeContractMaterials(input.Materials); err != nil {
		workflowError(c, err)
		return
	}
	contractDate, err := requiredContractDate(input.ContractDate, "contract_date")
	if err != nil {
		workflowError(c, err)
		return
	}
	validFrom, err := requiredContractDate(input.ValidFrom, "valid_from")
	if err != nil {
		workflowError(c, err)
		return
	}
	validTo, err := requiredContractDate(input.ValidTo, "valid_to")
	if err != nil {
		workflowError(c, err)
		return
	}
	if validTo.Before(validFrom) {
		workflowError(c, invalid("valid_to cannot be before valid_from"))
		return
	}
	input.Status = strings.TrimSpace(input.Status)
	if input.Status == "" {
		input.Status = "draft"
	}
	if input.Status != "draft" && input.Status != "pending_approval" {
		workflowError(c, invalid("a new contract must be draft or pending_approval"))
		return
	}
	input.ContractID = strings.TrimSpace(input.ContractID)
	if input.ContractID == "" {
		input.ContractID, err = utils.GenerateID("CON")
		if err != nil {
			workflowError(c, err)
			return
		}
	}
	var documentURL *string
	if value := strings.TrimSpace(input.DocumentURL); value != "" {
		documentURL = &value
	}
	var result models.SalesContract
	err = h.db.WithContext(c.Request.Context()).Transaction(func(tx *gorm.DB) error {
		if err := requireReference(tx, "factories", "factory_id", input.FactoryID); err != nil {
			return err
		}
		if err := requireReference(tx, "sales_staff", "employee_id", input.SalesStaffID); err != nil {
			return err
		}
		contract := models.SalesContract{
			ContractID: input.ContractID, FactoryID: input.FactoryID, SalesStaffID: input.SalesStaffID,
			ContractDate: contractDate, ValidFrom: validFrom, ValidTo: validTo,
			Status: input.Status, Terms: input.Terms, DocumentURL: documentURL,
		}
		if err := tx.Omit(clause.Associations).Create(&contract).Error; err != nil {
			return err
		}
		if err := saveContractMaterials(tx, contract.ContractID, input.Materials); err != nil {
			return err
		}
		result, err = contractDetails(tx, contract.ContractID)
		return err
	})
	if err != nil {
		workflowError(c, err)
		return
	}
	c.JSON(http.StatusCreated, result)
}

func (h *SalesContractController) Update(c *gin.Context) {
	var input dto.UpdateSalesContractRequest
	if !utils.ReadJSON(c, &input) {
		return
	}
	if !input.FactoryID.Present && !input.SalesStaffID.Present && !input.ContractDate.Present &&
		!input.ValidFrom.Present && !input.ValidTo.Present && !input.Status.Present &&
		!input.Terms.Present && !input.DocumentURL.Present && !input.Materials.Present {
		workflowError(c, invalid("provide at least one contract field"))
		return
	}
	if input.Materials.Present {
		if err := normalizeContractMaterials(input.Materials.Value); err != nil {
			workflowError(c, err)
			return
		}
	}
	var result models.SalesContract
	err := h.db.WithContext(c.Request.Context()).Transaction(func(tx *gorm.DB) error {
		var contract models.SalesContract
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).First(&contract, "contract_id = ?", c.Param("id")).Error; err != nil {
			return err
		}
		contentChanged := input.FactoryID.Present || input.SalesStaffID.Present || input.ContractDate.Present ||
			input.ValidFrom.Present || input.ValidTo.Present || input.Terms.Present || input.Materials.Present
		if contentChanged && contract.Status != "draft" && contract.Status != "pending_approval" {
			return conflict("contract details can only be edited while draft or pending_approval")
		}
		updates := make(map[string]any)
		if input.FactoryID.Present {
			value, err := requireText(input.FactoryID.Value, "factory_id")
			if err != nil {
				return err
			}
			if err := requireReference(tx, "factories", "factory_id", value); err != nil {
				return err
			}
			updates["factory_id"] = value
		}
		if input.SalesStaffID.Present {
			value, err := requireText(input.SalesStaffID.Value, "sales_staff_id")
			if err != nil {
				return err
			}
			if err := requireReference(tx, "sales_staff", "employee_id", value); err != nil {
				return err
			}
			updates["sales_staff_id"] = value
		}
		contractDate, validFrom, validTo := contract.ContractDate, contract.ValidFrom, contract.ValidTo
		var err error
		if input.ContractDate.Present {
			contractDate, err = requiredContractDate(input.ContractDate.Value, "contract_date")
			if err != nil {
				return err
			}
			updates["contract_date"] = contractDate
		}
		if input.ValidFrom.Present {
			validFrom, err = requiredContractDate(input.ValidFrom.Value, "valid_from")
			if err != nil {
				return err
			}
			updates["valid_from"] = validFrom
		}
		if input.ValidTo.Present {
			validTo, err = requiredContractDate(input.ValidTo.Value, "valid_to")
			if err != nil {
				return err
			}
			updates["valid_to"] = validTo
		}
		if validTo.Before(validFrom) {
			return invalid("valid_to cannot be before valid_from")
		}
		if input.Terms.Present {
			value, err := requireText(input.Terms.Value, "terms")
			if err != nil {
				return err
			}
			updates["terms"] = value
		}
		if input.DocumentURL.Present {
			value := strings.TrimSpace(input.DocumentURL.Value)
			if value == "" {
				updates["document_url"] = nil
			} else {
				updates["document_url"] = value
			}
		}
		if input.Status.Present {
			status := strings.TrimSpace(input.Status.Value)
			if !validContractStatus(status) {
				return invalid("invalid contract status")
			}
			if !validContractTransition(contract.Status, status) {
				return conflict("contract status transition is not allowed")
			}
			updates["status"] = status
		}
		if len(updates) > 0 {
			if err := tx.Model(&contract).Updates(updates).Error; err != nil {
				return err
			}
		}
		if input.Materials.Present {
			if err := tx.Where("contract_id = ?", contract.ContractID).Delete(&models.SalesContractMaterial{}).Error; err != nil {
				return err
			}
			if err := saveContractMaterials(tx, contract.ContractID, input.Materials.Value); err != nil {
				return err
			}
		}
		result, err = contractDetails(tx, contract.ContractID)
		return err
	})
	if err != nil {
		workflowError(c, err)
		return
	}
	c.JSON(http.StatusOK, result)
}

func validRevisionType(value string) bool {
	switch value {
	case "renewal", "price_change", "discount_change", "terms_change", "mixed":
		return true
	default:
		return false
	}
}

func (h *SalesContractController) CreateRevision(c *gin.Context) {
	var input dto.CreateContractRevisionRequest
	if !utils.ReadJSON(c, &input) {
		return
	}
	input.RequestType = strings.TrimSpace(input.RequestType)
	if !validRevisionType(input.RequestType) {
		workflowError(c, invalid("invalid request_type"))
		return
	}
	var err error
	if input.Reason, err = requireText(input.Reason, "reason"); err != nil {
		workflowError(c, err)
		return
	}
	if input.RequestedBy, err = requireText(input.RequestedBy, "requested_by"); err != nil {
		workflowError(c, err)
		return
	}
	if input.NewValidTo == nil && input.NewTerms == nil && input.PriceAdjustmentPercent == nil && input.NewVolumeDiscountPercent == nil {
		workflowError(c, invalid("provide at least one proposed contract change"))
		return
	}
	if input.PriceAdjustmentPercent != nil && *input.PriceAdjustmentPercent <= -100 {
		workflowError(c, invalid("price_adjustment_percent must be greater than -100"))
		return
	}
	if input.NewVolumeDiscountPercent != nil && (*input.NewVolumeDiscountPercent < 0 || *input.NewVolumeDiscountPercent > 100) {
		workflowError(c, invalid("new_volume_discount_percent must be between 0 and 100"))
		return
	}
	if input.NewTerms != nil {
		value := strings.TrimSpace(*input.NewTerms)
		if value == "" {
			workflowError(c, invalid("new_terms cannot be empty"))
			return
		}
		input.NewTerms = &value
	}
	input.RevisionID = strings.TrimSpace(input.RevisionID)
	if input.RevisionID == "" {
		input.RevisionID, err = utils.GenerateID("REV")
		if err != nil {
			workflowError(c, err)
			return
		}
	}
	var result models.ContractRevision
	err = h.db.WithContext(c.Request.Context()).Transaction(func(tx *gorm.DB) error {
		var contract models.SalesContract
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).First(&contract, "contract_id = ?", c.Param("id")).Error; err != nil {
			return err
		}
		if contract.Status != "active" && contract.Status != "expired" {
			return conflict("only active or expired contracts can be revised")
		}
		if err := requireReference(tx, "sales_staff", "employee_id", input.RequestedBy); err != nil {
			return err
		}
		var pending int64
		if err := tx.Model(&models.ContractRevision{}).Where("contract_id = ? AND request_status IN ?", contract.ContractID, []string{"pending_review", "pending_signature"}).Count(&pending).Error; err != nil {
			return err
		}
		if pending > 0 {
			return conflict("contract already has an unfinished revision")
		}
		var newValidTo *time.Time
		if input.NewValidTo != nil {
			parsed, err := requiredContractDate(*input.NewValidTo, "new_valid_to")
			if err != nil {
				return err
			}
			if parsed.Before(contract.ValidFrom) {
				return invalid("new_valid_to cannot be before valid_from")
			}
			if input.RequestType == "renewal" && !parsed.After(contract.ValidTo) {
				return invalid("a renewal must extend the current valid_to date")
			}
			newValidTo = &parsed
		}
		revision := models.ContractRevision{
			RevisionID: input.RevisionID, ContractID: contract.ContractID,
			RequestType: input.RequestType, Reason: input.Reason,
			OriginalValidTo: contract.ValidTo, NewValidTo: newValidTo,
			OriginalTerms: contract.Terms, NewTerms: input.NewTerms,
			PriceAdjustmentPercent:   input.PriceAdjustmentPercent,
			NewVolumeDiscountPercent: input.NewVolumeDiscountPercent,
			DraftDocument:            input.DraftDocument, RequestStatus: "pending_review",
			RequestedBy: input.RequestedBy, RequestedAt: time.Now().UTC(),
		}
		if err := tx.Omit(clause.Associations).Create(&revision).Error; err != nil {
			return err
		}
		return tx.Preload("Requester").First(&result, "revision_id = ?", revision.RevisionID).Error
	})
	if err != nil {
		workflowError(c, err)
		return
	}
	c.JSON(http.StatusCreated, result)
}

func (h *SalesContractController) ListRevisions(c *gin.Context) {
	if err := requireReference(h.db.WithContext(c.Request.Context()), "sales_contracts", "contract_id", c.Param("id")); err != nil {
		workflowError(c, err)
		return
	}
	rows := make([]models.ContractRevision, 0)
	if err := h.db.WithContext(c.Request.Context()).Preload("Requester").Preload("Reviewer").
		Where("contract_id = ?", c.Param("id")).Order("requested_at DESC").Find(&rows).Error; err != nil {
		workflowError(c, err)
		return
	}
	c.JSON(http.StatusOK, rows)
}

func (h *SalesContractController) ReviewRevision(c *gin.Context) {
	var input dto.ReviewContractRevisionRequest
	if !utils.ReadJSON(c, &input) {
		return
	}
	input.Status = strings.TrimSpace(input.Status)
	if input.Status != "pending_signature" && input.Status != "completed" && input.Status != "rejected" {
		workflowError(c, invalid("status must be pending_signature, completed or rejected"))
		return
	}
	var err error
	if input.ReviewedBy, err = requireText(input.ReviewedBy, "reviewed_by"); err != nil {
		workflowError(c, err)
		return
	}
	if input.Status == "rejected" && (input.ReviewNote == nil || strings.TrimSpace(*input.ReviewNote) == "") {
		workflowError(c, invalid("review_note is required when rejecting a revision"))
		return
	}
	var result models.ContractRevision
	err = h.db.WithContext(c.Request.Context()).Transaction(func(tx *gorm.DB) error {
		var revision models.ContractRevision
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).First(&revision, "revision_id = ? AND contract_id = ?", c.Param("revisionID"), c.Param("id")).Error; err != nil {
			return err
		}
		if err := requireReference(tx, "users", "user_id", input.ReviewedBy); err != nil {
			return err
		}
		if input.Status == "pending_signature" && revision.RequestStatus != "pending_review" {
			return conflict("only a pending review can be approved for signature")
		}
		if input.Status == "completed" && revision.RequestStatus != "pending_signature" {
			return conflict("only a revision awaiting signature can be completed")
		}
		if input.Status == "rejected" && revision.RequestStatus != "pending_review" && revision.RequestStatus != "pending_signature" {
			return conflict("this revision can no longer be rejected")
		}
		now := time.Now().UTC()
		updates := map[string]any{"request_status": input.Status, "reviewed_by": input.ReviewedBy, "reviewed_at": now, "review_note": input.ReviewNote}
		if input.Status == "completed" {
			if input.SignedDocument == nil || strings.TrimSpace(*input.SignedDocument) == "" {
				return invalid("signed_document is required to complete a revision")
			}
			signedDocument := strings.TrimSpace(*input.SignedDocument)
			updates["signed_document"] = signedDocument
			contractUpdates := make(map[string]any)
			if revision.NewValidTo != nil {
				contractUpdates["valid_to"] = *revision.NewValidTo
			}
			if revision.NewTerms != nil {
				contractUpdates["terms"] = *revision.NewTerms
			}
			contractUpdates["status"] = "active"
			if err := tx.Model(&models.SalesContract{}).Where("contract_id = ?", revision.ContractID).Updates(contractUpdates).Error; err != nil {
				return err
			}
			if revision.PriceAdjustmentPercent != nil {
				factor := 1 + *revision.PriceAdjustmentPercent/100
				if err := tx.Model(&models.SalesContractMaterial{}).Where("contract_id = ?", revision.ContractID).
					Update("unit_price", gorm.Expr("ROUND(unit_price * ?, 2)", factor)).Error; err != nil {
					return err
				}
			}
			if revision.NewVolumeDiscountPercent != nil {
				if err := tx.Model(&models.SalesContractMaterial{}).Where("contract_id = ?", revision.ContractID).
					Update("volume_discount_percent", *revision.NewVolumeDiscountPercent).Error; err != nil {
					return err
				}
			}
		}
		if err := tx.Model(&revision).Updates(updates).Error; err != nil {
			return err
		}
		return tx.Preload("Requester").Preload("Reviewer").First(&result, "revision_id = ?", revision.RevisionID).Error
	})
	if err != nil {
		workflowError(c, err)
		return
	}
	c.JSON(http.StatusOK, result)
}
