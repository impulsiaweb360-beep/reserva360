#!/usr/bin/env python3
"""
Reserva360 Supabase + Resend Integration Test Suite
Tests all backend endpoints and Supabase direct API calls
"""

import requests
import json
import random
import string
from datetime import datetime

# Configuration
BASE_URL = "https://schedule-sync-141.preview.emergentagent.com"
SUPABASE_URL = "https://nlqcmysbivskkyxjjvld.supabase.co"
SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5scWNteXNiaXZza2t5eGpqdmxkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA5MzkzMjAsImV4cCI6MjA5NjUxNTMyMH0.RVKqaTM-iJp3QkFkM3SSvGU9i9B0j_YXXK31AEdZ-lI"
SUPABASE_SERVICE_ROLE = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5scWNteXNiaXZza2t5eGpqdmxkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDkzOTMyMCwiZXhwIjoyMDk2NTE1MzIwfQ.TUExhh2OGt8SdqggzXEZPwtxm9X2imvtA8DZFhmIZO0"
CRON_SECRET = "reserva360-cron-secret-change-me"

def generate_random_email():
    """Generate a random email for testing"""
    random_str = ''.join(random.choices(string.ascii_lowercase + string.digits, k=8))
    return f"test-{random_str}@example.com"

def print_test_header(test_name):
    """Print a formatted test header"""
    print(f"\n{'='*80}")
    print(f"TEST: {test_name}")
    print(f"{'='*80}")

def print_result(success, message):
    """Print test result"""
    status = "✅ PASS" if success else "❌ FAIL"
    print(f"{status}: {message}")

# =============================================================================
# Test 1: Landing Page
# =============================================================================
def test_landing_page():
    print_test_header("GET / -> 200 (Landing Page)")
    try:
        response = requests.get(f"{BASE_URL}/", timeout=10)
        success = response.status_code == 200
        print_result(success, f"Status: {response.status_code}")
        if success:
            print(f"   Content length: {len(response.text)} bytes")
        return success
    except Exception as e:
        print_result(False, f"Exception: {str(e)}")
        return False

# =============================================================================
# Test 2: Auth Login Page
# =============================================================================
def test_auth_login_page():
    print_test_header("GET /auth/login -> 200")
    try:
        response = requests.get(f"{BASE_URL}/auth/login", timeout=10)
        success = response.status_code == 200
        print_result(success, f"Status: {response.status_code}")
        return success
    except Exception as e:
        print_result(False, f"Exception: {str(e)}")
        return False

# =============================================================================
# Test 3: Auth Signup Page
# =============================================================================
def test_auth_signup_page():
    print_test_header("GET /auth/signup -> 200")
    try:
        response = requests.get(f"{BASE_URL}/auth/signup", timeout=10)
        success = response.status_code == 200
        print_result(success, f"Status: {response.status_code}")
        return success
    except Exception as e:
        print_result(False, f"Exception: {str(e)}")
        return False

# =============================================================================
# Test 4: Dashboard Redirect (No Session)
# =============================================================================
def test_dashboard_redirect():
    print_test_header("GET /dashboard -> 307 redirect to /auth/login")
    try:
        response = requests.get(f"{BASE_URL}/dashboard", allow_redirects=False, timeout=10)
        # Next.js redirects can be 307 or 302
        is_redirect = response.status_code in [302, 307, 308]
        print(f"   Status: {response.status_code}")
        
        if is_redirect:
            location = response.headers.get('Location', '')
            print(f"   Location header: {location}")
            # Check if redirecting to login
            success = '/auth/login' in location or location.endswith('/auth/login')
            print_result(success, f"Redirects to login: {success}")
            return success
        else:
            print_result(False, f"Expected redirect (302/307/308), got {response.status_code}")
            return False
    except Exception as e:
        print_result(False, f"Exception: {str(e)}")
        return False

# =============================================================================
# Test 5: Cron Endpoint Without Secret
# =============================================================================
def test_cron_without_secret():
    print_test_header("GET /api/cron/reminders-24h (without secret) -> 401")
    try:
        response = requests.get(f"{BASE_URL}/api/cron/reminders-24h", timeout=10)
        success = response.status_code == 401
        print_result(success, f"Status: {response.status_code}")
        if response.status_code == 401:
            try:
                data = response.json()
                print(f"   Response: {json.dumps(data, indent=2)}")
            except:
                pass
        return success
    except Exception as e:
        print_result(False, f"Exception: {str(e)}")
        return False

# =============================================================================
# Test 6: Cron Endpoint With Secret
# =============================================================================
def test_cron_with_secret():
    print_test_header("GET /api/cron/reminders-24h?secret=... -> 200")
    try:
        response = requests.get(
            f"{BASE_URL}/api/cron/reminders-24h?secret={CRON_SECRET}",
            timeout=30
        )
        success = response.status_code == 200
        print(f"   Status: {response.status_code}")
        
        if response.status_code == 200:
            try:
                data = response.json()
                print(f"   Response: {json.dumps(data, indent=2)}")
                has_checked = 'checked' in data
                has_results = 'results' in data
                success = has_checked and has_results
                print_result(success, f"Has 'checked' and 'results' fields: {success}")
                return success
            except Exception as e:
                print_result(False, f"Failed to parse JSON: {str(e)}")
                return False
        else:
            print_result(False, f"Expected 200, got {response.status_code}")
            if response.text:
                print(f"   Response: {response.text[:500]}")
            return False
    except Exception as e:
        print_result(False, f"Exception: {str(e)}")
        return False

# =============================================================================
# Test 7: Supabase Direct Connection - Query Plans Table
# =============================================================================
def test_supabase_plans_table():
    print_test_header("Supabase Direct: Query plans table")
    try:
        headers = {
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': f'Bearer {SUPABASE_ANON_KEY}',
            'Content-Type': 'application/json'
        }
        
        response = requests.get(
            f"{SUPABASE_URL}/rest/v1/plans?select=*",
            headers=headers,
            timeout=10
        )
        
        print(f"   Status: {response.status_code}")
        
        if response.status_code == 200:
            try:
                plans = response.json()
                print(f"   Response: {json.dumps(plans, indent=2)}")
                
                # Check if we have 3 plans
                has_plans = isinstance(plans, list) and len(plans) >= 3
                print(f"   Number of plans: {len(plans) if isinstance(plans, list) else 0}")
                
                if has_plans:
                    plan_names = [p.get('name', '') for p in plans]
                    print(f"   Plan names: {plan_names}")
                    # Check for expected plan names
                    expected_names = ['Starter', 'Pro', 'Business']
                    has_expected = any(name in plan_names for name in expected_names)
                    success = has_expected
                    print_result(success, f"Found expected plans: {success}")
                    return success
                else:
                    print_result(False, "Expected at least 3 plans")
                    return False
            except Exception as e:
                print_result(False, f"Failed to parse JSON: {str(e)}")
                return False
        else:
            print_result(False, f"Expected 200, got {response.status_code}")
            print(f"   Response: {response.text[:500]}")
            return False
    except Exception as e:
        print_result(False, f"Exception: {str(e)}")
        return False

# =============================================================================
# Test 8: Supabase RPC - get_public_tenant
# =============================================================================
def test_supabase_rpc_get_public_tenant():
    print_test_header("Supabase RPC: get_public_tenant")
    try:
        headers = {
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': f'Bearer {SUPABASE_ANON_KEY}',
            'Content-Type': 'application/json'
        }
        
        payload = {"p_slug": "non-existent-slug"}
        
        response = requests.post(
            f"{SUPABASE_URL}/rest/v1/rpc/get_public_tenant",
            headers=headers,
            json=payload,
            timeout=10
        )
        
        print(f"   Status: {response.status_code}")
        
        if response.status_code == 200:
            try:
                result = response.json()
                print(f"   Response: {json.dumps(result, indent=2)}")
                # Should return null for non-existent slug
                success = result is None
                print_result(success, f"Returns null for non-existent slug: {success}")
                return success
            except Exception as e:
                print_result(False, f"Failed to parse JSON: {str(e)}")
                return False
        else:
            print_result(False, f"Expected 200, got {response.status_code}")
            print(f"   Response: {response.text[:500]}")
            return False
    except Exception as e:
        print_result(False, f"Exception: {str(e)}")
        return False

# =============================================================================
# Test 9: Supabase Auth Signup Flow
# =============================================================================
def test_supabase_auth_signup():
    print_test_header("Supabase Auth: Signup Flow")
    
    test_email = generate_random_email()
    print(f"   Test email: {test_email}")
    
    try:
        # Step 1: Signup
        headers = {
            'apikey': SUPABASE_ANON_KEY,
            'Content-Type': 'application/json'
        }
        
        signup_payload = {
            "email": test_email,
            "password": "TestPass1234",
            "data": {
                "first_name": "Test",
                "last_name": "User",
                "business_name": "Test Business",
                "role": "tenant_admin"
            }
        }
        
        print("\n   Step 1: Creating user via Supabase Auth API...")
        response = requests.post(
            f"{SUPABASE_URL}/auth/v1/signup",
            headers=headers,
            json=signup_payload,
            timeout=10
        )
        
        print(f"   Signup status: {response.status_code}")
        
        if response.status_code != 200:
            print(f"   Response: {response.text[:500]}")
            print_result(False, f"Signup failed with status {response.status_code}")
            return False
        
        try:
            signup_data = response.json()
            print(f"   Signup response: {json.dumps(signup_data, indent=2)}")
            
            user_id = signup_data.get('user', {}).get('id')
            if not user_id:
                print_result(False, "No user ID in signup response")
                return False
            
            print(f"   Created user ID: {user_id}")
            
            # Step 2: Check if profile was created by trigger
            print("\n   Step 2: Checking if profile was created by handle_new_user trigger...")
            
            # Use service role to check profiles table
            service_headers = {
                'apikey': SUPABASE_SERVICE_ROLE,
                'Authorization': f'Bearer {SUPABASE_SERVICE_ROLE}',
                'Content-Type': 'application/json'
            }
            
            # Wait a moment for trigger to execute
            import time
            time.sleep(2)
            
            profile_response = requests.get(
                f"{SUPABASE_URL}/rest/v1/profiles?id=eq.{user_id}&select=*",
                headers=service_headers,
                timeout=10
            )
            
            print(f"   Profile check status: {profile_response.status_code}")
            
            if profile_response.status_code == 200:
                profiles = profile_response.json()
                print(f"   Profile response: {json.dumps(profiles, indent=2)}")
                
                if isinstance(profiles, list) and len(profiles) > 0:
                    profile = profiles[0]
                    has_email = profile.get('email') == test_email
                    has_first_name = profile.get('first_name') == 'Test'
                    has_last_name = profile.get('last_name') == 'User'
                    has_role = profile.get('role') == 'tenant_admin'
                    
                    print(f"   Profile email matches: {has_email}")
                    print(f"   Profile first_name matches: {has_first_name}")
                    print(f"   Profile last_name matches: {has_last_name}")
                    print(f"   Profile role matches: {has_role}")
                    
                    success = has_email and has_first_name and has_last_name and has_role
                    print_result(success, f"Profile created correctly by trigger: {success}")
                    return success
                else:
                    print_result(False, "Profile not found - trigger may not have executed")
                    return False
            else:
                print_result(False, f"Failed to check profile: {profile_response.status_code}")
                return False
                
        except Exception as e:
            print_result(False, f"Failed to parse signup response: {str(e)}")
            return False
            
    except Exception as e:
        print_result(False, f"Exception: {str(e)}")
        return False

# =============================================================================
# Main Test Runner
# =============================================================================
def main():
    print("\n" + "="*80)
    print("RESERVA360 SUPABASE + RESEND INTEGRATION TEST SUITE")
    print(f"Base URL: {BASE_URL}")
    print(f"Supabase URL: {SUPABASE_URL}")
    print(f"Timestamp: {datetime.now().isoformat()}")
    print("="*80)
    
    results = {}
    
    # Run all tests
    results['Landing Page'] = test_landing_page()
    results['Auth Login Page'] = test_auth_login_page()
    results['Auth Signup Page'] = test_auth_signup_page()
    results['Dashboard Redirect'] = test_dashboard_redirect()
    results['Cron Without Secret'] = test_cron_without_secret()
    results['Cron With Secret'] = test_cron_with_secret()
    results['Supabase Plans Table'] = test_supabase_plans_table()
    results['Supabase RPC get_public_tenant'] = test_supabase_rpc_get_public_tenant()
    results['Supabase Auth Signup + Trigger'] = test_supabase_auth_signup()
    
    # Summary
    print("\n" + "="*80)
    print("TEST SUMMARY")
    print("="*80)
    
    passed = sum(1 for v in results.values() if v)
    total = len(results)
    
    for test_name, result in results.items():
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"{status}: {test_name}")
    
    print(f"\n{'='*80}")
    print(f"TOTAL: {passed}/{total} tests passed ({passed*100//total}%)")
    print(f"{'='*80}\n")
    
    return passed == total

if __name__ == "__main__":
    success = main()
    exit(0 if success else 1)
