package ticketplanning

import (
	"encoding/json"
	"testing"
)

func TestLayoutSeatStatusPreservesIssuedSeatState(t *testing.T) {
	if got := layoutSeatStatus(false, "SOLD", true); got != "SOLD" {
		t.Fatalf("issued seat status changed to %q", got)
	}
	if got := layoutSeatStatus(true, "AVAILABLE", false); got != "DISABLED" {
		t.Fatalf("unissued disabled seat status = %q", got)
	}
	if got := layoutSeatStatus(false, "DISABLED", false); got != "AVAILABLE" {
		t.Fatalf("unissued enabled seat status = %q", got)
	}
}

func TestZonePriceSurvivesLayoutTransport(t *testing.T) {
	const payload = `{"id":"zone-a","zonePrice":1250.50}`
	var zone zoneDTO
	if err := json.Unmarshal([]byte(payload), &zone); err != nil {
		t.Fatalf("decode zone payload: %v", err)
	}
	if zone.ZonePrice != 1250.50 {
		t.Fatalf("ZonePrice = %v, want 1250.50", zone.ZonePrice)
	}
	encoded, err := json.Marshal(zone)
	if err != nil {
		t.Fatalf("encode zone payload: %v", err)
	}
	var result map[string]any
	if err := json.Unmarshal(encoded, &result); err != nil {
		t.Fatalf("decode encoded zone: %v", err)
	}
	if result["zonePrice"] != 1250.50 {
		t.Fatalf("zonePrice was dropped from response: %#v", result["zonePrice"])
	}
}

func TestTicketLayoutFieldsSurviveTransportAndJSONStorage(t *testing.T) {
	const payload = `{"id":"image-1","kind":"image","imageSrc":"data:image/png;base64,AAAA","fontSize":42,"aspectRatio":1.5}`
	var transport layoutObjectDTO
	if err := json.Unmarshal([]byte(payload), &transport); err != nil {
		t.Fatalf("decode transport payload: %v", err)
	}
	transportJSON, err := json.Marshal(transport)
	if err != nil {
		t.Fatalf("encode transport payload: %v", err)
	}
	var transportResult map[string]any
	if err := json.Unmarshal(transportJSON, &transportResult); err != nil {
		t.Fatalf("decode encoded transport: %v", err)
	}
	if transportResult["imageSrc"] != "data:image/png;base64,AAAA" {
		t.Fatalf("imageSrc was dropped by transport DTO: %#v", transportResult["imageSrc"])
	}
	if transportResult["fontSize"] != float64(42) {
		t.Fatalf("fontSize was dropped by transport DTO: %#v", transportResult["fontSize"])
	}
	if transportResult["aspectRatio"] != float64(1.5) {
		t.Fatalf("aspectRatio was dropped by transport DTO: %#v", transportResult["aspectRatio"])
	}

	var data venueObjectData
	var style venueObjectStyle
	if err := json.Unmarshal([]byte(`{"imageSrc":"data:image/png;base64,AAAA","aspectRatio":1.5}`), &data); err != nil {
		t.Fatalf("decode object data: %v", err)
	}
	if err := json.Unmarshal([]byte(`{"fontSize":42}`), &style); err != nil {
		t.Fatalf("decode object style: %v", err)
	}
	dataJSON, _ := json.Marshal(data)
	styleJSON, _ := json.Marshal(style)
	if string(dataJSON) != `{"kind":"","shape":"","name":"","imageSrc":"data:image/png;base64,AAAA","aspectRatio":1.5}` {
		t.Fatalf("image source storage JSON = %s", dataJSON)
	}
	if string(styleJSON) != `{"color":"","textColor":"","fontSize":42}` {
		t.Fatalf("font size storage JSON = %s", styleJSON)
	}
}
