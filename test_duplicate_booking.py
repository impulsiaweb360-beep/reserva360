#!/usr/bin/env python3
"""
Focused test for duplicate booking prevention
"""

import requests
import json
from datetime import datetime, timedelta
import random

SUPABASE_URL = "https://nlqcmysbivskkyxjjvld.supabase.co"
ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5scWNteXNiaXZza2t5eGpqdmxkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA5MzkzMjAsImV4cCI6MjA5NjUxNTMyMH0.RVKqaTM-iJp3QkFkM3SSvGU9i9B0j_YXXK31AEdZ-lI"

# Use the test tenant from previous run
test_slug = "test-fisio-9436"
test_service_id = "aee83991-8f25-43c9-987a-ed0502de33d7"
test_employee_id = "4feeca14-30e9-4d96-801a-47936f24cb80"

print("Testing duplicate booking prevention...")
print(f"Slug: {test_slug}")
print(f"Service: {test_service_id}")
print(f"Employee: {test_employee_id}")

# Tomorrow at 11:00 UTC (different from the 10:00 used in main test)
tomorrow_11am = datetime.utcnow().replace(hour=11, minute=0, second=0, microsecond=0) + timedelta(days=1)
start_time = tomorrow_11am.isoformat().replace("+00:00", "Z")

print(f"\nStart time: {start_time}")

# First booking
booking_data_1 = {
    "p_tenant_slug": test_slug,
    "p_service_id": test_service_id,
    "p_employee_id": test_employee_id,
    "p_start": start_time,
    "p_client_first_name": "First",
    "p_client_last_name": "Client",
    "p_client_email": f"first{random.randint(1000, 9999)}@example.com",
    "p_client_phone": "+34600111222",
    "p_client_notes": "First booking"
}

headers = {
    "apikey": ANON_KEY,
    "Authorization": f"Bearer {ANON_KEY}",
    "Content-Type": "application/json",
    "Prefer": "return=representation"
}

print("\n1. Creating first booking...")
try:
    response1 = requests.post(
        f"{SUPABASE_URL}/rest/v1/rpc/create_public_booking",
        headers=headers,
        json=booking_data_1,
        timeout=10
    )
    print(f"   Status: {response1.status_code}")
    print(f"   Response: {response1.text[:200]}")
    
    if response1.status_code == 200:
        print("   ✅ First booking created")
    else:
        print(f"   ❌ First booking failed: {response1.text}")
        exit(1)
except Exception as e:
    print(f"   ❌ Exception: {str(e)}")
    exit(1)

# Second booking (duplicate)
booking_data_2 = {
    "p_tenant_slug": test_slug,
    "p_service_id": test_service_id,
    "p_employee_id": test_employee_id,
    "p_start": start_time,  # Same time!
    "p_client_first_name": "Second",
    "p_client_last_name": "Client",
    "p_client_email": f"second{random.randint(1000, 9999)}@example.com",
    "p_client_phone": "+34600999888",
    "p_client_notes": "Should fail"
}

print("\n2. Attempting duplicate booking (should fail)...")
try:
    response2 = requests.post(
        f"{SUPABASE_URL}/rest/v1/rpc/create_public_booking",
        headers=headers,
        json=booking_data_2,
        timeout=10
    )
    print(f"   Status: {response2.status_code}")
    print(f"   Response: {response2.text[:500]}")
    
    if response2.status_code in [400, 409, 500]:
        if "Horario no disponible" in response2.text:
            print("   ✅ Duplicate correctly rejected with 'Horario no disponible'")
        else:
            print(f"   ✅ Duplicate rejected (but different error message)")
    elif response2.status_code == 200:
        print("   ❌ FAIL: Duplicate booking was allowed!")
    else:
        print(f"   ⚠️  Unexpected status: {response2.status_code}")
        
except requests.exceptions.Timeout:
    print("   ❌ Request timed out after 10 seconds")
except Exception as e:
    print(f"   ❌ Exception: {str(e)}")

print("\nTest complete.")
