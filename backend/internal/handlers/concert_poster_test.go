package handlers

import (
	"bytes"
	"encoding/base64"
	"testing"
	"time"

	"backend/internal/models"
)

func TestDecodePosterDataAcceptsDataURLAndRejectsInvalidBase64(t *testing.T) {
	raw := []byte{0x89, 0x50, 0x4e, 0x47}
	encoded := "data:image/png;base64," + base64.StdEncoding.EncodeToString(raw)
	got, err := decodePosterData(encoded)
	if err != nil || !bytes.Equal(got, raw) {
		t.Fatalf("decodePosterData() = %v, %v; want PNG bytes", got, err)
	}
	if _, err := decodePosterData("data:image/png;base64,not-base64"); err == nil {
		t.Fatal("decodePosterData() accepted invalid base64")
	}
}

func TestConcertPosterURLUsesVersionAndOnlyExistsForStoredImages(t *testing.T) {
	updatedAt := time.Unix(1789062000, 0).UTC()
	concert := models.Concert{
		ConcertID: "CC0002",
		Poster:    []byte("poster"),
		BaseModel: models.BaseModel{UpdatedAt: updatedAt},
	}
	if got, want := concertPosterURL(concert), "/api/concerts/CC0002/poster?v=1789062000"; got != want {
		t.Fatalf("concertPosterURL() = %q, want %q", got, want)
	}
	concert.Poster = nil
	if got := concertPosterURL(concert); got != "" {
		t.Fatalf("concertPosterURL() without image = %q, want empty", got)
	}
}

func TestConcertPosterBytesPrefersPosterAndFallsBackToConcertPoster(t *testing.T) {
	primary := []byte("primary")
	fallback := []byte("fallback")
	if got := concertPosterBytes(models.Concert{Poster: primary, ConcertPoster: fallback}); !bytes.Equal(got, primary) {
		t.Fatalf("primary poster not selected: %q", got)
	}
	if got := concertPosterBytes(models.Concert{ConcertPoster: fallback}); !bytes.Equal(got, fallback) {
		t.Fatalf("concert_poster fallback not selected: %q", got)
	}
}
