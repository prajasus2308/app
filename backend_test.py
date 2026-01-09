#!/usr/bin/env python3
"""
Backend API Testing for Robotics Simulator
Tests all CRUD operations and error handling scenarios
"""

import requests
import json
import sys
from datetime import datetime

# Get backend URL from environment
BACKEND_URL = "https://sim-robotics.preview.emergentagent.com/api"

class RoboticsAPITester:
    def __init__(self):
        self.base_url = BACKEND_URL
        self.test_results = []
        self.created_program_id = None
        
    def log_test(self, test_name, success, message, response_data=None):
        """Log test results"""
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status} {test_name}: {message}")
        
        self.test_results.append({
            "test": test_name,
            "success": success,
            "message": message,
            "response_data": response_data
        })
        
    def test_root_endpoint(self):
        """Test GET /api/ - Root endpoint"""
        try:
            response = requests.get(f"{self.base_url}/")
            
            if response.status_code == 200:
                data = response.json()
                if data.get("message") == "Robotics Simulator API":
                    self.log_test("Root Endpoint", True, "Root endpoint returned correct welcome message", data)
                else:
                    self.log_test("Root Endpoint", False, f"Unexpected message: {data}", data)
            else:
                self.log_test("Root Endpoint", False, f"Status code {response.status_code}: {response.text}")
                
        except Exception as e:
            self.log_test("Root Endpoint", False, f"Connection error: {str(e)}")
    
    def test_create_program(self):
        """Test POST /api/programs - Create a new robot program"""
        test_program = {
            "name": "Test Program 1",
            "commands": [
                {"id": "1", "action": "forward"},
                {"id": "2", "action": "right"},
                {"id": "3", "action": "forward"}
            ],
            "environment": "Open Space"
        }
        
        try:
            response = requests.post(
                f"{self.base_url}/programs",
                json=test_program,
                headers={"Content-Type": "application/json"}
            )
            
            if response.status_code == 200:
                data = response.json()
                
                # Validate response structure
                required_fields = ["id", "name", "commands", "environment", "created_at"]
                missing_fields = [field for field in required_fields if field not in data]
                
                if missing_fields:
                    self.log_test("Create Program", False, f"Missing fields: {missing_fields}", data)
                else:
                    # Store the created program ID for later tests
                    self.created_program_id = data["id"]
                    
                    # Validate data integrity
                    if (data["name"] == test_program["name"] and 
                        data["environment"] == test_program["environment"] and
                        len(data["commands"]) == len(test_program["commands"])):
                        self.log_test("Create Program", True, f"Program created successfully with ID: {data['id']}", data)
                    else:
                        self.log_test("Create Program", False, "Data integrity check failed", data)
            else:
                self.log_test("Create Program", False, f"Status code {response.status_code}: {response.text}")
                
        except Exception as e:
            self.log_test("Create Program", False, f"Request error: {str(e)}")
    
    def test_list_programs(self):
        """Test GET /api/programs - Get all saved programs"""
        try:
            response = requests.get(f"{self.base_url}/programs")
            
            if response.status_code == 200:
                data = response.json()
                
                if isinstance(data, list):
                    if len(data) > 0:
                        # Check if our created program is in the list
                        program_found = any(prog.get("id") == self.created_program_id for prog in data)
                        if program_found:
                            self.log_test("List Programs", True, f"Retrieved {len(data)} programs, including our test program", {"count": len(data)})
                        else:
                            self.log_test("List Programs", False, f"Test program not found in list of {len(data)} programs", {"count": len(data)})
                    else:
                        self.log_test("List Programs", True, "Retrieved empty program list", {"count": 0})
                else:
                    self.log_test("List Programs", False, f"Expected array, got: {type(data)}", data)
            else:
                self.log_test("List Programs", False, f"Status code {response.status_code}: {response.text}")
                
        except Exception as e:
            self.log_test("List Programs", False, f"Request error: {str(e)}")
    
    def test_get_single_program(self):
        """Test GET /api/programs/{program_id} - Get specific program by ID"""
        if not self.created_program_id:
            self.log_test("Get Single Program", False, "No program ID available from create test")
            return
            
        try:
            response = requests.get(f"{self.base_url}/programs/{self.created_program_id}")
            
            if response.status_code == 200:
                data = response.json()
                
                if data.get("id") == self.created_program_id:
                    self.log_test("Get Single Program", True, f"Retrieved program {self.created_program_id} successfully", data)
                else:
                    self.log_test("Get Single Program", False, f"ID mismatch: expected {self.created_program_id}, got {data.get('id')}", data)
            else:
                self.log_test("Get Single Program", False, f"Status code {response.status_code}: {response.text}")
                
        except Exception as e:
            self.log_test("Get Single Program", False, f"Request error: {str(e)}")
    
    def test_delete_program(self):
        """Test DELETE /api/programs/{program_id} - Delete a program"""
        if not self.created_program_id:
            self.log_test("Delete Program", False, "No program ID available from create test")
            return
            
        try:
            response = requests.delete(f"{self.base_url}/programs/{self.created_program_id}")
            
            if response.status_code == 200:
                data = response.json()
                if "message" in data and "deleted" in data["message"].lower():
                    self.log_test("Delete Program", True, f"Program {self.created_program_id} deleted successfully", data)
                else:
                    self.log_test("Delete Program", False, f"Unexpected response: {data}", data)
            else:
                self.log_test("Delete Program", False, f"Status code {response.status_code}: {response.text}")
                
        except Exception as e:
            self.log_test("Delete Program", False, f"Request error: {str(e)}")
    
    def test_verify_deletion(self):
        """Verify the program was actually deleted"""
        if not self.created_program_id:
            self.log_test("Verify Deletion", False, "No program ID available")
            return
            
        try:
            # Try to get the deleted program
            response = requests.get(f"{self.base_url}/programs/{self.created_program_id}")
            
            if response.status_code == 404:
                self.log_test("Verify Deletion", True, "Program successfully deleted (404 as expected)")
            else:
                self.log_test("Verify Deletion", False, f"Program still exists: status {response.status_code}")
                
        except Exception as e:
            self.log_test("Verify Deletion", False, f"Request error: {str(e)}")
    
    def test_error_handling(self):
        """Test error handling scenarios"""
        
        # Test 1: Get non-existent program
        try:
            response = requests.get(f"{self.base_url}/programs/invalid-id-12345")
            if response.status_code == 404:
                self.log_test("Error Handling - Get Invalid ID", True, "Correctly returned 404 for invalid program ID")
            else:
                self.log_test("Error Handling - Get Invalid ID", False, f"Expected 404, got {response.status_code}")
        except Exception as e:
            self.log_test("Error Handling - Get Invalid ID", False, f"Request error: {str(e)}")
        
        # Test 2: Delete non-existent program
        try:
            response = requests.delete(f"{self.base_url}/programs/invalid-id-12345")
            if response.status_code == 404:
                self.log_test("Error Handling - Delete Invalid ID", True, "Correctly returned 404 for invalid program ID")
            else:
                self.log_test("Error Handling - Delete Invalid ID", False, f"Expected 404, got {response.status_code}")
        except Exception as e:
            self.log_test("Error Handling - Delete Invalid ID", False, f"Request error: {str(e)}")
        
        # Test 3: Create program with missing fields
        try:
            invalid_program = {"name": "Incomplete Program"}  # Missing commands and environment
            response = requests.post(
                f"{self.base_url}/programs",
                json=invalid_program,
                headers={"Content-Type": "application/json"}
            )
            if response.status_code == 422:
                self.log_test("Error Handling - Missing Fields", True, "Correctly returned 422 for missing required fields")
            else:
                self.log_test("Error Handling - Missing Fields", False, f"Expected 422, got {response.status_code}: {response.text}")
        except Exception as e:
            self.log_test("Error Handling - Missing Fields", False, f"Request error: {str(e)}")
    
    def run_all_tests(self):
        """Run all test scenarios"""
        print(f"🤖 Starting Robotics Simulator Backend API Tests")
        print(f"📡 Backend URL: {self.base_url}")
        print("=" * 60)
        
        # Run tests in sequence
        self.test_root_endpoint()
        self.test_create_program()
        self.test_list_programs()
        self.test_get_single_program()
        self.test_delete_program()
        self.test_verify_deletion()
        self.test_error_handling()
        
        # Summary
        print("\n" + "=" * 60)
        print("📊 TEST SUMMARY")
        print("=" * 60)
        
        passed = sum(1 for result in self.test_results if result["success"])
        total = len(self.test_results)
        
        print(f"Total Tests: {total}")
        print(f"Passed: {passed}")
        print(f"Failed: {total - passed}")
        print(f"Success Rate: {(passed/total)*100:.1f}%")
        
        # Show failed tests
        failed_tests = [result for result in self.test_results if not result["success"]]
        if failed_tests:
            print("\n❌ FAILED TESTS:")
            for test in failed_tests:
                print(f"  - {test['test']}: {test['message']}")
        
        return passed == total

if __name__ == "__main__":
    tester = RoboticsAPITester()
    success = tester.run_all_tests()
    
    if success:
        print("\n🎉 All tests passed!")
        sys.exit(0)
    else:
        print("\n💥 Some tests failed!")
        sys.exit(1)