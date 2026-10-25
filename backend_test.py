#!/usr/bin/env python3
"""
Backend test for customer self-management API: GET/POST /api/public/appointment/[id]
Tests reschedule/cancel functionality with timezone handling, business hours validation, etc.
"""

import os
import sys
import json
import requests
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo
import uuid

# Load environment variables
from dotenv import load_dotenv
load_dotenv('/app/.env')

BASE_URL = os.getenv('NEXT_PUBLIC_BASE_URL', 'http://localhost:3000')
SUPABASE_URL = os.getenv('NEXT_PUBLIC_SUPABASE_URL')
SUPABASE_SERVICE_KEY = os.getenv('SUPABASE_SERVICE_ROLE_KEY')
SUPABASE_ANON_KEY = os.getenv('NEXT_PUBLIC_SUPABASE_ANON_KEY')

# Supabase REST API headers
SERVICE_HEADERS = {
    'apikey': SUPABASE_SERVICE_KEY,
    'Authorization': f'Bearer {SUPABASE_SERVICE_KEY}',
    'Content-Type': 'application/json',
    'Prefer': 'return=representation'
}

ANON_HEADERS = {
    'apikey': SUPABASE_ANON_KEY,
    'Authorization': f'Bearer {SUPABASE_ANON_KEY}',
    'Content-Type': 'application/json',
    'Prefer': 'return=representation'
}

# Test data IDs (will be populated during setup)
test_data = {
    'tenant_id': None,
    'tenant_slug': None,
    'employee_id': None,
    'service_id': None,
    'client_id': None,
    'appointment_id': None,
    'appointment2_id': None,  # For overlap test
}

def log(msg):
    print(f"[TEST] {msg}")

def get_madrid_offset(dt):
    """Get timezone offset in minutes for Madrid at given datetime (JS getTimezoneOffset format)"""
    madrid_tz = ZoneInfo('Europe/Madrid')
    madrid_dt = dt.astimezone(madrid_tz)
    offset_seconds = madrid_dt.utcoffset().total_seconds()
    # JS getTimezoneOffset returns negative values for positive offsets
    return int(-offset_seconds / 60)

def get_next_weekday(weekday=0):
    """Get next occurrence of weekday (0=Monday, 6=Sunday) at 10:00 Madrid time"""
    madrid_tz = ZoneInfo('Europe/Madrid')
    now = datetime.now(madrid_tz)
    days_ahead = weekday - now.weekday()
    if days_ahead <= 0:
        days_ahead += 7
    target = now + timedelta(days=days_ahead)
    target = target.replace(hour=10, minute=0, second=0, microsecond=0)
    return target

def supabase_request(method, table, data=None, params=None, headers=None):
    """Make a request to Supabase REST API"""
    if headers is None:
        headers = SERVICE_HEADERS
    
    url = f"{SUPABASE_URL}/rest/v1/{table}"
    if params:
        url += '?' + '&'.join([f"{k}={v}" for k, v in params.items()])
    
    if method == 'GET':
        resp = requests.get(url, headers=headers)
    elif method == 'POST':
        resp = requests.post(url, headers=headers, json=data)
    elif method == 'PATCH':
        resp = requests.patch(url, headers=headers, json=data)
    elif method == 'DELETE':
        resp = requests.delete(url, headers=headers)
    else:
        raise ValueError(f"Unsupported method: {method}")
    
    return resp

def supabase_rpc(function_name, params, headers=None):
    """Call a Supabase RPC function"""
    if headers is None:
        headers = ANON_HEADERS
    
    url = f"{SUPABASE_URL}/rest/v1/rpc/{function_name}"
    resp = requests.post(url, headers=headers, json=params)
    return resp

def setup_test_data():
    """Create isolated test data"""
    log("=== SETUP: Creating test data ===")
    
    # Generate unique slug
    test_slug = f"test-manage-{uuid.uuid4().hex[:8]}"
    test_data['tenant_slug'] = test_slug
    
    # 1. Create test tenant
    log(f"Creating test tenant with slug: {test_slug}")
    business_hours = {
        "1": {"enabled": True, "from": "09:00", "to": "19:00", "breakFrom": "14:00", "breakTo": "15:00"},
        "2": {"enabled": True, "from": "09:00", "to": "19:00", "breakFrom": "14:00", "breakTo": "15:00"},
        "3": {"enabled": True, "from": "09:00", "to": "19:00", "breakFrom": "14:00", "breakTo": "15:00"},
        "4": {"enabled": True, "from": "09:00", "to": "19:00", "breakFrom": "14:00", "breakTo": "15:00"},
        "5": {"enabled": True, "from": "09:00", "to": "19:00", "breakFrom": "14:00", "breakTo": "15:00"},
        "6": {"enabled": True, "from": "10:00", "to": "14:00"},
        "0": {"enabled": False}
    }
    
    tenant_data = {
        'slug': test_slug,
        'name': f'Test Tenant {test_slug}',
        'status': 'active',
        'business_hours': business_hours,
        'vacations': []
    }
    
    resp = supabase_request('POST', 'tenants', tenant_data)
    if resp.status_code not in [200, 201]:
        log(f"❌ Failed to create tenant: {resp.status_code} {resp.text}")
        return False
    
    tenant = resp.json()[0]
    test_data['tenant_id'] = tenant['id']
    log(f"✅ Created tenant: {tenant['id']}")
    
    # 2. Create employee
    log("Creating test employee")
    employee_data = {
        'tenant_id': test_data['tenant_id'],
        'first_name': 'Test',
        'last_name': 'Employee',
        'email': f'employee-{test_slug}@test.com',
        'schedule': {},  # Empty = inherits business hours
        'active': True
    }
    
    resp = supabase_request('POST', 'employees', employee_data)
    if resp.status_code not in [200, 201]:
        log(f"❌ Failed to create employee: {resp.status_code} {resp.text}")
        return False
    
    employee = resp.json()[0]
    test_data['employee_id'] = employee['id']
    log(f"✅ Created employee: {employee['id']}")
    
    # 3. Create service
    log("Creating test service")
    service_data = {
        'tenant_id': test_data['tenant_id'],
        'name': 'Test Service',
        'duration_minutes': 60,
        'price': 30,
        'active': True
    }
    
    resp = supabase_request('POST', 'services', service_data)
    if resp.status_code not in [200, 201]:
        log(f"❌ Failed to create service: {resp.status_code} {resp.text}")
        return False
    
    service = resp.json()[0]
    test_data['service_id'] = service['id']
    log(f"✅ Created service: {service['id']}")
    
    # 4. Create appointment for next Monday at 10:00 Madrid time
    log("Creating test appointment for next Monday at 10:00 Madrid time")
    monday = get_next_weekday(0)  # 0 = Monday
    monday_utc = monday.astimezone(ZoneInfo('UTC'))
    
    log(f"   Monday local time: {monday.isoformat()}")
    log(f"   Monday UTC time: {monday_utc.isoformat()}")
    
    # Use create_public_booking RPC
    booking_params = {
        'p_tenant_slug': test_slug,
        'p_service_id': test_data['service_id'],
        'p_employee_id': test_data['employee_id'],
        'p_start': monday_utc.isoformat(),
        'p_client_first_name': 'Test',
        'p_client_last_name': 'Client',
        'p_client_email': f'client-{test_slug}@test.com',
        'p_client_phone': '+34600000000',
        'p_client_notes': 'Test appointment'
    }
    
    resp = supabase_rpc('create_public_booking', booking_params, ANON_HEADERS)
    if resp.status_code not in [200, 201]:
        log(f"❌ Failed to create appointment: {resp.status_code} {resp.text}")
        return False
    
    appointment_id = resp.json()
    test_data['appointment_id'] = appointment_id
    log(f"✅ Created appointment: {appointment_id}")
    
    # Get client_id from the appointment
    resp = supabase_request('GET', 'appointments', params={'id': f'eq.{appointment_id}', 'select': 'client_id'})
    if resp.status_code == 200 and resp.json():
        test_data['client_id'] = resp.json()[0]['client_id']
        log(f"✅ Found client: {test_data['client_id']}")
    
    log("=== SETUP COMPLETE ===\n")
    return True

def cleanup_test_data():
    """Delete all test data"""
    log("\n=== CLEANUP: Deleting test data ===")
    
    # Delete in reverse order of dependencies
    if test_data['appointment_id']:
        log(f"Deleting appointment: {test_data['appointment_id']}")
        supabase_request('DELETE', 'appointments', params={'id': f"eq.{test_data['appointment_id']}"})
    
    if test_data['appointment2_id']:
        log(f"Deleting appointment2: {test_data['appointment2_id']}")
        supabase_request('DELETE', 'appointments', params={'id': f"eq.{test_data['appointment2_id']}"})
    
    if test_data['client_id']:
        log(f"Deleting client: {test_data['client_id']}")
        supabase_request('DELETE', 'clients', params={'id': f"eq.{test_data['client_id']}"})
    
    if test_data['service_id']:
        log(f"Deleting service: {test_data['service_id']}")
        supabase_request('DELETE', 'services', params={'id': f"eq.{test_data['service_id']}"})
    
    if test_data['employee_id']:
        log(f"Deleting employee: {test_data['employee_id']}")
        supabase_request('DELETE', 'employees', params={'id': f"eq.{test_data['employee_id']}"})
    
    if test_data['tenant_id']:
        log(f"Deleting tenant: {test_data['tenant_id']}")
        supabase_request('DELETE', 'tenants', params={'id': f"eq.{test_data['tenant_id']}"})
    
    log("=== CLEANUP COMPLETE ===")

def run_tests():
    """Run all tests"""
    results = []
    
    # Test 1: GET returns 200 with correct structure
    log("\n[TEST 1] GET /api/public/appointment/[id] returns 200 with correct data")
    try:
        resp = requests.get(f"{BASE_URL}/api/public/appointment/{test_data['appointment_id']}")
        if resp.status_code == 200:
            data = resp.json()
            has_tenant = 'tenant' in data and 'slug' in data['tenant'] and 'business_hours' in data['tenant']
            has_employee = 'employee' in data and 'schedule' in data['employee']
            has_service = 'service' in data and 'duration_minutes' in data['service']
            
            if has_tenant and has_employee and has_service:
                log("✅ PASS: GET returns 200 with tenant.slug, tenant.business_hours, employee.schedule, service.duration_minutes")
                results.append(("Test 1: GET valid appointment", "PASS", None))
            else:
                log(f"❌ FAIL: Missing required fields. Data: {json.dumps(data, indent=2)}")
                results.append(("Test 1: GET valid appointment", "FAIL", "Missing required fields"))
        else:
            log(f"❌ FAIL: Expected 200, got {resp.status_code}: {resp.text}")
            results.append(("Test 1: GET valid appointment", "FAIL", f"Status {resp.status_code}"))
    except Exception as e:
        log(f"❌ FAIL: Exception: {e}")
        results.append(("Test 1: GET valid appointment", "FAIL", str(e)))
    
    # Test 1b: GET random uuid returns 404
    log("\n[TEST 1b] GET random uuid returns 404")
    try:
        random_id = str(uuid.uuid4())
        resp = requests.get(f"{BASE_URL}/api/public/appointment/{random_id}")
        if resp.status_code == 404:
            log("✅ PASS: GET random uuid returns 404")
            results.append(("Test 1b: GET random uuid", "PASS", None))
        else:
            log(f"❌ FAIL: Expected 404, got {resp.status_code}")
            results.append(("Test 1b: GET random uuid", "FAIL", f"Status {resp.status_code}"))
    except Exception as e:
        log(f"❌ FAIL: Exception: {e}")
        results.append(("Test 1b: GET random uuid", "FAIL", str(e)))
    
    # Test 2: POST reschedule to Tuesday 11:00
    log("\n[TEST 2] POST reschedule to Tuesday 11:00 local")
    try:
        tuesday = get_next_weekday(1)  # 1 = Tuesday
        tuesday = tuesday.replace(hour=11, minute=0)
        tuesday_utc = tuesday.astimezone(ZoneInfo('UTC'))
        tz_offset = get_madrid_offset(tuesday)
        
        log(f"   Tuesday local: {tuesday.isoformat()}")
        log(f"   Tuesday UTC: {tuesday_utc.isoformat()}")
        log(f"   tz_offset: {tz_offset}")
        
        resp = requests.post(
            f"{BASE_URL}/api/public/appointment/{test_data['appointment_id']}",
            json={
                'action': 'reschedule',
                'start_at': tuesday_utc.isoformat(),
                'tz_offset': tz_offset
            }
        )
        
        if resp.status_code == 200:
            data = resp.json()
            log(f"✅ PASS: Rescheduled to Tuesday 11:00. Response: {data}")
            results.append(("Test 2: Reschedule to Tuesday 11:00", "PASS", None))
        else:
            log(f"❌ FAIL: Expected 200, got {resp.status_code}: {resp.text}")
            results.append(("Test 2: Reschedule to Tuesday 11:00", "FAIL", f"Status {resp.status_code}: {resp.text}"))
    except Exception as e:
        log(f"❌ FAIL: Exception: {e}")
        results.append(("Test 2: Reschedule to Tuesday 11:00", "FAIL", str(e)))
    
    # Test 3: Outside hours - Tuesday 08:00 (before opening)
    log("\n[TEST 3] POST reschedule to Tuesday 08:00 (before opening) → 400")
    try:
        tuesday = get_next_weekday(1)
        tuesday = tuesday.replace(hour=8, minute=0)
        tuesday_utc = tuesday.astimezone(ZoneInfo('UTC'))
        tz_offset = get_madrid_offset(tuesday)
        
        resp = requests.post(
            f"{BASE_URL}/api/public/appointment/{test_data['appointment_id']}",
            json={
                'action': 'reschedule',
                'start_at': tuesday_utc.isoformat(),
                'tz_offset': tz_offset
            }
        )
        
        if resp.status_code == 400:
            log(f"✅ PASS: Tuesday 08:00 rejected with 400: {resp.json().get('error')}")
            results.append(("Test 3: Tuesday 08:00 (before opening)", "PASS", None))
        else:
            log(f"❌ FAIL: Expected 400, got {resp.status_code}: {resp.text}")
            results.append(("Test 3: Tuesday 08:00 (before opening)", "FAIL", f"Status {resp.status_code}"))
    except Exception as e:
        log(f"❌ FAIL: Exception: {e}")
        results.append(("Test 3: Tuesday 08:00 (before opening)", "FAIL", str(e)))
    
    # Test 4: Outside hours - Tuesday 18:30 (ends 19:30, after closing)
    log("\n[TEST 4] POST reschedule to Tuesday 18:30 (ends 19:30, after closing) → 400")
    try:
        tuesday = get_next_weekday(1)
        tuesday = tuesday.replace(hour=18, minute=30)
        tuesday_utc = tuesday.astimezone(ZoneInfo('UTC'))
        tz_offset = get_madrid_offset(tuesday)
        
        resp = requests.post(
            f"{BASE_URL}/api/public/appointment/{test_data['appointment_id']}",
            json={
                'action': 'reschedule',
                'start_at': tuesday_utc.isoformat(),
                'tz_offset': tz_offset
            }
        )
        
        if resp.status_code == 400:
            log(f"✅ PASS: Tuesday 18:30 rejected with 400: {resp.json().get('error')}")
            results.append(("Test 4: Tuesday 18:30 (ends after closing)", "PASS", None))
        else:
            log(f"❌ FAIL: Expected 400, got {resp.status_code}: {resp.text}")
            results.append(("Test 4: Tuesday 18:30 (ends after closing)", "FAIL", f"Status {resp.status_code}"))
    except Exception as e:
        log(f"❌ FAIL: Exception: {e}")
        results.append(("Test 4: Tuesday 18:30 (ends after closing)", "FAIL", str(e)))
    
    # Test 5: Sunday (closed)
    log("\n[TEST 5] POST reschedule to Sunday 11:00 (closed) → 400")
    try:
        sunday = get_next_weekday(6)  # 6 = Sunday
        sunday = sunday.replace(hour=11, minute=0)
        sunday_utc = sunday.astimezone(ZoneInfo('UTC'))
        tz_offset = get_madrid_offset(sunday)
        
        resp = requests.post(
            f"{BASE_URL}/api/public/appointment/{test_data['appointment_id']}",
            json={
                'action': 'reschedule',
                'start_at': sunday_utc.isoformat(),
                'tz_offset': tz_offset
            }
        )
        
        if resp.status_code == 400:
            log(f"✅ PASS: Sunday rejected with 400: {resp.json().get('error')}")
            results.append(("Test 5: Sunday (closed)", "PASS", None))
        else:
            log(f"❌ FAIL: Expected 400, got {resp.status_code}: {resp.text}")
            results.append(("Test 5: Sunday (closed)", "FAIL", f"Status {resp.status_code}"))
    except Exception as e:
        log(f"❌ FAIL: Exception: {e}")
        results.append(("Test 5: Sunday (closed)", "FAIL", str(e)))
    
    # Test 6: Saturday 13:30 (ends 14:30, after closing at 14:00)
    log("\n[TEST 6] POST reschedule to Saturday 13:30 (ends 14:30 > 14:00) → 400")
    try:
        saturday = get_next_weekday(5)  # 5 = Saturday
        saturday = saturday.replace(hour=13, minute=30)
        saturday_utc = saturday.astimezone(ZoneInfo('UTC'))
        tz_offset = get_madrid_offset(saturday)
        
        resp = requests.post(
            f"{BASE_URL}/api/public/appointment/{test_data['appointment_id']}",
            json={
                'action': 'reschedule',
                'start_at': saturday_utc.isoformat(),
                'tz_offset': tz_offset
            }
        )
        
        if resp.status_code == 400:
            log(f"✅ PASS: Saturday 13:30 rejected with 400: {resp.json().get('error')}")
            results.append(("Test 6: Saturday 13:30 (ends after closing)", "PASS", None))
        else:
            log(f"❌ FAIL: Expected 400, got {resp.status_code}: {resp.text}")
            results.append(("Test 6: Saturday 13:30 (ends after closing)", "FAIL", f"Status {resp.status_code}"))
    except Exception as e:
        log(f"❌ FAIL: Exception: {e}")
        results.append(("Test 6: Saturday 13:30 (ends after closing)", "FAIL", str(e)))
    
    # Test 7: Saturday 10:00 (valid)
    log("\n[TEST 7] POST reschedule to Saturday 10:00 → 200")
    try:
        saturday = get_next_weekday(5)
        saturday = saturday.replace(hour=10, minute=0)
        saturday_utc = saturday.astimezone(ZoneInfo('UTC'))
        tz_offset = get_madrid_offset(saturday)
        
        resp = requests.post(
            f"{BASE_URL}/api/public/appointment/{test_data['appointment_id']}",
            json={
                'action': 'reschedule',
                'start_at': saturday_utc.isoformat(),
                'tz_offset': tz_offset
            }
        )
        
        if resp.status_code == 200:
            log(f"✅ PASS: Saturday 10:00 accepted")
            results.append(("Test 7: Saturday 10:00 (valid)", "PASS", None))
        else:
            log(f"❌ FAIL: Expected 200, got {resp.status_code}: {resp.text}")
            results.append(("Test 7: Saturday 10:00 (valid)", "FAIL", f"Status {resp.status_code}: {resp.text}"))
    except Exception as e:
        log(f"❌ FAIL: Exception: {e}")
        results.append(("Test 7: Saturday 10:00 (valid)", "FAIL", str(e)))
    
    # Test 8: Break time - weekday 14:00 (break 14:00-15:00)
    log("\n[TEST 8] POST reschedule to weekday 14:00 (break time) → 400")
    try:
        tuesday = get_next_weekday(1)
        tuesday = tuesday.replace(hour=14, minute=0)
        tuesday_utc = tuesday.astimezone(ZoneInfo('UTC'))
        tz_offset = get_madrid_offset(tuesday)
        
        resp = requests.post(
            f"{BASE_URL}/api/public/appointment/{test_data['appointment_id']}",
            json={
                'action': 'reschedule',
                'start_at': tuesday_utc.isoformat(),
                'tz_offset': tz_offset
            }
        )
        
        if resp.status_code == 400:
            log(f"✅ PASS: Weekday 14:00 (break) rejected with 400: {resp.json().get('error')}")
            results.append(("Test 8: Weekday 14:00 (break)", "PASS", None))
        else:
            log(f"❌ FAIL: Expected 400, got {resp.status_code}: {resp.text}")
            results.append(("Test 8: Weekday 14:00 (break)", "FAIL", f"Status {resp.status_code}"))
    except Exception as e:
        log(f"❌ FAIL: Exception: {e}")
        results.append(("Test 8: Weekday 14:00 (break)", "FAIL", str(e)))
    
    # Test 9: Break time - weekday 13:30 (ends 14:30, overlaps break)
    log("\n[TEST 9] POST reschedule to weekday 13:30 (ends 14:30, overlaps break) → 400")
    try:
        tuesday = get_next_weekday(1)
        tuesday = tuesday.replace(hour=13, minute=30)
        tuesday_utc = tuesday.astimezone(ZoneInfo('UTC'))
        tz_offset = get_madrid_offset(tuesday)
        
        resp = requests.post(
            f"{BASE_URL}/api/public/appointment/{test_data['appointment_id']}",
            json={
                'action': 'reschedule',
                'start_at': tuesday_utc.isoformat(),
                'tz_offset': tz_offset
            }
        )
        
        if resp.status_code == 400:
            log(f"✅ PASS: Weekday 13:30 (overlaps break) rejected with 400: {resp.json().get('error')}")
            results.append(("Test 9: Weekday 13:30 (overlaps break)", "PASS", None))
        else:
            log(f"❌ FAIL: Expected 400, got {resp.status_code}: {resp.text}")
            results.append(("Test 9: Weekday 13:30 (overlaps break)", "FAIL", f"Status {resp.status_code}"))
    except Exception as e:
        log(f"❌ FAIL: Exception: {e}")
        results.append(("Test 9: Weekday 13:30 (overlaps break)", "FAIL", str(e)))
    
    # Test 10: After break - weekday 15:00
    log("\n[TEST 10] POST reschedule to weekday 15:00 (after break) → 200")
    try:
        tuesday = get_next_weekday(1)
        tuesday = tuesday.replace(hour=15, minute=0)
        tuesday_utc = tuesday.astimezone(ZoneInfo('UTC'))
        tz_offset = get_madrid_offset(tuesday)
        
        resp = requests.post(
            f"{BASE_URL}/api/public/appointment/{test_data['appointment_id']}",
            json={
                'action': 'reschedule',
                'start_at': tuesday_utc.isoformat(),
                'tz_offset': tz_offset
            }
        )
        
        if resp.status_code == 200:
            log(f"✅ PASS: Weekday 15:00 (after break) accepted")
            results.append(("Test 10: Weekday 15:00 (after break)", "PASS", None))
        else:
            log(f"❌ FAIL: Expected 200, got {resp.status_code}: {resp.text}")
            results.append(("Test 10: Weekday 15:00 (after break)", "FAIL", f"Status {resp.status_code}: {resp.text}"))
    except Exception as e:
        log(f"❌ FAIL: Exception: {e}")
        results.append(("Test 10: Weekday 15:00 (after break)", "FAIL", str(e)))
    
    # Test 11: Timezone correctness - weekday 09:00 local should be accepted
    log("\n[TEST 11] POST reschedule to weekday 09:00 local (opening time) → 200")
    try:
        wednesday = get_next_weekday(2)  # 2 = Wednesday
        wednesday = wednesday.replace(hour=9, minute=0)
        wednesday_utc = wednesday.astimezone(ZoneInfo('UTC'))
        tz_offset = get_madrid_offset(wednesday)
        
        log(f"   Wednesday 09:00 local: {wednesday.isoformat()}")
        log(f"   Wednesday UTC: {wednesday_utc.isoformat()}")
        log(f"   tz_offset: {tz_offset}")
        
        resp = requests.post(
            f"{BASE_URL}/api/public/appointment/{test_data['appointment_id']}",
            json={
                'action': 'reschedule',
                'start_at': wednesday_utc.isoformat(),
                'tz_offset': tz_offset
            }
        )
        
        if resp.status_code == 200:
            log(f"✅ PASS: Weekday 09:00 local accepted (timezone handling correct)")
            results.append(("Test 11: Weekday 09:00 local (timezone)", "PASS", None))
        else:
            log(f"❌ FAIL: Expected 200, got {resp.status_code}: {resp.text}")
            results.append(("Test 11: Weekday 09:00 local (timezone)", "FAIL", f"Status {resp.status_code}: {resp.text}"))
    except Exception as e:
        log(f"❌ FAIL: Exception: {e}")
        results.append(("Test 11: Weekday 09:00 local (timezone)", "FAIL", str(e)))
    
    # Test 12: Without tz_offset, should fallback to Madrid and accept 09:00 local
    log("\n[TEST 12] POST reschedule to weekday 09:00 WITHOUT tz_offset (fallback to Madrid) → 200")
    try:
        thursday = get_next_weekday(3)  # 3 = Thursday
        thursday = thursday.replace(hour=9, minute=0)
        thursday_utc = thursday.astimezone(ZoneInfo('UTC'))
        
        resp = requests.post(
            f"{BASE_URL}/api/public/appointment/{test_data['appointment_id']}",
            json={
                'action': 'reschedule',
                'start_at': thursday_utc.isoformat()
                # No tz_offset - should fallback to Madrid
            }
        )
        
        if resp.status_code == 200:
            log(f"✅ PASS: Weekday 09:00 without tz_offset accepted (fallback working)")
            results.append(("Test 12: Weekday 09:00 without tz_offset", "PASS", None))
        else:
            log(f"❌ FAIL: Expected 200, got {resp.status_code}: {resp.text}")
            results.append(("Test 12: Weekday 09:00 without tz_offset", "FAIL", f"Status {resp.status_code}: {resp.text}"))
    except Exception as e:
        log(f"❌ FAIL: Exception: {e}")
        results.append(("Test 12: Weekday 09:00 without tz_offset", "FAIL", str(e)))
    
    # Test 13: Past date
    log("\n[TEST 13] POST reschedule to past date → 400")
    try:
        past = datetime.now(ZoneInfo('Europe/Madrid')) - timedelta(days=1)
        past_utc = past.astimezone(ZoneInfo('UTC'))
        tz_offset = get_madrid_offset(past)
        
        resp = requests.post(
            f"{BASE_URL}/api/public/appointment/{test_data['appointment_id']}",
            json={
                'action': 'reschedule',
                'start_at': past_utc.isoformat(),
                'tz_offset': tz_offset
            }
        )
        
        if resp.status_code == 400:
            log(f"✅ PASS: Past date rejected with 400: {resp.json().get('error')}")
            results.append(("Test 13: Past date", "PASS", None))
        else:
            log(f"❌ FAIL: Expected 400, got {resp.status_code}: {resp.text}")
            results.append(("Test 13: Past date", "FAIL", f"Status {resp.status_code}"))
    except Exception as e:
        log(f"❌ FAIL: Exception: {e}")
        results.append(("Test 13: Past date", "FAIL", str(e)))
    
    # Test 14: Invalid start_at string
    log("\n[TEST 14] POST reschedule with invalid start_at → 400")
    try:
        resp = requests.post(
            f"{BASE_URL}/api/public/appointment/{test_data['appointment_id']}",
            json={
                'action': 'reschedule',
                'start_at': 'invalid-date',
                'tz_offset': -60
            }
        )
        
        if resp.status_code == 400:
            log(f"✅ PASS: Invalid start_at rejected with 400: {resp.json().get('error')}")
            results.append(("Test 14: Invalid start_at", "PASS", None))
        else:
            log(f"❌ FAIL: Expected 400, got {resp.status_code}: {resp.text}")
            results.append(("Test 14: Invalid start_at", "FAIL", f"Status {resp.status_code}"))
    except Exception as e:
        log(f"❌ FAIL: Exception: {e}")
        results.append(("Test 14: Invalid start_at", "FAIL", str(e)))
    
    # Test 15: Missing start_at
    log("\n[TEST 15] POST reschedule without start_at → 400")
    try:
        resp = requests.post(
            f"{BASE_URL}/api/public/appointment/{test_data['appointment_id']}",
            json={
                'action': 'reschedule',
                'tz_offset': -60
            }
        )
        
        if resp.status_code == 400:
            log(f"✅ PASS: Missing start_at rejected with 400: {resp.json().get('error')}")
            results.append(("Test 15: Missing start_at", "PASS", None))
        else:
            log(f"❌ FAIL: Expected 400, got {resp.status_code}: {resp.text}")
            results.append(("Test 15: Missing start_at", "FAIL", f"Status {resp.status_code}"))
    except Exception as e:
        log(f"❌ FAIL: Exception: {e}")
        results.append(("Test 15: Missing start_at", "FAIL", str(e)))
    
    # Test 16: Overlap detection - create second appointment and try to reschedule first to overlap
    log("\n[TEST 16] Overlap detection: create 2nd appointment, reschedule 1st to overlap → 409")
    try:
        # Create second appointment at Wednesday 10:00
        wednesday = get_next_weekday(2)
        wednesday = wednesday.replace(hour=10, minute=0)
        wednesday_utc = wednesday.astimezone(ZoneInfo('UTC'))
        
        booking_params = {
            'p_tenant_slug': test_data['tenant_slug'],
            'p_service_id': test_data['service_id'],
            'p_employee_id': test_data['employee_id'],
            'p_start': wednesday_utc.isoformat(),
            'p_client_first_name': 'Test',
            'p_client_last_name': 'Client2',
            'p_client_email': f'client2-{test_data["tenant_slug"]}@test.com',
            'p_client_phone': '+34600000001'
        }
        
        resp = supabase_rpc('create_public_booking', booking_params, ANON_HEADERS)
        if resp.status_code not in [200, 201]:
            log(f"❌ FAIL: Could not create 2nd appointment: {resp.status_code} {resp.text}")
            results.append(("Test 16: Overlap detection", "FAIL", "Could not create 2nd appointment"))
        else:
            test_data['appointment2_id'] = resp.json()
            log(f"   Created 2nd appointment at Wednesday 10:00: {test_data['appointment2_id']}")
            
            # Try to reschedule first appointment to Wednesday 10:30 (overlaps with 10:00-11:00)
            wednesday_1030 = wednesday.replace(hour=10, minute=30)
            wednesday_1030_utc = wednesday_1030.astimezone(ZoneInfo('UTC'))
            tz_offset = get_madrid_offset(wednesday_1030)
            
            resp = requests.post(
                f"{BASE_URL}/api/public/appointment/{test_data['appointment_id']}",
                json={
                    'action': 'reschedule',
                    'start_at': wednesday_1030_utc.isoformat(),
                    'tz_offset': tz_offset
                }
            )
            
            if resp.status_code == 409:
                log(f"✅ PASS: Overlap detected, rejected with 409: {resp.json().get('error')}")
                results.append(("Test 16: Overlap detection", "PASS", None))
            else:
                log(f"❌ FAIL: Expected 409, got {resp.status_code}: {resp.text}")
                results.append(("Test 16: Overlap detection", "FAIL", f"Status {resp.status_code}"))
    except Exception as e:
        log(f"❌ FAIL: Exception: {e}")
        results.append(("Test 16: Overlap detection", "FAIL", str(e)))
    
    # Test 17: Reschedule to same time (own appointment excluded)
    log("\n[TEST 17] Reschedule to its own current slot → 200")
    try:
        # Get current appointment time
        resp = requests.get(f"{BASE_URL}/api/public/appointment/{test_data['appointment_id']}")
        if resp.status_code == 200:
            current_start = resp.json()['start_at']
            current_dt = datetime.fromisoformat(current_start.replace('Z', '+00:00'))
            tz_offset = get_madrid_offset(current_dt)
            
            resp = requests.post(
                f"{BASE_URL}/api/public/appointment/{test_data['appointment_id']}",
                json={
                    'action': 'reschedule',
                    'start_at': current_start,
                    'tz_offset': tz_offset
                }
            )
            
            if resp.status_code == 200:
                log(f"✅ PASS: Reschedule to same time accepted (own appointment excluded)")
                results.append(("Test 17: Reschedule to same time", "PASS", None))
            else:
                log(f"❌ FAIL: Expected 200, got {resp.status_code}: {resp.text}")
                results.append(("Test 17: Reschedule to same time", "FAIL", f"Status {resp.status_code}: {resp.text}"))
        else:
            log(f"❌ FAIL: Could not get current appointment")
            results.append(("Test 17: Reschedule to same time", "FAIL", "Could not get current appointment"))
    except Exception as e:
        log(f"❌ FAIL: Exception: {e}")
        results.append(("Test 17: Reschedule to same time", "FAIL", str(e)))
    
    # Test 18: Employee schedule override
    log("\n[TEST 18] Employee schedule override: set employee to Mon 09:00-12:00 only")
    try:
        # Update employee schedule to only Monday 09:00-12:00
        employee_schedule = {
            "1": {"enabled": True, "from": "09:00", "to": "12:00"},
            "2": {"enabled": False},
            "3": {"enabled": False},
            "4": {"enabled": False},
            "5": {"enabled": False},
            "6": {"enabled": False},
            "0": {"enabled": False}
        }
        
        resp = supabase_request('PATCH', 'employees', 
                               data={'schedule': employee_schedule},
                               params={'id': f"eq.{test_data['employee_id']}"})
        
        if resp.status_code not in [200, 204]:
            log(f"❌ FAIL: Could not update employee schedule: {resp.status_code} {resp.text}")
            results.append(("Test 18a: Update employee schedule", "FAIL", f"Status {resp.status_code}"))
        else:
            log(f"   Updated employee schedule to Mon 09:00-12:00 only")
            
            # Test 18a: Try Tuesday 10:00 (employee doesn't work)
            tuesday = get_next_weekday(1)
            tuesday = tuesday.replace(hour=10, minute=0)
            tuesday_utc = tuesday.astimezone(ZoneInfo('UTC'))
            tz_offset = get_madrid_offset(tuesday)
            
            resp = requests.post(
                f"{BASE_URL}/api/public/appointment/{test_data['appointment_id']}",
                json={
                    'action': 'reschedule',
                    'start_at': tuesday_utc.isoformat(),
                    'tz_offset': tz_offset
                }
            )
            
            if resp.status_code == 400:
                error_msg = resp.json().get('error', '')
                log(f"✅ PASS: Tuesday rejected (employee doesn't work): {error_msg}")
                results.append(("Test 18a: Tuesday (employee off)", "PASS", None))
            else:
                log(f"❌ FAIL: Expected 400, got {resp.status_code}: {resp.text}")
                results.append(("Test 18a: Tuesday (employee off)", "FAIL", f"Status {resp.status_code}"))
            
            # Test 18b: Try Monday 11:30 (ends 12:30, after employee end time)
            monday = get_next_weekday(0)
            monday = monday.replace(hour=11, minute=30)
            monday_utc = monday.astimezone(ZoneInfo('UTC'))
            tz_offset = get_madrid_offset(monday)
            
            resp = requests.post(
                f"{BASE_URL}/api/public/appointment/{test_data['appointment_id']}",
                json={
                    'action': 'reschedule',
                    'start_at': monday_utc.isoformat(),
                    'tz_offset': tz_offset
                }
            )
            
            if resp.status_code == 400:
                log(f"✅ PASS: Monday 11:30 rejected (ends after employee schedule): {resp.json().get('error')}")
                results.append(("Test 18b: Monday 11:30 (ends after employee time)", "PASS", None))
            else:
                log(f"❌ FAIL: Expected 400, got {resp.status_code}: {resp.text}")
                results.append(("Test 18b: Monday 11:30 (ends after employee time)", "FAIL", f"Status {resp.status_code}"))
            
            # Test 18c: Try Monday 10:00 (valid within employee schedule)
            monday = get_next_weekday(0)
            monday = monday.replace(hour=10, minute=0)
            monday_utc = monday.astimezone(ZoneInfo('UTC'))
            tz_offset = get_madrid_offset(monday)
            
            resp = requests.post(
                f"{BASE_URL}/api/public/appointment/{test_data['appointment_id']}",
                json={
                    'action': 'reschedule',
                    'start_at': monday_utc.isoformat(),
                    'tz_offset': tz_offset
                }
            )
            
            if resp.status_code == 200:
                log(f"✅ PASS: Monday 10:00 accepted (within employee schedule)")
                results.append(("Test 18c: Monday 10:00 (valid)", "PASS", None))
            else:
                log(f"❌ FAIL: Expected 200, got {resp.status_code}: {resp.text}")
                results.append(("Test 18c: Monday 10:00 (valid)", "FAIL", f"Status {resp.status_code}: {resp.text}"))
    except Exception as e:
        log(f"❌ FAIL: Exception: {e}")
        results.append(("Test 18: Employee schedule override", "FAIL", str(e)))
    
    # Test 19: Availability endpoint
    log("\n[TEST 19] GET /api/public/<slug>/availability returns busy entries")
    try:
        monday = get_next_weekday(0)
        date_str = monday.strftime('%Y-%m-%d')
        
        resp = requests.get(
            f"{BASE_URL}/api/public/{test_data['tenant_slug']}/availability",
            params={
                'date': date_str,
                'employee_id': test_data['employee_id']
            }
        )
        
        if resp.status_code == 200:
            data = resp.json()
            if 'busy' in data and isinstance(data['busy'], list):
                log(f"✅ PASS: Availability endpoint returns busy array with {len(data['busy'])} entries")
                results.append(("Test 19: Availability endpoint", "PASS", None))
            else:
                log(f"❌ FAIL: Response missing 'busy' array: {data}")
                results.append(("Test 19: Availability endpoint", "FAIL", "Missing busy array"))
        else:
            log(f"❌ FAIL: Expected 200, got {resp.status_code}: {resp.text}")
            results.append(("Test 19: Availability endpoint", "FAIL", f"Status {resp.status_code}"))
    except Exception as e:
        log(f"❌ FAIL: Exception: {e}")
        results.append(("Test 19: Availability endpoint", "FAIL", str(e)))
    
    # Test 20: Cancel action
    log("\n[TEST 20] POST {action:'cancel'} → 200 and status 'cancelled'")
    try:
        resp = requests.post(
            f"{BASE_URL}/api/public/appointment/{test_data['appointment_id']}",
            json={'action': 'cancel'}
        )
        
        if resp.status_code == 200:
            data = resp.json()
            if data.get('status') == 'cancelled':
                log(f"✅ PASS: Appointment cancelled successfully")
                results.append(("Test 20: Cancel action", "PASS", None))
                
                # Test 20b: Try to reschedule cancelled appointment
                log("\n[TEST 20b] Try to reschedule cancelled appointment → 400")
                tuesday = get_next_weekday(1)
                tuesday = tuesday.replace(hour=10, minute=0)
                tuesday_utc = tuesday.astimezone(ZoneInfo('UTC'))
                tz_offset = get_madrid_offset(tuesday)
                
                resp = requests.post(
                    f"{BASE_URL}/api/public/appointment/{test_data['appointment_id']}",
                    json={
                        'action': 'reschedule',
                        'start_at': tuesday_utc.isoformat(),
                        'tz_offset': tz_offset
                    }
                )
                
                if resp.status_code == 400:
                    error_msg = resp.json().get('error', '')
                    log(f"✅ PASS: Reschedule after cancel rejected: {error_msg}")
                    results.append(("Test 20b: Reschedule after cancel", "PASS", None))
                else:
                    log(f"❌ FAIL: Expected 400, got {resp.status_code}: {resp.text}")
                    results.append(("Test 20b: Reschedule after cancel", "FAIL", f"Status {resp.status_code}"))
            else:
                log(f"❌ FAIL: Status not 'cancelled': {data}")
                results.append(("Test 20: Cancel action", "FAIL", f"Status: {data.get('status')}"))
        else:
            log(f"❌ FAIL: Expected 200, got {resp.status_code}: {resp.text}")
            results.append(("Test 20: Cancel action", "FAIL", f"Status {resp.status_code}"))
    except Exception as e:
        log(f"❌ FAIL: Exception: {e}")
        results.append(("Test 20: Cancel action", "FAIL", str(e)))
    
    # Test 21: Unknown action
    log("\n[TEST 21] POST {action:'unknown'} → 400")
    try:
        resp = requests.post(
            f"{BASE_URL}/api/public/appointment/{test_data['appointment_id']}",
            json={'action': 'unknown'}
        )
        
        if resp.status_code == 400:
            log(f"✅ PASS: Unknown action rejected with 400: {resp.json().get('error')}")
            results.append(("Test 21: Unknown action", "PASS", None))
        else:
            log(f"❌ FAIL: Expected 400, got {resp.status_code}: {resp.text}")
            results.append(("Test 21: Unknown action", "FAIL", f"Status {resp.status_code}"))
    except Exception as e:
        log(f"❌ FAIL: Exception: {e}")
        results.append(("Test 21: Unknown action", "FAIL", str(e)))
    
    # Test 22: Frontend pages
    log("\n[TEST 22] GET /manage/<id> page returns 200")
    try:
        resp = requests.get(f"{BASE_URL}/manage/{test_data['appointment_id']}")
        if resp.status_code == 200:
            log(f"✅ PASS: Manage page returns 200")
            results.append(("Test 22: Manage page", "PASS", None))
        else:
            log(f"❌ FAIL: Expected 200, got {resp.status_code}")
            results.append(("Test 22: Manage page", "FAIL", f"Status {resp.status_code}"))
    except Exception as e:
        log(f"❌ FAIL: Exception: {e}")
        results.append(("Test 22: Manage page", "FAIL", str(e)))
    
    log("\n[TEST 23] GET /manage/<id>?action=reschedule returns 200")
    try:
        resp = requests.get(f"{BASE_URL}/manage/{test_data['appointment_id']}?action=reschedule")
        if resp.status_code == 200:
            log(f"✅ PASS: Manage page with action=reschedule returns 200")
            results.append(("Test 23: Manage page with action=reschedule", "PASS", None))
        else:
            log(f"❌ FAIL: Expected 200, got {resp.status_code}")
            results.append(("Test 23: Manage page with action=reschedule", "FAIL", f"Status {resp.status_code}"))
    except Exception as e:
        log(f"❌ FAIL: Exception: {e}")
        results.append(("Test 23: Manage page with action=reschedule", "FAIL", str(e)))
    
    return results

def main():
    """Main test execution"""
    print("=" * 80)
    print("CUSTOMER SELF-MANAGEMENT API TEST")
    print("Testing: GET/POST /api/public/appointment/[id]")
    print("=" * 80)
    
    # Setup
    if not setup_test_data():
        log("❌ Setup failed, aborting tests")
        sys.exit(1)
    
    try:
        # Run tests
        results = run_tests()
        
        # Print summary
        print("\n" + "=" * 80)
        print("TEST SUMMARY")
        print("=" * 80)
        
        passed = sum(1 for _, status, _ in results if status == "PASS")
        failed = sum(1 for _, status, _ in results if status == "FAIL")
        
        for test_name, status, error in results:
            symbol = "✅" if status == "PASS" else "❌"
            print(f"{symbol} {test_name}: {status}")
            if error:
                print(f"   Error: {error}")
        
        print("\n" + "=" * 80)
        print(f"TOTAL: {passed} passed, {failed} failed out of {len(results)} tests")
        print("=" * 80)
        
        # Cleanup
        cleanup_test_data()
        
        # Exit with appropriate code
        sys.exit(0 if failed == 0 else 1)
        
    except Exception as e:
        log(f"❌ Test execution failed: {e}")
        import traceback
        traceback.print_exc()
        cleanup_test_data()
        sys.exit(1)

if __name__ == '__main__':
    main()
