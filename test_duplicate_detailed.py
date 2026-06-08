#!/usr/bin/env python3
"""
Test duplicate booking with better error handling and no immediate cleanup
"""

import requests
import json
from datetime import datetime, timedelta
import random
import time

SUPABASE_URL = "https://nlqcmysbivskkyxjjvld.supabase.co"
SERVICE_ROLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5scWNteXNiaXZza2t5eGpqdmxkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDkzOTMyMCwiZXhwIjoyMDk2NTE1MzIwfQ.TUExhh2OGt8SdqggzXEZPwtxm9X2imvtA8DZFhmIZO0"
ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5scWNteXNiaXZza2t5eGpqdmxkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA5MzkzMjAsImV4cCI6MjA5NjUxNTMyMH0.RVKqaTM-iJp3QkFkM3SSvGU9i9B0j_YXXK31AEdZ-lI"

test_slug = f"test-dup-{random.randint(1000, 9999)}"
test_tenant_id = None
test_service_id = None
test_employee_id = None

print("=" * 80)
print("DUPLICATE BOOKING TEST")
print("=" * 80)

# 1. Create tenant
print("\n1. Creating test tenant...")
business_hours = {
    "monday": {"enabled": True, "start": "09:00", "end": "19:00"},
    "tuesday": {"enabled": True, "start": "09:00", "end": "19:00"},
    "wednesday": {"enabled": True, "start": "09:00", "end": "19:00"},
    "thursday": {"enabled": True, "start": "09:00", "end": "19:00"},
    "friday": {"enabled": True, "start": "09:00", "end": "19:00"},
    "saturday": {"enabled": False},
    "sunday": {"enabled": False}
}

tenant_data = {
    "slug": test_slug,
    "name": f"Test Dup {test_slug}",
    "industry": "Test",
    "status": "active",
    "plan_id": "plan_starter",
    "business_hours": json.dumps(business_hours),
    "vacations": json.dumps([])
}

headers_service = {
    "apikey": SERVICE_ROLE_KEY,
    "Authorization": f"Bearer {SERVICE_ROLE_KEY}",
    "Content-Type": "application/json",
    "Prefer": "return=representation"
}

response = requests.post(f"{SUPABASE_URL}/rest/v1/tenants", headers=headers_service, json=tenant_data, timeout=10)
if response.status_code in [200, 201]:
    tenant = response.json()
    if isinstance(tenant, list):
        tenant = tenant[0]
    test_tenant_id = tenant["id"]
    print(f"   ✅ Tenant created: {test_tenant_id}")
else:
    print(f"   ❌ Failed: {response.text}")
    exit(1)

# 2. Create employee
print("\n2. Creating employee...")
schedule = {
    "monday": {"enabled": True, "start": "09:00", "end": "18:00"},
    "tuesday": {"enabled": True, "start": "09:00", "end": "18:00"},
    "wednesday": {"enabled": True, "start": "09:00", "end": "18:00"},
    "thursday": {"enabled": True, "start": "09:00", "end": "18:00"},
    "friday": {"enabled": True, "start": "09:00", "end": "18:00"},
    "saturday": {"enabled": False},
    "sunday": {"enabled": False}
}

emp_data = {
    "tenant_id": test_tenant_id,
    "first_name": "Test",
    "last_name": "Employee",
    "schedule": json.dumps(schedule),
    "active": True
}

response = requests.post(f"{SUPABASE_URL}/rest/v1/employees", headers=headers_service, json=emp_data, timeout=10)
if response.status_code in [200, 201]:
    employee = response.json()
    if isinstance(employee, list):
        employee = employee[0]
    test_employee_id = employee["id"]
    print(f"   ✅ Employee created: {test_employee_id}")
else:
    print(f"   ❌ Failed: {response.text}")
    exit(1)

# 3. Create service
print("\n3. Creating service...")
svc_data = {
    "tenant_id": test_tenant_id,
    "name": "Test Service",
    "duration_minutes": 60,
    "price": 30.00,
    "active": True
}

response = requests.post(f"{SUPABASE_URL}/rest/v1/services", headers=headers_service, json=svc_data, timeout=10)
if response.status_code in [200, 201]:
    service = response.json()
    if isinstance(service, list):
        service = service[0]
    test_service_id = service["id"]
    print(f"   ✅ Service created: {test_service_id}")
else:
    print(f"   ❌ Failed: {response.text}")
    exit(1)

# 4. Create first booking
print("\n4. Creating first booking...")
tomorrow_10am = datetime.utcnow().replace(hour=10, minute=0, second=0, microsecond=0) + timedelta(days=1)
start_time = tomorrow_10am.isoformat().replace("+00:00", "Z")

headers_anon = {
    "apikey": ANON_KEY,
    "Authorization": f"Bearer {ANON_KEY}",
    "Content-Type": "application/json"
}

booking_1 = {
    "p_tenant_slug": test_slug,
    "p_service_id": test_service_id,
    "p_employee_id": test_employee_id,
    "p_start": start_time,
    "p_client_first_name": "First",
    "p_client_last_name": "Client",
    "p_client_email": f"first{random.randint(1000, 9999)}@example.com",
    "p_client_phone": "+34600111222",
    "p_client_notes": "First"
}

try:
    response = requests.post(
        f"{SUPABASE_URL}/rest/v1/rpc/create_public_booking",
        headers=headers_anon,
        json=booking_1,
        timeout=15
    )
    print(f"   Status: {response.status_code}")
    if response.status_code == 200:
        appt_id = response.json()
        print(f"   ✅ First booking created: {appt_id}")
    else:
        print(f"   ❌ Failed: {response.text}")
        exit(1)
except Exception as e:
    print(f"   ❌ Exception: {str(e)}")
    exit(1)

# 5. Wait a moment
print("\n5. Waiting 2 seconds...")
time.sleep(2)

# 6. Try duplicate booking
print("\n6. Attempting duplicate booking (same time, same employee)...")
booking_2 = {
    "p_tenant_slug": test_slug,
    "p_service_id": test_service_id,
    "p_employee_id": test_employee_id,
    "p_start": start_time,  # SAME TIME
    "p_client_first_name": "Second",
    "p_client_last_name": "Client",
    "p_client_email": f"second{random.randint(1000, 9999)}@example.com",
    "p_client_phone": "+34600999888",
    "p_client_notes": "Should fail"
}

try:
    print("   Sending request...")
    response = requests.post(
        f"{SUPABASE_URL}/rest/v1/rpc/create_public_booking",
        headers=headers_anon,
        json=booking_2,
        timeout=15
    )
    print(f"   Status: {response.status_code}")
    print(f"   Response: {response.text[:500]}")
    
    if response.status_code in [400, 409, 500]:
        if "Horario no disponible" in response.text:
            print("   ✅ SUCCESS: Duplicate correctly rejected with 'Horario no disponible'")
        else:
            print(f"   ✅ SUCCESS: Duplicate rejected (different error)")
    elif response.status_code == 200:
        print("   ❌ FAIL: Duplicate booking was allowed!")
    else:
        print(f"   ⚠️  Unexpected status: {response.status_code}")
        
except requests.exceptions.Timeout:
    print("   ❌ TIMEOUT: Request took more than 15 seconds")
    print("   This suggests the RPC function might be hanging or there's a database lock")
except Exception as e:
    print(f"   ❌ Exception: {str(e)}")

# 7. Cleanup
print("\n7. Cleaning up...")
response = requests.delete(
    f"{SUPABASE_URL}/rest/v1/tenants?id=eq.{test_tenant_id}",
    headers=headers_service,
    timeout=10
)
if response.status_code in [200, 204]:
    print(f"   ✅ Cleanup complete")
else:
    print(f"   ⚠️  Cleanup warning: {response.status_code}")

print("\n" + "=" * 80)
print("TEST COMPLETE")
print("=" * 80)
