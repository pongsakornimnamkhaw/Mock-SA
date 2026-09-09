package models

import "gorm.io/gorm"

type LayoutObject struct {
	ObjectID       string  `gorm:"column:object_id;primaryKey;type:varchar(50);not null" json:"object_id"`
	ConcertID      string  `gorm:"column:concert_id;type:varchar(50);not null;index" json:"concert_id"`
	ParentObjectID *string `gorm:"column:parent_object_id;type:varchar(50);index" json:"parent_object_id,omitempty"`
	LayoutType     string  `gorm:"column:layout_type;type:varchar(20);not null;check:layout_type IN ('VENUE','TICKET')" json:"layout_type"`
	SideType       *string `gorm:"column:side_type;type:varchar(20);check:side_type IS NULL OR side_type IN ('FRONT','BACK')" json:"side_type,omitempty"`
	ObjectType     string  `gorm:"column:object_type;type:varchar(50);not null" json:"object_type"`
	PositionX      float64 `gorm:"column:position_x;type:double precision;not null" json:"position_x"`
	PositionY      float64 `gorm:"column:position_y;type:double precision;not null" json:"position_y"`
	Width          float64 `gorm:"column:width;type:double precision;not null" json:"width"`
	Height         float64 `gorm:"column:height;type:double precision;not null" json:"height"`
	Rotation       float64 `gorm:"column:rotation;type:double precision;not null" json:"rotation"`
	LayerOrder     int     `gorm:"column:layer_order;type:int;not null" json:"layer_order"`
	ObjectData     *string `gorm:"column:object_data;type:jsonb" json:"object_data,omitempty"`
	StyleJSON      *string `gorm:"column:style_json;type:jsonb" json:"style_json,omitempty"`

	Parent *LayoutObject `gorm:"foreignKey:ParentObjectID;references:ObjectID;constraint:OnUpdate:CASCADE,OnDelete:SET NULL" json:"-"`
}

func (LayoutObject) TableName() string { return "LayoutObject" }

func (o *LayoutObject) BeforeCreate(tx *gorm.DB) error {
	if o.ObjectID == "" {
		o.ObjectID = GenerateID("LO")
	}
	return nil
}
