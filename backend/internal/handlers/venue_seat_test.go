package handlers

import (
	"encoding/json"
	"testing"
)

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
