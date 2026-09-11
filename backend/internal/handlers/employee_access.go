package handlers

import (
	"strings"

	"backend/internal/access"
	"backend/internal/models"

	"github.com/gofiber/fiber/v2"
	"gorm.io/gorm"
)

func employeeAccessLevel(user models.User, module access.Module) access.Level {
	level := access.Resolve(employeeAuthorizationRole(user), user.Department, module, employeePermissionOverrides(user.Permissions))
	if strings.EqualFold(strings.TrimSpace(user.Role), "view_only") && level == access.Edit {
		return access.View
	}
	return level
}

func employeeEffectiveAccess(user models.User) map[access.Module]access.Level {
	result := make(map[access.Module]access.Level, len(access.Modules))
	for _, module := range access.Modules {
		result[module] = employeeAccessLevel(user, module)
	}
	return result
}

func employeeFeatureAccessLevel(user models.User, feature access.Feature) access.Level {
	level := access.ResolveFeature(employeeAuthorizationRole(user), user.Department, feature)
	if strings.EqualFold(strings.TrimSpace(user.Role), "view_only") && level == access.Edit {
		return access.View
	}
	return level
}

func employeeAuthorizationRole(user models.User) string {
	if strings.EqualFold(strings.TrimSpace(user.Role), "admin") {
		return "admin"
	}
	if role := strings.TrimSpace(user.JobRole); role != "" {
		return role
	}
	return user.Role
}

func employeePermissionOverrides(permissions []models.Permission) map[access.Module]access.Level {
	overrides := make(map[access.Module]access.Level)
	for _, permission := range permissions {
		if permission.Position == employeePermissionPosition && permission.PermissionName == "edit" {
			switch permission.Scope {
			case "all":
				for _, module := range access.Modules {
					if module != access.Audit && module != access.EmployeeManagement {
						overrides[module] = access.Edit
					}
				}
			case "promotions":
				overrides[access.Promotions] = access.Edit
			case "users":
				overrides[access.EmployeeManagement] = access.Edit
			}
		}
	}
	for _, permission := range permissions {
		if !strings.HasPrefix(permission.Position, employeeModulePermissionPrefix) {
			continue
		}
		key := access.Module(strings.TrimPrefix(permission.Position, employeeModulePermissionPrefix))
		level := access.Level(permission.PermissionName)
		if key.Valid() && level.Valid() {
			overrides[key] = level
		}
	}
	return overrides
}

func requireEmployeeModule(db *gorm.DB, module access.Module, required access.Level) fiber.Handler {
	return func(c *fiber.Ctx) error {
		user, err := loadEmployeeFromRequest(c, db)
		if err != nil {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"message": "กรุณาเข้าสู่ระบบพนักงาน"})
		}
		if !employeeAccessLevel(user, module).Allows(required) {
			return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"message": "ไม่มีสิทธิ์ดำเนินการในส่วนนี้"})
		}
		c.Locals("employeeUser", user)
		return c.Next()
	}
}

func requireEmployeeFeature(db *gorm.DB, feature access.Feature, required access.Level) fiber.Handler {
	return func(c *fiber.Ctx) error {
		user, err := loadEmployeeFromRequest(c, db)
		if err != nil {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"message": "กรุณาเข้าสู่ระบบพนักงาน"})
		}
		if !employeeFeatureAccessLevel(user, feature).Allows(required) {
			return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"message": "ไม่มีสิทธิ์ดำเนินการในส่วนนี้"})
		}
		c.Locals("employeeUser", user)
		return c.Next()
	}
}
