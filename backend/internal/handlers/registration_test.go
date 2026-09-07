package handlers

import "testing"

func TestParseTicketCode(t *testing.T) {
	valid := map[string]uint{
		"1": 1, "#1": 1, "TK-000123": 123, "#tk-000456": 456, "TK-2026-0459": 459,
	}
	for input, expected := range valid {
		actual, err := parseTicketCode(input)
		if err != nil || actual != expected {
			t.Fatalf("parseTicketCode(%q) = %d, %v; want %d", input, actual, err, expected)
		}
	}
	for _, input := range []string{"", "TK-", "ABC", "0", "TK-ABC"} {
		if _, err := parseTicketCode(input); err == nil {
			t.Fatalf("parseTicketCode(%q) must fail", input)
		}
	}
}
