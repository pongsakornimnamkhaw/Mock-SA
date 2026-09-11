package main

import (
	"bytes"
	"path/filepath"
	"testing"
)

func TestConcertPosterAssetNameUsesCanonicalConcertNames(t *testing.T) {
	cases := map[string]string{
		"Riverside Sound Festival":   "pulse.png",
		" Neon Nights Vol.3 ":        "flux.png",
		"ACOUSTIC SESSIONS: BANGKOK": "celestial.png",
		"Celestial Sounds":           "celestial.png",
		"Starlight Festival":         "starlight.png",
	}
	for name, want := range cases {
		got, ok := concertPosterAssetName(name)
		if !ok || got != want {
			t.Fatalf("concertPosterAssetName(%q) = %q, %v; want %q, true", name, got, ok, want)
		}
	}
	if _, ok := concertPosterAssetName("Unmapped Concert"); ok {
		t.Fatal("unmapped concert must not receive a seeded poster")
	}
}

func TestMergeConcertPosterPreservesExistingImages(t *testing.T) {
	asset := []byte("asset")
	custom := []byte("custom")
	cases := []struct {
		name                          string
		poster, concertPoster         []byte
		wantPoster, wantConcertPoster []byte
		changed                       bool
	}{
		{"both empty", nil, nil, asset, asset, true},
		{"poster exists", custom, nil, custom, custom, true},
		{"concert poster exists", nil, custom, custom, custom, true},
		{"both exist", custom, []byte("other"), custom, []byte("other"), false},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			poster, concertPoster, changed := mergeConcertPoster(tc.poster, tc.concertPoster, asset)
			if !bytes.Equal(poster, tc.wantPoster) || !bytes.Equal(concertPoster, tc.wantConcertPoster) || changed != tc.changed {
				t.Fatalf("mergeConcertPoster() = %q, %q, %v; want %q, %q, %v", poster, concertPoster, changed, tc.wantPoster, tc.wantConcertPoster, tc.changed)
			}
		})
	}
}

func TestConcertPosterAssetPathIsRepositoryRelative(t *testing.T) {
	path := concertPosterAssetPath("pulse.png")
	wantSuffix := filepath.Join("frontend", "src", "assets", "poster", "pulse.png")
	if !filepath.IsAbs(path) || len(path) < len(wantSuffix) || path[len(path)-len(wantSuffix):] != wantSuffix {
		t.Fatalf("concertPosterAssetPath() = %q; want absolute path ending in %q", path, wantSuffix)
	}
}
