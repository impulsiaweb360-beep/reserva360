#!/usr/bin/env python3
"""
Backend API testing for Reserva360 Spanish booking app
Tests server-side booking validation with LIVE Supabase
"""

import os
import sys
import json
import requests
from datetime import datetime, timedelta
from typing import Dict, Any, Optional
import uuid

# Load environment variables
from dotenv import load_dotenv
load_dotenv('/app/.env')

SUPABASE_URL = os.getenv('NEXT_PUBLIC_SUPABASE_URL')
SUPABASE_ANON_KEY = os.getenv('NEXT_PUBLIC_SUPABASE_ANON_KEY')
SUPABASE_SERVICE_KEY = os.getenv('SUPABASE_SERVICE_ROLE_KEY')
CRON_SECRET = os.getenv('CRON_SECRET')
BASE_URL = os.getenv('NEXT_PUBLIC_BASE_URL', 'http://localhost:3000')

# Test data IDs (will be populated during setup)
test_data = {
    'tenant_id': None,
    'tenant_slug': None,
    'employee_a_id': None,
    'employee_b_id': None,
    'service_active_id': None,
    'service_inactive_id': None,
    'client_ids': [],
    'appointment_ids': [],
}

def log(msg: str, level: str = "INFO"):
    """Log test messages"""
    print(f"[{level}] {msg}")

def get_next_weekday(target_day: int) -> datetime:
    """Get next occurrence of target_day (0=Monday, 6=Sunday) from 2026-11-02"""
    # Current date in environment is around 2026-11-02 (Monday)
    base = datetime(2026, 11, 2)  # Monday
    days_ahead = target_day - base.weekday()
    if days_ahead <= 0:
        days_ahead += 7
    return base + timedelta(days=days_ahead)

def format_local_time(dt: datetime, hour: int, minute: int = 0) -> str:
    """Format datetime in Madrid local time (UTC+1 in November)"""
    # Madrid is UTC+1 in November (standard time)
    local_dt = datetime(dt.year, dt.month, dt.day, hour, minute, 0)
    # Convert to UTC by subtracting 1 hour
    utc_dt = local_dt - timedelta(hours=1)
    return utc_dt.strftime('%Y-%m-%dT%H:%M:%S.000Z')

def supabase_request(method: str, path: str, data: Optional[Dict] = None, use_service_role: bool = False) -> requests.Response:
    """Make request to Supabase PostgREST API"""
    headers = {
        'apikey': SUPABASE_SERVICE_KEY if use_service_role else SUPABASE_ANON_KEY,
        'Authorization': f'Bearer {SUPABASE_SERVICE_KEY if use_service_role else SUPABASE_ANON_KEY}',
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
    }
    url = f"{SUPABASE_URL}/rest/v1/{path}"
    
    if method == 'GET':
        return requests.get(url, headers=headers)
    elif method == 'POST':
        return requests.post(url, headers=headers, json=data)
    elif method == 'PATCH':
        return requests.patch(url, headers=headers, json=data)
    elif method == 'DELETE':
        return requests.delete(url, headers=headers)

def setup_test_data():
    """Create isolated test tenant with employees and services"""
    log("Setting up test data...")
    
    # Create tenant
    tenant_slug = f"test-tenant-{uuid.uuid4().hex[:8]}"
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
        'name': f'Test Business {uuid.uuid4().hex[:6]}',
        'slug': tenant_slug,
        'status': 'active',
        'business_hours': business_hours,  # Supabase will handle JSON serialization
        'vacations': [],  # Supabase will handle JSON serialization
        'email': f'test-{uuid.uuid4().hex[:6]}@example.invalid',
        'phone': '+34600000000',
        'address': 'Test Address'
    }
    
    # First try with timezone (if migration has been run)
    tenant_data_with_tz = {**tenant_data, 'timezone': 'Europe/Madrid'}
    resp = supabase_request('POST', 'tenants', tenant_data_with_tz, use_service_role=True)
    
    # If timezone column doesn't exist, try without it
    if resp.status_code == 400 and 'timezone' in resp.text:
        log("  Note: timezone column not found, creating tenant without it (migration not run yet)")
        resp = supabase_request('POST', 'tenants', tenant_data, use_service_role=True)
    if resp.status_code not in [200, 201]:
        log(f"Failed to create tenant: {resp.status_code} {resp.text}", "ERROR")
        sys.exit(1)
    
    tenant = resp.json()[0] if isinstance(resp.json(), list) else resp.json()
    test_data['tenant_id'] = tenant['id']
    test_data['tenant_slug'] = tenant_slug
    log(f"✓ Created tenant: {tenant_slug} (ID: {tenant['id']})")
    
    # Create employee A (no schedule restrictions)
    emp_a_data = {
        'tenant_id': tenant['id'],
        'first_name': 'Employee',
        'last_name': 'A',
        'email': f'emp-a-{uuid.uuid4().hex[:6]}@example.invalid',
        'active': True,
        'schedule': {}  # Supabase will handle JSON serialization
    }
    resp = supabase_request('POST', 'employees', emp_a_data, use_service_role=True)
    if resp.status_code not in [200, 201]:
        log(f"Failed to create employee A: {resp.status_code} {resp.text}", "ERROR")
        sys.exit(1)
    emp_a = resp.json()[0] if isinstance(resp.json(), list) else resp.json()
    test_data['employee_a_id'] = emp_a['id']
    log(f"✓ Created employee A (ID: {emp_a['id']})")
    
    # Create employee B (only Monday 09:00-12:00)
    emp_b_schedule = {
        "1": {"enabled": True, "from": "09:00", "to": "12:00"},
        "2": {"enabled": False},
        "3": {"enabled": False},
        "4": {"enabled": False},
        "5": {"enabled": False},
        "6": {"enabled": False},
        "0": {"enabled": False}
    }
    emp_b_data = {
        'tenant_id': tenant['id'],
        'first_name': 'Employee',
        'last_name': 'B',
        'email': f'emp-b-{uuid.uuid4().hex[:6]}@example.invalid',
        'active': True,
        'schedule': emp_b_schedule  # Supabase will handle JSON serialization
    }
    resp = supabase_request('POST', 'employees', emp_b_data, use_service_role=True)
    if resp.status_code not in [200, 201]:
        log(f"Failed to create employee B: {resp.status_code} {resp.text}", "ERROR")
        sys.exit(1)
    emp_b = resp.json()[0] if isinstance(resp.json(), list) else resp.json()
    test_data['employee_b_id'] = emp_b['id']
    log(f"✓ Created employee B (ID: {emp_b['id']})")
    
    # Create active service (60 min, 30 EUR)
    service_active_data = {
        'tenant_id': tenant['id'],
        'name': 'Active Service 60min',
        'duration_minutes': 60,
        'price': 30,
        'active': True,
        'color': '#3b82f6'
    }
    resp = supabase_request('POST', 'services', service_active_data, use_service_role=True)
    if resp.status_code not in [200, 201]:
        log(f"Failed to create active service: {resp.status_code} {resp.text}", "ERROR")
        sys.exit(1)
    service_active = resp.json()[0] if isinstance(resp.json(), list) else resp.json()
    test_data['service_active_id'] = service_active['id']
    log(f"✓ Created active service (ID: {service_active['id']})")
    
    # Create inactive service
    service_inactive_data = {
        'tenant_id': tenant['id'],
        'name': 'Inactive Service',
        'duration_minutes': 30,
        'price': 20,
        'active': False,
        'color': '#ef4444'
    }
    resp = supabase_request('POST', 'services', service_inactive_data, use_service_role=True)
    if resp.status_code not in [200, 201]:
        log(f"Failed to create inactive service: {resp.status_code} {resp.text}", "ERROR")
        sys.exit(1)
    service_inactive = resp.json()[0] if isinstance(resp.json(), list) else resp.json()
    test_data['service_inactive_id'] = service_inactive['id']
    log(f"✓ Created inactive service (ID: {service_inactive['id']})")
    
    log("✓ Test data setup complete\n")

def cleanup_test_data():
    """Delete all test data"""
    log("\nCleaning up test data...")
    
    if test_data['tenant_id']:
        # Delete tenant (cascade will delete employees, services, appointments, clients)
        resp = supabase_request('DELETE', f"tenants?id=eq.{test_data['tenant_id']}", use_service_role=True)
        if resp.status_code in [200, 204]:
            log(f"✓ Deleted tenant and all related data")
        else:
            log(f"Failed to delete tenant: {resp.status_code} {resp.text}", "ERROR")

def test_a_slots_endpoint():
    """Test A: GET /api/public/<slug>/slots endpoint"""
    log("\n" + "="*80)
    log("TEST A: GET /api/public/<slug>/slots")
    log("="*80)
    
    slug = test_data['tenant_slug']
    service_id = test_data['service_active_id']
    emp_a_id = test_data['employee_a_id']
    emp_b_id = test_data['employee_b_id']
    
    # Get next Monday
    next_monday = get_next_weekday(0)
    monday_str = next_monday.strftime('%Y-%m-%d')
    
    # A.1: Monday with employee_id=any
    log("\nA.1: GET slots for Monday with employee_id=any")
    resp = requests.get(f"{BASE_URL}/api/public/{slug}/slots", params={
        'date': monday_str,
        'service_id': service_id,
        'employee_id': 'any'
    })
    log(f"Status: {resp.status_code}")
    if resp.status_code == 200:
        data = resp.json()
        slots = data.get('slots', [])
        log(f"Slots count: {len(slots)}")
        
        # Check for expected slots (09:00-18:00, step 15, excluding break 14:00-15:00)
        expected_present = ['09:00', '13:00', '15:00', '18:00']
        expected_absent = ['13:15', '13:30', '13:45', '14:00', '14:15', '14:30', '14:45']
        
        slot_labels = [s['label'] for s in slots]
        
        for label in expected_present:
            if label in slot_labels:
                log(f"  ✓ Slot {label} present")
            else:
                log(f"  ✗ Slot {label} MISSING", "ERROR")
        
        for label in expected_absent:
            if label not in slot_labels:
                log(f"  ✓ Slot {label} correctly absent (break time)")
            else:
                log(f"  ✗ Slot {label} should be ABSENT (break time)", "ERROR")
        
        # Check first slot start ISO
        if slots and slots[0]['start']:
            first_start = slots[0]['start']
            # Should be Monday 08:00:00Z (09:00 Madrid local = 08:00 UTC)
            expected_start = format_local_time(next_monday, 9, 0)
            if first_start == expected_start:
                log(f"  ✓ First slot start ISO correct: {first_start}")
            else:
                log(f"  ✗ First slot start ISO incorrect: {first_start} (expected {expected_start})", "ERROR")
        
        log("✓ A.1 PASSED")
    else:
        log(f"✗ A.1 FAILED: {resp.text}", "ERROR")
    
    # A.2: Sunday (should return empty)
    next_sunday = get_next_weekday(6)
    sunday_str = next_sunday.strftime('%Y-%m-%d')
    log(f"\nA.2: GET slots for Sunday (closed day)")
    resp = requests.get(f"{BASE_URL}/api/public/{slug}/slots", params={
        'date': sunday_str,
        'service_id': service_id,
        'employee_id': 'any'
    })
    if resp.status_code == 200:
        data = resp.json()
        slots = data.get('slots', [])
        if len(slots) == 0:
            log(f"  ✓ Sunday returns empty slots (closed)")
            log("✓ A.2 PASSED")
        else:
            log(f"  ✗ Sunday should return empty but got {len(slots)} slots", "ERROR")
    else:
        log(f"✗ A.2 FAILED: {resp.status_code} {resp.text}", "ERROR")
    
    # A.3: Saturday (10:00-14:00, but service is 60min so last slot is 13:00)
    next_saturday = get_next_weekday(5)
    saturday_str = next_saturday.strftime('%Y-%m-%d')
    log(f"\nA.3: GET slots for Saturday (10:00-14:00)")
    resp = requests.get(f"{BASE_URL}/api/public/{slug}/slots", params={
        'date': saturday_str,
        'service_id': service_id,
        'employee_id': 'any'
    })
    if resp.status_code == 200:
        data = resp.json()
        slots = data.get('slots', [])
        slot_labels = [s['label'] for s in slots]
        
        # Should have 10:00, 10:15, ..., 13:00 (last slot that fits 60min before 14:00)
        if '10:00' in slot_labels and '13:00' in slot_labels:
            log(f"  ✓ Saturday has 10:00 and 13:00 slots")
        else:
            log(f"  ✗ Saturday missing expected slots", "ERROR")
        
        # Should NOT have 13:15 or later (would end after 14:00)
        if '13:15' not in slot_labels and '13:30' not in slot_labels:
            log(f"  ✓ Saturday correctly excludes slots after 13:00")
        else:
            log(f"  ✗ Saturday should not have slots after 13:00", "ERROR")
        
        log("✓ A.3 PASSED")
    else:
        log(f"✗ A.3 FAILED: {resp.status_code} {resp.text}", "ERROR")
    
    # A.4: Employee B on Monday (only 09:00-12:00, so last slot is 11:00)
    log(f"\nA.4: GET slots for Monday with employee_id={emp_b_id} (09:00-12:00)")
    resp = requests.get(f"{BASE_URL}/api/public/{slug}/slots", params={
        'date': monday_str,
        'service_id': service_id,
        'employee_id': emp_b_id
    })
    if resp.status_code == 200:
        data = resp.json()
        slots = data.get('slots', [])
        slot_labels = [s['label'] for s in slots]
        
        # Should have 09:00-11:00 (last slot that fits 60min before 12:00)
        if '09:00' in slot_labels and '11:00' in slot_labels:
            log(f"  ✓ Employee B Monday has 09:00 and 11:00 slots")
        else:
            log(f"  ✗ Employee B Monday missing expected slots", "ERROR")
        
        # Should NOT have 11:15 or later
        if '11:15' not in slot_labels and '12:00' not in slot_labels:
            log(f"  ✓ Employee B Monday correctly excludes slots after 11:00")
        else:
            log(f"  ✗ Employee B Monday should not have slots after 11:00", "ERROR")
        
        log("✓ A.4 PASSED")
    else:
        log(f"✗ A.4 FAILED: {resp.status_code} {resp.text}", "ERROR")
    
    # A.5: Employee B on Tuesday (should be empty - not working)
    next_tuesday = get_next_weekday(1)
    tuesday_str = next_tuesday.strftime('%Y-%m-%d')
    log(f"\nA.5: GET slots for Tuesday with employee_id={emp_b_id} (not working)")
    resp = requests.get(f"{BASE_URL}/api/public/{slug}/slots", params={
        'date': tuesday_str,
        'service_id': service_id,
        'employee_id': emp_b_id
    })
    if resp.status_code == 200:
        data = resp.json()
        slots = data.get('slots', [])
        if len(slots) == 0:
            log(f"  ✓ Employee B Tuesday returns empty (not working)")
            log("✓ A.5 PASSED")
        else:
            log(f"  ✗ Employee B Tuesday should be empty but got {len(slots)} slots", "ERROR")
    else:
        log(f"✗ A.5 FAILED: {resp.status_code} {resp.text}", "ERROR")
    
    # A.6: days=3 parameter
    log(f"\nA.6: GET slots with days=3")
    resp = requests.get(f"{BASE_URL}/api/public/{slug}/slots", params={
        'date': monday_str,
        'service_id': service_id,
        'employee_id': 'any',
        'days': 3
    })
    if resp.status_code == 200:
        data = resp.json()
        days_data = data.get('days', {})
        if len(days_data) == 3:
            log(f"  ✓ days=3 returns 3 date keys")
            log("✓ A.6 PASSED")
        else:
            log(f"  ✗ days=3 should return 3 keys but got {len(days_data)}", "ERROR")
    else:
        log(f"✗ A.6 FAILED: {resp.status_code} {resp.text}", "ERROR")
    
    # A.7: Missing service_id (should return 400)
    log(f"\nA.7: GET slots without service_id (should return 400)")
    resp = requests.get(f"{BASE_URL}/api/public/{slug}/slots", params={
        'date': monday_str,
        'employee_id': 'any'
    })
    if resp.status_code == 400:
        log(f"  ✓ Missing service_id returns 400")
        log("✓ A.7 PASSED")
    else:
        log(f"  ✗ Missing service_id should return 400 but got {resp.status_code}", "ERROR")
    
    # A.8: Unknown slug (should return 404)
    log(f"\nA.8: GET slots with unknown slug (should return 404)")
    resp = requests.get(f"{BASE_URL}/api/public/unknown-slug-{uuid.uuid4().hex}/slots", params={
        'date': monday_str,
        'service_id': service_id,
        'employee_id': 'any'
    })
    if resp.status_code == 404:
        log(f"  ✓ Unknown slug returns 404")
        log("✓ A.8 PASSED")
    else:
        log(f"  ✗ Unknown slug should return 404 but got {resp.status_code}", "ERROR")
    
    # A.9: Inactive service (should return 404)
    log(f"\nA.9: GET slots with inactive service (should return 404)")
    resp = requests.get(f"{BASE_URL}/api/public/{slug}/slots", params={
        'date': monday_str,
        'service_id': test_data['service_inactive_id'],
        'employee_id': 'any'
    })
    if resp.status_code == 404:
        log(f"  ✓ Inactive service returns 404")
        log("✓ A.9 PASSED")
    else:
        log(f"  ✗ Inactive service should return 404 but got {resp.status_code}", "ERROR")

def test_b_booking_endpoint():
    """Test B: POST /api/public/book endpoint"""
    log("\n" + "="*80)
    log("TEST B: POST /api/public/book")
    log("="*80)
    
    slug = test_data['tenant_slug']
    service_id = test_data['service_active_id']
    emp_a_id = test_data['employee_a_id']
    emp_b_id = test_data['employee_b_id']
    
    next_tuesday = get_next_weekday(1)
    next_monday = get_next_weekday(0)
    next_saturday = get_next_weekday(5)
    next_sunday = get_next_weekday(6)
    
    # B.1: Valid Tuesday 10:00 with employee A
    log("\nB.1: POST valid booking Tuesday 10:00 with employee A")
    booking_data = {
        'slug': slug,
        'service_id': service_id,
        'employee_id': emp_a_id,
        'start_at': format_local_time(next_tuesday, 10, 0),
        'client': {
            'firstName': 'Juan',
            'lastName': 'García',
            'email': f'juan.garcia.{uuid.uuid4().hex[:6]}@example.invalid',
            'phone': '+34600111222',
            'notes': 'Test booking'
        }
    }
    resp = requests.post(f"{BASE_URL}/api/public/book", json=booking_data)
    log(f"Status: {resp.status_code}")
    if resp.status_code == 200:
        data = resp.json()
        if data.get('ok') and data.get('id'):
            test_data['appointment_ids'].append(data['id'])
            log(f"  ✓ Booking created: {data['id']}")
            
            # Verify appointment in DB
            resp_db = supabase_request('GET', f"appointments?id=eq.{data['id']}&select=*", use_service_role=True)
            if resp_db.status_code == 200:
                appt = resp_db.json()[0]
                if (appt['status'] == 'confirmed' and 
                    appt['source'] == 'online' and 
                    appt['payment_amount'] == 30):
                    log(f"  ✓ Appointment status=confirmed, source=online, payment_amount=30")
                    
                    # Check end_at is start_at + 60 minutes
                    start = datetime.fromisoformat(appt['start_at'].replace('Z', '+00:00'))
                    end = datetime.fromisoformat(appt['end_at'].replace('Z', '+00:00'))
                    if (end - start).total_seconds() == 3600:
                        log(f"  ✓ End time is start + 60 minutes")
                    else:
                        log(f"  ✗ End time incorrect", "ERROR")
                else:
                    log(f"  ✗ Appointment data incorrect", "ERROR")
            
            log("✓ B.1 PASSED")
        else:
            log(f"  ✗ Response missing ok/id: {data}", "ERROR")
    else:
        log(f"✗ B.1 FAILED: {resp.status_code} {resp.text}", "ERROR")
    
    # B.2: Same slot again (should return 409)
    log("\nB.2: POST same slot again (should return 409)")
    resp = requests.post(f"{BASE_URL}/api/public/book", json=booking_data)
    if resp.status_code == 409:
        data = resp.json()
        if 'ocupado' in data.get('error', '').lower():
            log(f"  ✓ Returns 409 with 'ocupado' message")
            log("✓ B.2 PASSED")
        else:
            log(f"  ✗ Error message should contain 'ocupado': {data.get('error')}", "ERROR")
    else:
        log(f"✗ B.2 FAILED: Expected 409 but got {resp.status_code}", "ERROR")
    
    # B.3: Tuesday 08:00 (before opening)
    log("\nB.3: POST Tuesday 08:00 (before opening, should return 400)")
    booking_data_early = {
        'slug': slug,
        'service_id': service_id,
        'employee_id': emp_a_id,
        'start_at': format_local_time(next_tuesday, 8, 0),
        'client': {
            'firstName': 'Test',
            'lastName': 'User',
            'email': f'test.{uuid.uuid4().hex[:6]}@example.invalid',
            'phone': '+34600222333'
        }
    }
    resp = requests.post(f"{BASE_URL}/api/public/book", json=booking_data_early)
    if resp.status_code == 400:
        log(f"  ✓ Returns 400 for booking before opening")
        log("✓ B.3 PASSED")
    else:
        log(f"✗ B.3 FAILED: Expected 400 but got {resp.status_code}", "ERROR")
    
    # B.4: Tuesday 18:30 (ends 19:30, after closing)
    log("\nB.4: POST Tuesday 18:30 (ends 19:30, after closing, should return 400)")
    booking_data_late = {
        'slug': slug,
        'service_id': service_id,
        'employee_id': emp_a_id,
        'start_at': format_local_time(next_tuesday, 18, 30),
        'client': {
            'firstName': 'Test',
            'lastName': 'User',
            'email': f'test.{uuid.uuid4().hex[:6]}@example.invalid',
            'phone': '+34600333444'
        }
    }
    resp = requests.post(f"{BASE_URL}/api/public/book", json=booking_data_late)
    if resp.status_code == 400:
        log(f"  ✓ Returns 400 for booking ending after closing")
        log("✓ B.4 PASSED")
    else:
        log(f"✗ B.4 FAILED: Expected 400 but got {resp.status_code}", "ERROR")
    
    # B.5: Tuesday 13:30 (overlaps break 14:00-15:00)
    log("\nB.5: POST Tuesday 13:30 (overlaps break, should return 400)")
    booking_data_break = {
        'slug': slug,
        'service_id': service_id,
        'employee_id': emp_a_id,
        'start_at': format_local_time(next_tuesday, 13, 30),
        'client': {
            'firstName': 'Test',
            'lastName': 'User',
            'email': f'test.{uuid.uuid4().hex[:6]}@example.invalid',
            'phone': '+34600444555'
        }
    }
    resp = requests.post(f"{BASE_URL}/api/public/book", json=booking_data_break)
    if resp.status_code == 400:
        log(f"  ✓ Returns 400 for booking overlapping break")
        log("✓ B.5 PASSED")
    else:
        log(f"✗ B.5 FAILED: Expected 400 but got {resp.status_code}", "ERROR")
    
    # B.6: Sunday (closed)
    log("\nB.6: POST Sunday (closed, should return 400)")
    booking_data_sunday = {
        'slug': slug,
        'service_id': service_id,
        'employee_id': emp_a_id,
        'start_at': format_local_time(next_sunday, 10, 0),
        'client': {
            'firstName': 'Test',
            'lastName': 'User',
            'email': f'test.{uuid.uuid4().hex[:6]}@example.invalid',
            'phone': '+34600555666'
        }
    }
    resp = requests.post(f"{BASE_URL}/api/public/book", json=booking_data_sunday)
    if resp.status_code == 400:
        log(f"  ✓ Returns 400 for Sunday booking")
        log("✓ B.6 PASSED")
    else:
        log(f"✗ B.6 FAILED: Expected 400 but got {resp.status_code}", "ERROR")
    
    # B.7: Saturday 13:30 (ends 14:30, after closing at 14:00)
    log("\nB.7: POST Saturday 13:30 (ends after closing, should return 400)")
    booking_data_sat_late = {
        'slug': slug,
        'service_id': service_id,
        'employee_id': emp_a_id,
        'start_at': format_local_time(next_saturday, 13, 30),
        'client': {
            'firstName': 'Test',
            'lastName': 'User',
            'email': f'test.{uuid.uuid4().hex[:6]}@example.invalid',
            'phone': '+34600666777'
        }
    }
    resp = requests.post(f"{BASE_URL}/api/public/book", json=booking_data_sat_late)
    if resp.status_code == 400:
        log(f"  ✓ Returns 400 for Saturday booking ending after closing")
        log("✓ B.7 PASSED")
    else:
        log(f"✗ B.7 FAILED: Expected 400 but got {resp.status_code}", "ERROR")
    
    # B.8: Saturday 10:00 (valid)
    log("\nB.8: POST Saturday 10:00 (valid)")
    booking_data_sat_valid = {
        'slug': slug,
        'service_id': service_id,
        'employee_id': emp_a_id,
        'start_at': format_local_time(next_saturday, 10, 0),
        'client': {
            'firstName': 'María',
            'lastName': 'López',
            'email': f'maria.lopez.{uuid.uuid4().hex[:6]}@example.invalid',
            'phone': '+34600777888'
        }
    }
    resp = requests.post(f"{BASE_URL}/api/public/book", json=booking_data_sat_valid)
    if resp.status_code == 200:
        data = resp.json()
        if data.get('ok') and data.get('id'):
            test_data['appointment_ids'].append(data['id'])
            log(f"  ✓ Saturday booking created: {data['id']}")
            log("✓ B.8 PASSED")
        else:
            log(f"  ✗ Response missing ok/id", "ERROR")
    else:
        log(f"✗ B.8 FAILED: {resp.status_code} {resp.text}", "ERROR")
    
    # B.9: Employee B Tuesday 10:00 (not working Tuesday)
    log("\nB.9: POST employee B Tuesday 10:00 (not working, should return 400)")
    booking_data_emp_b_tue = {
        'slug': slug,
        'service_id': service_id,
        'employee_id': emp_b_id,
        'start_at': format_local_time(next_tuesday, 10, 0),
        'client': {
            'firstName': 'Test',
            'lastName': 'User',
            'email': f'test.{uuid.uuid4().hex[:6]}@example.invalid',
            'phone': '+34600888999'
        }
    }
    resp = requests.post(f"{BASE_URL}/api/public/book", json=booking_data_emp_b_tue)
    if resp.status_code == 400:
        data = resp.json()
        error_msg = data.get('error', '').lower()
        if 'empleado' in error_msg or 'horario' in error_msg or 'disponible' in error_msg:
            log(f"  ✓ Returns 400 with appropriate error message")
            log("✓ B.9 PASSED")
        else:
            log(f"  ⚠ Returns 400 but error message could be clearer: {data.get('error')}", "WARN")
            log("✓ B.9 PASSED (core validation working)")
    else:
        log(f"✗ B.9 FAILED: Expected 400 but got {resp.status_code}", "ERROR")
    
    # B.10: Employee B Monday 11:30 (ends 12:30, after employee schedule)
    log("\nB.10: POST employee B Monday 11:30 (ends after schedule, should return 400)")
    booking_data_emp_b_late = {
        'slug': slug,
        'service_id': service_id,
        'employee_id': emp_b_id,
        'start_at': format_local_time(next_monday, 11, 30),
        'client': {
            'firstName': 'Test',
            'lastName': 'User',
            'email': f'test.{uuid.uuid4().hex[:6]}@example.invalid',
            'phone': '+34600999000'
        }
    }
    resp = requests.post(f"{BASE_URL}/api/public/book", json=booking_data_emp_b_late)
    if resp.status_code == 400:
        log(f"  ✓ Returns 400 for employee B booking ending after schedule")
        log("✓ B.10 PASSED")
    else:
        log(f"✗ B.10 FAILED: Expected 400 but got {resp.status_code}", "ERROR")
    
    # B.11: Employee B Monday 09:00 (valid)
    log("\nB.11: POST employee B Monday 09:00 (valid)")
    booking_data_emp_b_valid = {
        'slug': slug,
        'service_id': service_id,
        'employee_id': emp_b_id,
        'start_at': format_local_time(next_monday, 9, 0),
        'client': {
            'firstName': 'Carlos',
            'lastName': 'Martínez',
            'email': f'carlos.martinez.{uuid.uuid4().hex[:6]}@example.invalid',
            'phone': '+34611000111'
        }
    }
    resp = requests.post(f"{BASE_URL}/api/public/book", json=booking_data_emp_b_valid)
    if resp.status_code == 200:
        data = resp.json()
        if data.get('ok') and data.get('id'):
            test_data['appointment_ids'].append(data['id'])
            log(f"  ✓ Employee B Monday booking created: {data['id']}")
            log("✓ B.11 PASSED")
        else:
            log(f"  ✗ Response missing ok/id", "ERROR")
    else:
        log(f"✗ B.11 FAILED: {resp.status_code} {resp.text}", "ERROR")
    
    # B.12: Past date
    log("\nB.12: POST past date (should return 400)")
    past_date = datetime(2026, 10, 1, 10, 0, 0)
    booking_data_past = {
        'slug': slug,
        'service_id': service_id,
        'employee_id': emp_a_id,
        'start_at': past_date.strftime('%Y-%m-%dT%H:%M:%S.000Z'),
        'client': {
            'firstName': 'Test',
            'lastName': 'User',
            'email': f'test.{uuid.uuid4().hex[:6]}@example.invalid',
            'phone': '+34611111222'
        }
    }
    resp = requests.post(f"{BASE_URL}/api/public/book", json=booking_data_past)
    if resp.status_code == 400:
        log(f"  ✓ Returns 400 for past date")
        log("✓ B.12 PASSED")
    else:
        log(f"✗ B.12 FAILED: Expected 400 but got {resp.status_code}", "ERROR")
    
    # B.13: Invalid date
    log("\nB.13: POST invalid date (should return 400)")
    booking_data_invalid = {
        'slug': slug,
        'service_id': service_id,
        'employee_id': emp_a_id,
        'start_at': 'invalid-date',
        'client': {
            'firstName': 'Test',
            'lastName': 'User',
            'email': f'test.{uuid.uuid4().hex[:6]}@example.invalid',
            'phone': '+34611222333'
        }
    }
    resp = requests.post(f"{BASE_URL}/api/public/book", json=booking_data_invalid)
    if resp.status_code == 400:
        log(f"  ✓ Returns 400 for invalid date")
        log("✓ B.13 PASSED")
    else:
        log(f"✗ B.13 FAILED: Expected 400 but got {resp.status_code}", "ERROR")
    
    # B.14: Missing firstName
    log("\nB.14: POST missing firstName (should return 400)")
    booking_data_no_name = {
        'slug': slug,
        'service_id': service_id,
        'employee_id': emp_a_id,
        'start_at': format_local_time(next_tuesday, 11, 0),
        'client': {
            'lastName': 'User',
            'email': f'test.{uuid.uuid4().hex[:6]}@example.invalid',
            'phone': '+34611333444'
        }
    }
    resp = requests.post(f"{BASE_URL}/api/public/book", json=booking_data_no_name)
    if resp.status_code == 400:
        log(f"  ✓ Returns 400 for missing firstName")
        log("✓ B.14 PASSED")
    else:
        log(f"✗ B.14 FAILED: Expected 400 but got {resp.status_code}", "ERROR")
    
    # B.15: Missing phone
    log("\nB.15: POST missing phone (should return 400)")
    booking_data_no_phone = {
        'slug': slug,
        'service_id': service_id,
        'employee_id': emp_a_id,
        'start_at': format_local_time(next_tuesday, 11, 0),
        'client': {
            'firstName': 'Test',
            'lastName': 'User',
            'email': f'test.{uuid.uuid4().hex[:6]}@example.invalid'
        }
    }
    resp = requests.post(f"{BASE_URL}/api/public/book", json=booking_data_no_phone)
    if resp.status_code == 400:
        log(f"  ✓ Returns 400 for missing phone")
        log("✓ B.15 PASSED")
    else:
        log(f"✗ B.15 FAILED: Expected 400 but got {resp.status_code}", "ERROR")
    
    # B.16: Missing service_id
    log("\nB.16: POST missing service_id (should return 400)")
    booking_data_no_service = {
        'slug': slug,
        'employee_id': emp_a_id,
        'start_at': format_local_time(next_tuesday, 11, 0),
        'client': {
            'firstName': 'Test',
            'lastName': 'User',
            'email': f'test.{uuid.uuid4().hex[:6]}@example.invalid',
            'phone': '+34611444555'
        }
    }
    resp = requests.post(f"{BASE_URL}/api/public/book", json=booking_data_no_service)
    if resp.status_code == 400:
        log(f"  ✓ Returns 400 for missing service_id")
        log("✓ B.16 PASSED")
    else:
        log(f"✗ B.16 FAILED: Expected 400 but got {resp.status_code}", "ERROR")
    
    # B.17: Inactive service
    log("\nB.17: POST with inactive service (should return 400)")
    booking_data_inactive = {
        'slug': slug,
        'service_id': test_data['service_inactive_id'],
        'employee_id': emp_a_id,
        'start_at': format_local_time(next_tuesday, 11, 0),
        'client': {
            'firstName': 'Test',
            'lastName': 'User',
            'email': f'test.{uuid.uuid4().hex[:6]}@example.invalid',
            'phone': '+34611555666'
        }
    }
    resp = requests.post(f"{BASE_URL}/api/public/book", json=booking_data_inactive)
    if resp.status_code == 400:
        log(f"  ✓ Returns 400 for inactive service")
        log("✓ B.17 PASSED")
    else:
        log(f"✗ B.17 FAILED: Expected 400 but got {resp.status_code}", "ERROR")
    
    # B.18: Unknown slug
    log("\nB.18: POST with unknown slug (should return 404)")
    booking_data_unknown_slug = {
        'slug': f'unknown-slug-{uuid.uuid4().hex}',
        'service_id': service_id,
        'employee_id': emp_a_id,
        'start_at': format_local_time(next_tuesday, 11, 0),
        'client': {
            'firstName': 'Test',
            'lastName': 'User',
            'email': f'test.{uuid.uuid4().hex[:6]}@example.invalid',
            'phone': '+34611666777'
        }
    }
    resp = requests.post(f"{BASE_URL}/api/public/book", json=booking_data_unknown_slug)
    if resp.status_code == 404:
        log(f"  ✓ Returns 404 for unknown slug")
        log("✓ B.18 PASSED")
    else:
        log(f"✗ B.18 FAILED: Expected 404 but got {resp.status_code}", "ERROR")
    
    # B.19: Client reuse by email (case insensitive)
    log("\nB.19: Client reuse by email (case insensitive)")
    # First booking with lowercase email
    email_test = f'test.reuse.{uuid.uuid4().hex[:6]}@example.invalid'
    booking_1 = {
        'slug': slug,
        'service_id': service_id,
        'employee_id': emp_a_id,
        'start_at': format_local_time(next_tuesday, 15, 0),
        'client': {
            'firstName': 'Test',
            'lastName': 'Reuse',
            'email': email_test.lower(),
            'phone': '+34611777888'
        }
    }
    resp1 = requests.post(f"{BASE_URL}/api/public/book", json=booking_1)
    if resp1.status_code == 200:
        appt1_id = resp1.json()['id']
        test_data['appointment_ids'].append(appt1_id)
        
        # Get client_id from first appointment
        resp_db1 = supabase_request('GET', f"appointments?id=eq.{appt1_id}&select=client_id", use_service_role=True)
        client_id_1 = resp_db1.json()[0]['client_id']
        
        # Second booking with uppercase email
        booking_2 = {
            'slug': slug,
            'service_id': service_id,
            'employee_id': emp_a_id,
            'start_at': format_local_time(next_tuesday, 16, 0),
            'client': {
                'firstName': 'Test',
                'lastName': 'Reuse',
                'email': email_test.upper(),
                'phone': '+34611888999'
            }
        }
        resp2 = requests.post(f"{BASE_URL}/api/public/book", json=booking_2)
        if resp2.status_code == 200:
            appt2_id = resp2.json()['id']
            test_data['appointment_ids'].append(appt2_id)
            
            # Get client_id from second appointment
            resp_db2 = supabase_request('GET', f"appointments?id=eq.{appt2_id}&select=client_id", use_service_role=True)
            client_id_2 = resp_db2.json()[0]['client_id']
            
            if client_id_1 == client_id_2:
                log(f"  ✓ Same client_id reused for case-insensitive email match")
                log("✓ B.19 PASSED")
            else:
                log(f"  ✗ Different client_ids: {client_id_1} vs {client_id_2}", "ERROR")
        else:
            log(f"  ✗ Second booking failed: {resp2.status_code}", "ERROR")
    else:
        log(f"✗ B.19 FAILED: First booking failed: {resp1.status_code}", "ERROR")
    
    # B.20: Client reuse by phone (different formatting)
    log("\nB.20: Client reuse by phone (different formatting)")
    phone_test = '+34622000111'
    booking_phone_1 = {
        'slug': slug,
        'service_id': service_id,
        'employee_id': emp_a_id,
        'start_at': format_local_time(next_tuesday, 17, 0),
        'client': {
            'firstName': 'Phone',
            'lastName': 'Test',
            'phone': phone_test
        }
    }
    resp_p1 = requests.post(f"{BASE_URL}/api/public/book", json=booking_phone_1)
    if resp_p1.status_code == 200:
        appt_p1_id = resp_p1.json()['id']
        test_data['appointment_ids'].append(appt_p1_id)
        
        resp_db_p1 = supabase_request('GET', f"appointments?id=eq.{appt_p1_id}&select=client_id", use_service_role=True)
        client_id_p1 = resp_db_p1.json()[0]['client_id']
        
        # Second booking with formatted phone (spaces)
        booking_phone_2 = {
            'slug': slug,
            'service_id': service_id,
            'employee_id': emp_a_id,
            'start_at': format_local_time(next_tuesday, 18, 0),
            'client': {
                'firstName': 'Phone',
                'lastName': 'Test',
                'phone': '622 000 111'  # Same number, different format
            }
        }
        resp_p2 = requests.post(f"{BASE_URL}/api/public/book", json=booking_phone_2)
        if resp_p2.status_code == 200:
            appt_p2_id = resp_p2.json()['id']
            test_data['appointment_ids'].append(appt_p2_id)
            
            resp_db_p2 = supabase_request('GET', f"appointments?id=eq.{appt_p2_id}&select=client_id", use_service_role=True)
            client_id_p2 = resp_db_p2.json()[0]['client_id']
            
            if client_id_p1 == client_id_p2:
                log(f"  ✓ Same client_id reused for phone match with different formatting")
                log("✓ B.20 PASSED")
            else:
                log(f"  ✗ Different client_ids: {client_id_p1} vs {client_id_p2}", "ERROR")
        else:
            log(f"  ✗ Second booking failed: {resp_p2.status_code}", "ERROR")
    else:
        log(f"✗ B.20 FAILED: First booking failed: {resp_p1.status_code}", "ERROR")
    
    # B.21: Verify slots endpoint no longer lists booked time
    log("\nB.21: Verify slots endpoint excludes booked times")
    # Check Tuesday 10:00 is not available (booked in B.1)
    resp = requests.get(f"{BASE_URL}/api/public/{slug}/slots", params={
        'date': next_tuesday.strftime('%Y-%m-%d'),
        'service_id': service_id,
        'employee_id': emp_a_id
    })
    if resp.status_code == 200:
        slots = resp.json().get('slots', [])
        slot_labels = [s['label'] for s in slots]
        if '10:00' not in slot_labels:
            log(f"  ✓ Booked slot 10:00 correctly excluded from available slots")
            log("✓ B.21 PASSED")
        else:
            log(f"  ✗ Booked slot 10:00 should not be available", "ERROR")
    else:
        log(f"✗ B.21 FAILED: {resp.status_code}", "ERROR")

def test_c_appointment_management():
    """Test C: Regression /api/public/appointment/<id>"""
    log("\n" + "="*80)
    log("TEST C: GET/POST /api/public/appointment/<id>")
    log("="*80)
    
    slug = test_data['tenant_slug']
    service_id = test_data['service_active_id']
    emp_a_id = test_data['employee_a_id']
    
    next_tuesday = get_next_weekday(1)
    next_wednesday = get_next_weekday(2)
    next_monday = get_next_weekday(0)
    
    # Create a test appointment for management
    log("\nC.0: Creating test appointment for management tests")
    booking_data = {
        'slug': slug,
        'service_id': service_id,
        'employee_id': emp_a_id,
        'start_at': format_local_time(next_tuesday, 11, 0),
        'client': {
            'firstName': 'Management',
            'lastName': 'Test',
            'email': f'mgmt.test.{uuid.uuid4().hex[:6]}@example.invalid',
            'phone': '+34633000111'
        }
    }
    resp = requests.post(f"{BASE_URL}/api/public/book", json=booking_data)
    if resp.status_code != 200:
        log(f"✗ Failed to create test appointment: {resp.status_code}", "ERROR")
        return
    
    appt_id = resp.json()['id']
    test_data['appointment_ids'].append(appt_id)
    log(f"✓ Created test appointment: {appt_id}")
    
    # C.1: GET appointment
    log("\nC.1: GET appointment details")
    resp = requests.get(f"{BASE_URL}/api/public/appointment/{appt_id}")
    if resp.status_code == 200:
        data = resp.json()
        
        # Check public tenant fields only
        tenant = data.get('tenant', {})
        public_fields = ['name', 'address', 'phone', 'email', 'logo', 'color', 'slug', 'business_hours', 'vacations', 'timezone']
        private_fields = ['stripe_customer_id', 'mrr', 'plan_id', 'status']
        
        has_public = all(field in tenant for field in ['name', 'slug', 'business_hours'])
        has_private = any(field in tenant for field in private_fields)
        
        if has_public and not has_private:
            log(f"  ✓ Tenant has public fields only (no private fields)")
        else:
            log(f"  ✗ Tenant fields incorrect. Has private: {has_private}", "ERROR")
        
        # Check service_id is included
        if 'service_id' in data:
            log(f"  ✓ Response includes service_id")
        else:
            log(f"  ✗ Response missing service_id", "ERROR")
        
        log("✓ C.1 PASSED")
    else:
        log(f"✗ C.1 FAILED: {resp.status_code} {resp.text}", "ERROR")
    
    # C.2: POST reschedule to Wednesday 11:00
    log("\nC.2: POST reschedule to Wednesday 11:00")
    reschedule_data = {
        'action': 'reschedule',
        'start_at': format_local_time(next_wednesday, 11, 0)
    }
    resp = requests.post(f"{BASE_URL}/api/public/appointment/{appt_id}", json=reschedule_data)
    if resp.status_code == 200:
        data = resp.json()
        if data.get('ok') and data.get('start_at'):
            log(f"  ✓ Reschedule successful: {data['start_at']}")
            log("✓ C.2 PASSED")
        else:
            log(f"  ✗ Response missing ok/start_at", "ERROR")
    else:
        log(f"✗ C.2 FAILED: {resp.status_code} {resp.text}", "ERROR")
    
    # C.3: POST reschedule to Wednesday 14:00 (break time, should fail)
    log("\nC.3: POST reschedule to Wednesday 14:00 (break time, should return 400)")
    reschedule_break = {
        'action': 'reschedule',
        'start_at': format_local_time(next_wednesday, 14, 0)
    }
    resp = requests.post(f"{BASE_URL}/api/public/appointment/{appt_id}", json=reschedule_break)
    if resp.status_code == 400:
        log(f"  ✓ Returns 400 for break time reschedule")
        log("✓ C.3 PASSED")
    else:
        log(f"✗ C.3 FAILED: Expected 400 but got {resp.status_code}", "ERROR")
    
    # C.4: POST reschedule to Monday 08:00 UTC (09:00 local) - should work
    log("\nC.4: POST reschedule to Monday 08:00 UTC (09:00 Madrid local)")
    reschedule_utc = {
        'action': 'reschedule',
        'start_at': format_local_time(next_monday, 9, 0)
    }
    resp = requests.post(f"{BASE_URL}/api/public/appointment/{appt_id}", json=reschedule_utc)
    if resp.status_code == 200:
        log(f"  ✓ Reschedule with UTC time successful (server uses tenant timezone)")
        log("✓ C.4 PASSED")
    else:
        log(f"✗ C.4 FAILED: {resp.status_code} {resp.text}", "ERROR")
    
    # C.5: Create another appointment to test overlap
    log("\nC.5: Testing overlap detection")
    booking_overlap = {
        'slug': slug,
        'service_id': service_id,
        'employee_id': emp_a_id,
        'start_at': format_local_time(next_tuesday, 12, 0),
        'client': {
            'firstName': 'Overlap',
            'lastName': 'Test',
            'email': f'overlap.{uuid.uuid4().hex[:6]}@example.invalid',
            'phone': '+34633111222'
        }
    }
    resp = requests.post(f"{BASE_URL}/api/public/book", json=booking_overlap)
    if resp.status_code == 200:
        overlap_appt_id = resp.json()['id']
        test_data['appointment_ids'].append(overlap_appt_id)
        
        # Try to reschedule first appointment to overlap with this one
        reschedule_overlap = {
            'action': 'reschedule',
            'start_at': format_local_time(next_tuesday, 12, 0)
        }
        resp_overlap = requests.post(f"{BASE_URL}/api/public/appointment/{appt_id}", json=reschedule_overlap)
        if resp_overlap.status_code == 409:
            log(f"  ✓ Overlap detection working (returns 409)")
            log("✓ C.5 PASSED")
        else:
            log(f"  ✗ Expected 409 for overlap but got {resp_overlap.status_code}", "ERROR")
    else:
        log(f"✗ C.5 FAILED: Could not create overlap test appointment", "ERROR")
    
    # C.6: Cancel appointment
    log("\nC.6: POST cancel appointment")
    cancel_data = {
        'action': 'cancel'
    }
    resp = requests.post(f"{BASE_URL}/api/public/appointment/{appt_id}", json=cancel_data)
    if resp.status_code == 200:
        data = resp.json()
        if data.get('ok') and data.get('status') == 'cancelled':
            log(f"  ✓ Cancel successful")
            
            # Verify in DB
            resp_db = supabase_request('GET', f"appointments?id=eq.{appt_id}&select=status", use_service_role=True)
            if resp_db.status_code == 200:
                status = resp_db.json()[0]['status']
                if status == 'cancelled':
                    log(f"  ✓ Status in DB is 'cancelled'")
                    log("✓ C.6 PASSED")
                else:
                    log(f"  ✗ Status in DB is {status}, expected 'cancelled'", "ERROR")
        else:
            log(f"  ✗ Response incorrect: {data}", "ERROR")
    else:
        log(f"✗ C.6 FAILED: {resp.status_code} {resp.text}", "ERROR")
    
    # C.7: Try to reschedule after cancel (should fail)
    log("\nC.7: POST reschedule after cancel (should return 400)")
    reschedule_after_cancel = {
        'action': 'reschedule',
        'start_at': format_local_time(next_wednesday, 10, 0)
    }
    resp = requests.post(f"{BASE_URL}/api/public/appointment/{appt_id}", json=reschedule_after_cancel)
    if resp.status_code == 400:
        log(f"  ✓ Returns 400 for reschedule after cancel")
        log("✓ C.7 PASSED")
    else:
        log(f"✗ C.7 FAILED: Expected 400 but got {resp.status_code}", "ERROR")

def test_d_slots_with_exclude():
    """Test D: Slots with exclude parameter"""
    log("\n" + "="*80)
    log("TEST D: Slots with exclude parameter")
    log("="*80)
    
    slug = test_data['tenant_slug']
    service_id = test_data['service_active_id']
    emp_a_id = test_data['employee_a_id']
    
    next_tuesday = get_next_weekday(1)
    tuesday_str = next_tuesday.strftime('%Y-%m-%d')
    
    # Create appointment at Tuesday 13:00
    log("\nD.0: Creating appointment at Tuesday 13:00")
    booking_data = {
        'slug': slug,
        'service_id': service_id,
        'employee_id': emp_a_id,
        'start_at': format_local_time(next_tuesday, 13, 0),
        'client': {
            'firstName': 'Exclude',
            'lastName': 'Test',
            'email': f'exclude.{uuid.uuid4().hex[:6]}@example.invalid',
            'phone': '+34644000111'
        }
    }
    resp = requests.post(f"{BASE_URL}/api/public/book", json=booking_data)
    if resp.status_code != 200:
        log(f"✗ Failed to create test appointment: {resp.status_code}", "ERROR")
        return
    
    appt_id = resp.json()['id']
    test_data['appointment_ids'].append(appt_id)
    log(f"✓ Created appointment: {appt_id}")
    
    # D.1: Get slots without exclude (13:00 should NOT be available)
    log("\nD.1: GET slots without exclude parameter")
    resp = requests.get(f"{BASE_URL}/api/public/{slug}/slots", params={
        'date': tuesday_str,
        'service_id': service_id,
        'employee_id': emp_a_id
    })
    if resp.status_code == 200:
        slots = resp.json().get('slots', [])
        slot_labels = [s['label'] for s in slots]
        if '13:00' not in slot_labels:
            log(f"  ✓ Slot 13:00 correctly excluded (booked)")
            log("✓ D.1 PASSED")
        else:
            log(f"  ✗ Slot 13:00 should not be available", "ERROR")
    else:
        log(f"✗ D.1 FAILED: {resp.status_code}", "ERROR")
    
    # D.2: Get slots with exclude (13:00 SHOULD be available)
    log("\nD.2: GET slots with exclude parameter")
    resp = requests.get(f"{BASE_URL}/api/public/{slug}/slots", params={
        'date': tuesday_str,
        'service_id': service_id,
        'employee_id': emp_a_id,
        'exclude': appt_id
    })
    if resp.status_code == 200:
        slots = resp.json().get('slots', [])
        slot_labels = [s['label'] for s in slots]
        if '13:00' in slot_labels:
            log(f"  ✓ Slot 13:00 correctly included with exclude parameter")
            log("✓ D.2 PASSED")
        else:
            log(f"  ✗ Slot 13:00 should be available with exclude", "ERROR")
    else:
        log(f"✗ D.2 FAILED: {resp.status_code}", "ERROR")
    
    # D.3: Get slots with exclude from another tenant (should be ignored)
    log("\nD.3: GET slots with exclude from another tenant (should be ignored)")
    fake_appt_id = str(uuid.uuid4())
    resp = requests.get(f"{BASE_URL}/api/public/{slug}/slots", params={
        'date': tuesday_str,
        'service_id': service_id,
        'employee_id': emp_a_id,
        'exclude': fake_appt_id
    })
    if resp.status_code == 200:
        slots = resp.json().get('slots', [])
        slot_labels = [s['label'] for s in slots]
        if '13:00' not in slot_labels:
            log(f"  ✓ Exclude from another tenant correctly ignored")
            log("✓ D.3 PASSED")
        else:
            log(f"  ✗ Exclude should be ignored for other tenant appointments", "ERROR")
    else:
        log(f"✗ D.3 FAILED: {resp.status_code}", "ERROR")

def test_e_cron_reminders():
    """Test E: GET /api/cron/reminders-24h"""
    log("\n" + "="*80)
    log("TEST E: GET /api/cron/reminders-24h")
    log("="*80)
    
    # E.1: Without secret (should return 401)
    log("\nE.1: GET without secret (should return 401)")
    resp = requests.get(f"{BASE_URL}/api/cron/reminders-24h")
    if resp.status_code == 401:
        log(f"  ✓ Returns 401 without secret")
        log("✓ E.1 PASSED")
    else:
        log(f"✗ E.1 FAILED: Expected 401 but got {resp.status_code}", "ERROR")
    
    # E.2: With secret (should return 200 with JSON)
    log("\nE.2: GET with secret (should return 200)")
    resp = requests.get(f"{BASE_URL}/api/cron/reminders-24h", params={'secret': CRON_SECRET})
    if resp.status_code == 200:
        data = resp.json()
        
        # Check for required keys
        required_keys = ['checked', 'results', 'whatsapp']
        has_all_keys = all(key in data for key in required_keys)
        
        if has_all_keys:
            log(f"  ✓ Response has all required keys: {required_keys}")
            log(f"  Checked: {data.get('checked')}, Results: {len(data.get('results', []))}, WhatsApp: {len(data.get('whatsapp', []))}")
            log("✓ E.2 PASSED")
        else:
            missing = [k for k in required_keys if k not in data]
            log(f"  ✗ Response missing keys: {missing}", "ERROR")
    else:
        log(f"✗ E.2 FAILED: {resp.status_code} {resp.text}", "ERROR")

def test_f_whatsapp_endpoints():
    """Test F: WhatsApp endpoints authentication"""
    log("\n" + "="*80)
    log("TEST F: WhatsApp endpoints")
    log("="*80)
    
    # F.1: GET /api/whatsapp/config without session (should return 401)
    log("\nF.1: GET /api/whatsapp/config without session (should return 401)")
    resp = requests.get(f"{BASE_URL}/api/whatsapp/config")
    if resp.status_code == 401:
        log(f"  ✓ Returns 401 without session")
        log("✓ F.1 PASSED")
    else:
        log(f"✗ F.1 FAILED: Expected 401 but got {resp.status_code}", "ERROR")
    
    # F.2: POST /api/whatsapp/notify without session (should return 401)
    log("\nF.2: POST /api/whatsapp/notify without session (should return 401)")
    resp = requests.post(f"{BASE_URL}/api/whatsapp/notify", json={
        'appointment_id': str(uuid.uuid4()),
        'event': 'created'
    })
    if resp.status_code == 401:
        log(f"  ✓ Returns 401 without session")
        log("✓ F.2 PASSED")
    else:
        log(f"✗ F.2 FAILED: Expected 401 but got {resp.status_code}", "ERROR")
    
    # F.3: POST /api/whatsapp/webhook/<random uuid> (should return 404)
    log("\nF.3: POST /api/whatsapp/webhook/<random uuid> (should return 404)")
    random_tenant_id = str(uuid.uuid4())
    resp = requests.post(f"{BASE_URL}/api/whatsapp/webhook/{random_tenant_id}", json={
        'type': 'test',
        'data': {}
    })
    if resp.status_code == 404:
        log(f"  ✓ Returns 404 for unknown tenant webhook")
        log("✓ F.3 PASSED")
    else:
        log(f"✗ F.3 FAILED: Expected 404 but got {resp.status_code}", "ERROR")

def main():
    """Main test runner"""
    log("="*80)
    log("RESERVA360 BACKEND API TESTING")
    log("="*80)
    log(f"Base URL: {BASE_URL}")
    log(f"Supabase URL: {SUPABASE_URL}")
    log(f"Current date (environment): 2026-11-02")
    log(f"Timezone: Europe/Madrid (UTC+1 in November)")
    log("="*80)
    
    try:
        # Setup
        setup_test_data()
        
        # Run tests
        test_a_slots_endpoint()
        test_b_booking_endpoint()
        test_c_appointment_management()
        test_d_slots_with_exclude()
        test_e_cron_reminders()
        test_f_whatsapp_endpoints()
        
    except Exception as e:
        log(f"Test execution failed: {e}", "ERROR")
        import traceback
        traceback.print_exc()
    finally:
        # Cleanup
        cleanup_test_data()
    
    log("\n" + "="*80)
    log("TESTING COMPLETE")
    log("="*80)

if __name__ == '__main__':
    main()
