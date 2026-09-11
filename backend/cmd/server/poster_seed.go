package main

import (
	"fmt"
	"os"
	"path/filepath"
	"runtime"
	"strings"

	"backend/internal/models"

	"gorm.io/gorm"
)

var concertPosterAssets = map[string]string{
	"riverside sound festival":   "pulse.png",
	"neon nights vol.3":          "flux.png",
	"acoustic sessions: bangkok": "celestial.png",
	"neon pulse":                 "pulse.png",
	"neon flux festival":         "flux.png",
	"celestial sounds":           "celestial.png",
	"starlight festival":         "starlight.png",
}

func concertPosterAssetName(concertName string) (string, bool) {
	name, ok := concertPosterAssets[strings.ToLower(strings.TrimSpace(concertName))]
	return name, ok
}

func concertPosterAssetPath(assetName string) string {
	_, sourceFile, _, _ := runtime.Caller(0)
	return filepath.Clean(filepath.Join(filepath.Dir(sourceFile), "..", "..", "..", "frontend", "src", "assets", "poster", assetName))
}

func mergeConcertPoster(poster, concertPoster, asset []byte) ([]byte, []byte, bool) {
	if len(poster) > 0 && len(concertPoster) > 0 {
		return poster, concertPoster, false
	}
	if len(poster) > 0 {
		return poster, append([]byte(nil), poster...), true
	}
	if len(concertPoster) > 0 {
		return append([]byte(nil), concertPoster...), concertPoster, true
	}
	return append([]byte(nil), asset...), append([]byte(nil), asset...), true
}

func ensureConcertPosters(db *gorm.DB) (int, error) {
	var concerts []models.Concert
	if err := db.Select("concert_id", "concert_name", "poster", "concert_poster").Find(&concerts).Error; err != nil {
		return 0, err
	}
	assets := make(map[string][]byte)
	updated := 0
	for _, concert := range concerts {
		assetName, mapped := concertPosterAssetName(concert.ConcertName)
		if !mapped || (len(concert.Poster) > 0 && len(concert.ConcertPoster) > 0) {
			continue
		}
		asset := assets[assetName]
		if len(concert.Poster) == 0 && len(concert.ConcertPoster) == 0 && len(asset) == 0 {
			path := concertPosterAssetPath(assetName)
			data, err := os.ReadFile(path)
			if err != nil {
				return updated, fmt.Errorf("read poster asset %s for concert %q: %w", path, concert.ConcertName, err)
			}
			if len(data) == 0 {
				return updated, fmt.Errorf("poster asset %s for concert %q is empty", path, concert.ConcertName)
			}
			asset = data
			assets[assetName] = data
		}
		poster, concertPoster, changed := mergeConcertPoster(concert.Poster, concert.ConcertPoster, asset)
		if !changed {
			continue
		}
		if err := db.Model(&models.Concert{}).Where("concert_id = ?", concert.ConcertID).
			Updates(map[string]any{"poster": poster, "concert_poster": concertPoster}).Error; err != nil {
			return updated, fmt.Errorf("seed poster for concert %q: %w", concert.ConcertName, err)
		}
		updated++
	}
	return updated, nil
}
