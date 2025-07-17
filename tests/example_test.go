package tests

import (
	"testing"
)

// TestBasicMath tests basic mathematical operations
func TestBasicMath(t *testing.T) {
	tests := []struct {
		name     string
		a        int
		b        int
		expected int
	}{
		{"Addition positive numbers", 2, 3, 5},
		{"Addition with zero", 0, 5, 5},
		{"Addition negative numbers", -2, -3, -5},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := tt.a + tt.b
			if result != tt.expected {
				t.Errorf("Expected %d + %d = %d, but got %d", tt.a, tt.b, tt.expected, result)
			}
		})
	}
}

// TestStringOperations tests basic string operations
func TestStringOperations(t *testing.T) {
	testString := "LetRents"

	if len(testString) != 8 {
		t.Errorf("Expected string length to be 8, but got %d", len(testString))
	}

	if testString[0:3] != "Let" {
		t.Errorf("Expected first 3 characters to be 'Let', but got '%s'", testString[0:3])
	}
}

// TestEnvironmentSetup tests that the test environment is properly configured
func TestEnvironmentSetup(t *testing.T) {
	// This test ensures that the testing framework is working
	if testing.Short() {
		t.Skip("Skipping test in short mode")
	}

	// Test that we can create a test helper function
	helper := func(input string) string {
		return "test_" + input
	}

	result := helper("example")
	expected := "test_example"

	if result != expected {
		t.Errorf("Expected %s, but got %s", expected, result)
	}
}
