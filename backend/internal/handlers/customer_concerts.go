package handlers

import (
	"sort"

	"backend/internal/models"

	"github.com/gofiber/fiber/v2"
)

// bookableCustomerConcerts คัดเฉพาะคอนเสิร์ตที่ลูกค้ายังเข้าดู/จองได้
// (ตัดที่ยกเลิกการจัดออก ใช้กติกาเดียวกับ GET /concerts/:id) แล้วเรียงให้งานที่
// ใกล้ถึงขึ้นก่อน
func bookableCustomerConcerts(rows []models.Concert) []customerPromotionConcertDTO {
	views := make([]customerPromotionConcertDTO, 0, len(rows))
	for _, concert := range rows {
		if customerConcertCancelled(concert.Status) {
			continue
		}
		views = append(views, customerConcertView(concert))
	}
	sort.SliceStable(views, func(left, right int) bool {
		return views[left].StartDate < views[right].StartDate
	})
	return views
}

func (h *customerAccountHandler) listCustomerConcerts(c *fiber.Ctx) error {
	var rows []models.Concert
	if err := h.db.Find(&rows).Error; err != nil {
		return customerError(c, fiber.StatusInternalServerError, "ไม่สามารถโหลดคอนเสิร์ตได้")
	}
	return c.JSON(fiber.Map{"data": bookableCustomerConcerts(rows)})
}
