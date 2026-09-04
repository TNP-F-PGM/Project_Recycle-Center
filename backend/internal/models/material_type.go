package models

// MaterialType groups materials and storage zones by material type.
type MaterialType struct {
	TypeID    int        `gorm:"column:type_id;type:integer;primaryKey;autoIncrement" json:"typeID"`
	TypeName  string     `gorm:"column:type_name;type:text;not null" json:"typeName"`
	Materials []Material `gorm:"foreignKey:MaterialTypeID;references:TypeID" json:"materials,omitempty"`
}
