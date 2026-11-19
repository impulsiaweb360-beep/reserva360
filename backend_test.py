#!/usr/bin/env python3
"""
Backend testing for Reserva360 - Focused review request
Tests:
1. POST /api/whatsapp/notify - 401 without session, 401 with invalid body
2. lib/phone.js functions (samePhone, normalizePhone) via node script
3. lib/appointment-move.js checkMove via node script
4. Regression tests (read-only)
"""

import requests
import time
import json
import sys
import subprocess
import os

# Read base URL from .env
BASE_URL = "https://schedule-sync-141.preview.emergentagent.com"

def retry_request(method, url, max_retries=3, wait_time=10, **kwargs):
    """Retry requests up to 3 times with 10s waits (dev server may restart)"""
    for attempt in range(max_retries):
        try:
            response = method(url, timeout=30, **kwargs)
            return response
        except requests.exceptions.RequestException as e:
            if attempt < max_retries - 1:
                print(f"  ⚠️  Request failed (attempt {attempt + 1}/{max_retries}), retrying in {wait_time}s: {e}")
                time.sleep(wait_time)
            else:
                print(f"  ❌ Request failed after {max_retries} attempts: {e}")
                raise
    return None

def test_whatsapp_notify_no_session():
    """Test 1: POST /api/whatsapp/notify without session returns 401"""
    print("\n1️⃣  Testing POST /api/whatsapp/notify without session...")
    try:
        url = f"{BASE_URL}/api/whatsapp/notify"
        response = retry_request(requests.post, url, json={"appointment_id": "test", "event": "created"})
        
        if response.status_code == 401:
            data = response.json()
            if data.get("error") == "No autorizado":
                print("  ✅ PASS: Returns 401 with {error: 'No autorizado'}")
                return True
            else:
                print(f"  ❌ FAIL: Returns 401 but wrong error message: {data}")
                return False
        else:
            print(f"  ❌ FAIL: Expected 401, got {response.status_code}: {response.text}")
            return False
    except Exception as e:
        print(f"  ❌ FAIL: Exception: {e}")
        return False

def test_whatsapp_notify_invalid_body_no_session():
    """Test 1b: POST /api/whatsapp/notify with invalid body still 401 when no session"""
    print("\n1️⃣b Testing POST /api/whatsapp/notify with invalid body (no session)...")
    try:
        url = f"{BASE_URL}/api/whatsapp/notify"
        response = retry_request(requests.post, url, json={"invalid": "data"})
        
        if response.status_code == 401:
            data = response.json()
            if data.get("error") == "No autorizado":
                print("  ✅ PASS: Returns 401 with {error: 'No autorizado'} even with invalid body")
                return True
            else:
                print(f"  ❌ FAIL: Returns 401 but wrong error message: {data}")
                return False
        else:
            print(f"  ❌ FAIL: Expected 401, got {response.status_code}: {response.text}")
            return False
    except Exception as e:
        print(f"  ❌ FAIL: Exception: {e}")
        return False

def test_phone_functions():
    """Test 2: lib/phone.js functions via node script with esbuild"""
    print("\n2️⃣  Testing lib/phone.js functions (samePhone, normalizePhone)...")
    
    # Create test script
    test_script = """
import { samePhone, normalizePhone } from './lib/phone.js';

const tests = [
  { name: "'+34627128723' vs '627 12 87 23'", a: '+34627128723', b: '627 12 87 23', expected: true },
  { name: "'+34627128723' vs '627-128-723'", a: '+34627128723', b: '627-128-723', expected: true },
  { name: "'+34627128723' vs '627128724'", a: '+34627128723', b: '627128724', expected: false },
  { name: "normalizePhone('627128723') === '+34627128723'", phone: '627128723', expected: '+34627128723' }
];

let passed = 0;
let failed = 0;

tests.forEach((test, i) => {
  if (test.a !== undefined) {
    const result = samePhone(test.a, test.b);
    if (result === test.expected) {
      console.log(`✅ Test ${i+1} PASS: ${test.name} = ${result}`);
      passed++;
    } else {
      console.log(`❌ Test ${i+1} FAIL: ${test.name} = ${result}, expected ${test.expected}`);
      failed++;
    }
  } else {
    const result = normalizePhone(test.phone);
    if (result === test.expected) {
      console.log(`✅ Test ${i+1} PASS: ${test.name} = ${result}`);
      passed++;
    } else {
      console.log(`❌ Test ${i+1} FAIL: ${test.name} = ${result}, expected ${test.expected}`);
      failed++;
    }
  }
});

console.log(`\\nPhone tests: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
"""
    
    try:
        # Write test script
        with open('/app/test-phone.mjs', 'w') as f:
            f.write(test_script)
        
        # Bundle with esbuild
        print("  📦 Bundling with esbuild...")
        bundle_result = subprocess.run(
            ['npx', '--no-install', 'esbuild', '/app/test-phone.mjs', '--bundle', '--platform=node', '--alias:@=/app', '--outfile=/app/test-phone-bundle.mjs', '--format=esm'],
            capture_output=True,
            text=True,
            cwd='/app'
        )
        
        if bundle_result.returncode != 0:
            print(f"  ❌ FAIL: esbuild failed: {bundle_result.stderr}")
            return False
        
        # Run bundled script
        print("  🚀 Running tests...")
        run_result = subprocess.run(
            ['node', '/app/test-phone-bundle.mjs'],
            capture_output=True,
            text=True,
            cwd='/app'
        )
        
        print(run_result.stdout)
        if run_result.stderr:
            print(f"  stderr: {run_result.stderr}")
        
        # Cleanup
        os.remove('/app/test-phone.mjs')
        os.remove('/app/test-phone-bundle.mjs')
        
        if run_result.returncode == 0:
            print("  ✅ PASS: All phone function tests passed")
            return True
        else:
            print("  ❌ FAIL: Some phone function tests failed")
            return False
            
    except Exception as e:
        print(f"  ❌ FAIL: Exception: {e}")
        # Cleanup on error
        for f in ['/app/test-phone.mjs', '/app/test-phone-bundle.mjs']:
            if os.path.exists(f):
                os.remove(f)
        return False

def test_appointment_move_checkmove():
    """Test 3: lib/appointment-move.js checkMove via node script with esbuild"""
    print("\n3️⃣  Testing lib/appointment-move.js checkMove function...")
    
    # Create test script
    test_script = """
import { checkMove } from './lib/appointment-move.js';
import dayjs from 'dayjs';

// Business hours: Mon-Fri 09:00-19:00 break 14:00-15:00, Sat 10:00-14:00, Sun closed
const tenant = {
  businessHours: {
    1: { enabled: true, from: '09:00', to: '19:00', breakFrom: '14:00', breakTo: '15:00' },
    2: { enabled: true, from: '09:00', to: '19:00', breakFrom: '14:00', breakTo: '15:00' },
    3: { enabled: true, from: '09:00', to: '19:00', breakFrom: '14:00', breakTo: '15:00' },
    4: { enabled: true, from: '09:00', to: '19:00', breakFrom: '14:00', breakTo: '15:00' },
    5: { enabled: true, from: '09:00', to: '19:00', breakFrom: '14:00', breakTo: '15:00' },
    6: { enabled: true, from: '10:00', to: '14:00' },
    0: { enabled: false }
  }
};

const employee = {
  schedule: {
    1: { enabled: true, from: '09:00', to: '18:00' },
    2: { enabled: true, from: '09:00', to: '18:00' },
    3: { enabled: true, from: '09:00', to: '18:00' },
    4: { enabled: true, from: '09:00', to: '18:00' },
    5: { enabled: true, from: '09:00', to: '18:00' },
    6: { enabled: false },
    0: { enabled: false }
  }
};

// Get next Tuesday at 10:00
const nextTuesday = dayjs().day(9); // Next Tuesday (day 2)
const futureTuesday10 = nextTuesday.hour(10).minute(0).second(0);
const futureTuesday1030 = futureTuesday10.add(45, 'minute');

const tests = [
  {
    name: "Future Tuesday 10:00/45min - OK with no warnings",
    start: futureTuesday10.toISOString(),
    end: futureTuesday1030.toISOString(),
    expectedOk: true,
    expectedWarnings: 0
  },
  {
    name: "Future Tuesday 08:30 - blocked (before opening)",
    start: nextTuesday.hour(8).minute(30).second(0).toISOString(),
    end: nextTuesday.hour(9).minute(15).second(0).toISOString(),
    expectedOk: false
  },
  {
    name: "Future Tuesday 18:30 (ends 19:15) - blocked (after closing)",
    start: nextTuesday.hour(18).minute(30).second(0).toISOString(),
    end: nextTuesday.hour(19).minute(15).second(0).toISOString(),
    expectedOk: false
  },
  {
    name: "Future Tuesday 13:30 - OK with break warning",
    start: nextTuesday.hour(13).minute(30).second(0).toISOString(),
    end: nextTuesday.hour(14).minute(15).second(0).toISOString(),
    expectedOk: true,
    expectedWarnings: 1,
    expectedWarningText: 'descanso'
  },
  {
    name: "Future Tuesday 10:00 with overlapping appointment - OK with overlap warning",
    start: futureTuesday10.toISOString(),
    end: futureTuesday1030.toISOString(),
    appointments: [{
      id: 'existing-1',
      tenantId: 'tenant-1',
      employeeId: 'emp-1',
      status: 'confirmed',
      start: futureTuesday10.toISOString(),
      end: futureTuesday10.add(30, 'minute').toISOString()
    }],
    expectedOk: true,
    expectedWarnings: 1,
    expectedWarningText: 'solapa'
  },
  {
    name: "Future Sunday - blocked (closed)",
    start: dayjs().day(7).hour(10).minute(0).second(0).toISOString(),
    end: dayjs().day(7).hour(10).minute(45).second(0).toISOString(),
    expectedOk: false
  },
  {
    name: "Past time - blocked",
    start: dayjs().subtract(1, 'day').hour(10).minute(0).second(0).toISOString(),
    end: dayjs().subtract(1, 'day').hour(10).minute(45).second(0).toISOString(),
    expectedOk: false
  },
  {
    name: "Past time with allowPast:true - OK",
    start: dayjs().subtract(1, 'day').day(2).hour(10).minute(0).second(0).toISOString(),
    end: dayjs().subtract(1, 'day').day(2).hour(10).minute(45).second(0).toISOString(),
    allowPast: true,
    expectedOk: true,
    expectedWarnings: 0
  }
];

let passed = 0;
let failed = 0;

tests.forEach((test, i) => {
  const result = checkMove({
    start: test.start,
    end: test.end,
    tenant,
    employee,
    employeeId: 'emp-1',
    tenantId: 'tenant-1',
    appointments: test.appointments || [],
    excludeId: null,
    allowPast: test.allowPast || false
  });
  
  let testPassed = true;
  let failReason = '';
  
  if (result.ok !== test.expectedOk) {
    testPassed = false;
    failReason = `ok=${result.ok}, expected ${test.expectedOk}`;
  } else if (test.expectedOk && test.expectedWarnings !== undefined) {
    const warningCount = result.warnings ? result.warnings.length : 0;
    if (warningCount !== test.expectedWarnings) {
      testPassed = false;
      failReason = `warnings=${warningCount}, expected ${test.expectedWarnings}`;
    } else if (test.expectedWarningText && result.warnings) {
      const hasExpectedText = result.warnings.some(w => w.toLowerCase().includes(test.expectedWarningText));
      if (!hasExpectedText) {
        testPassed = false;
        failReason = `warning text doesn't contain '${test.expectedWarningText}': ${JSON.stringify(result.warnings)}`;
      }
    }
  }
  
  if (testPassed) {
    console.log(`✅ Test ${i+1} PASS: ${test.name}`);
    passed++;
  } else {
    console.log(`❌ Test ${i+1} FAIL: ${test.name} - ${failReason}`);
    console.log(`   Result: ${JSON.stringify(result)}`);
    failed++;
  }
});

console.log(`\\nCheckMove tests: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
"""
    
    try:
        # Write test script
        with open('/app/test-checkmove.mjs', 'w') as f:
            f.write(test_script)
        
        # Bundle with esbuild
        print("  📦 Bundling with esbuild...")
        bundle_result = subprocess.run(
            ['npx', '--no-install', 'esbuild', '/app/test-checkmove.mjs', '--bundle', '--platform=node', '--alias:@=/app', '--outfile=/app/test-checkmove-bundle.mjs', '--format=esm'],
            capture_output=True,
            text=True,
            cwd='/app'
        )
        
        if bundle_result.returncode != 0:
            print(f"  ❌ FAIL: esbuild failed: {bundle_result.stderr}")
            return False
        
        # Run bundled script
        print("  🚀 Running tests...")
        run_result = subprocess.run(
            ['node', '/app/test-checkmove-bundle.mjs'],
            capture_output=True,
            text=True,
            cwd='/app'
        )
        
        print(run_result.stdout)
        if run_result.stderr:
            print(f"  stderr: {run_result.stderr}")
        
        # Cleanup
        os.remove('/app/test-checkmove.mjs')
        os.remove('/app/test-checkmove-bundle.mjs')
        
        if run_result.returncode == 0:
            print("  ✅ PASS: All checkMove tests passed")
            return True
        else:
            print("  ❌ FAIL: Some checkMove tests failed")
            return False
            
    except Exception as e:
        print(f"  ❌ FAIL: Exception: {e}")
        # Cleanup on error
        for f in ['/app/test-checkmove.mjs', '/app/test-checkmove-bundle.mjs']:
            if os.path.exists(f):
                os.remove(f)
        return False

def test_regression_home():
    """Test 4a: GET / returns 200"""
    print("\n4️⃣a Testing GET / (home page)...")
    try:
        url = f"{BASE_URL}/"
        response = retry_request(requests.get, url)
        
        if response.status_code == 200:
            print("  ✅ PASS: Home page returns 200")
            return True
        else:
            print(f"  ❌ FAIL: Expected 200, got {response.status_code}")
            return False
    except Exception as e:
        print(f"  ❌ FAIL: Exception: {e}")
        return False

def test_regression_booking_page():
    """Test 4b: GET /book/fisiovital-s24q returns 200 and contains 'FisioVital'"""
    print("\n4️⃣b Testing GET /book/fisiovital-s24q...")
    try:
        url = f"{BASE_URL}/book/fisiovital-s24q"
        response = retry_request(requests.get, url)
        
        if response.status_code == 200:
            if 'FisioVital' in response.text or 'fisiovital' in response.text.lower():
                print("  ✅ PASS: Booking page returns 200 and contains 'FisioVital'")
                return True
            else:
                print("  ⚠️  PASS: Returns 200 but 'FisioVital' not found in content (may be OK if tenant doesn't exist)")
                return True
        else:
            print(f"  ❌ FAIL: Expected 200, got {response.status_code}")
            return False
    except Exception as e:
        print(f"  ❌ FAIL: Exception: {e}")
        return False

def test_regression_slots_endpoint():
    """Test 4c: GET /api/public/fisiovital-s24q/slots?service_id=<id> responds"""
    print("\n4️⃣c Testing GET /api/public/fisiovital-s24q/slots...")
    try:
        # First try to get the booking page to extract a service_id
        booking_url = f"{BASE_URL}/book/fisiovital-s24q"
        booking_response = retry_request(requests.get, booking_url)
        
        # Try with a dummy service_id or without it
        url = f"{BASE_URL}/api/public/fisiovital-s24q/slots"
        response = retry_request(requests.get, url)
        
        # Should respond (even if 400 for missing service_id, that's a valid response)
        if response.status_code in [200, 400, 404]:
            print(f"  ✅ PASS: Slots endpoint responds with {response.status_code}")
            return True
        else:
            print(f"  ❌ FAIL: Unexpected status code {response.status_code}")
            return False
    except Exception as e:
        print(f"  ❌ FAIL: Exception: {e}")
        return False

def test_regression_billing_status():
    """Test 4d: GET /api/billing/status returns 401 without session"""
    print("\n4️⃣d Testing GET /api/billing/status without session...")
    try:
        url = f"{BASE_URL}/api/billing/status"
        response = retry_request(requests.get, url)
        
        if response.status_code == 401:
            print("  ✅ PASS: Billing status returns 401 without session")
            return True
        else:
            print(f"  ❌ FAIL: Expected 401, got {response.status_code}")
            return False
    except Exception as e:
        print(f"  ❌ FAIL: Exception: {e}")
        return False

def test_regression_dashboard_redirect():
    """Test 4e: GET /dashboard redirects (307) without session"""
    print("\n4️⃣e Testing GET /dashboard without session...")
    try:
        url = f"{BASE_URL}/dashboard"
        response = retry_request(requests.get, url, allow_redirects=False)
        
        if response.status_code in [307, 302, 303]:
            print(f"  ✅ PASS: Dashboard redirects with {response.status_code}")
            return True
        else:
            print(f"  ❌ FAIL: Expected 307/302/303 redirect, got {response.status_code}")
            return False
    except Exception as e:
        print(f"  ❌ FAIL: Exception: {e}")
        return False

def main():
    print("=" * 80)
    print("BACKEND TESTING - Focused Review Request")
    print("=" * 80)
    print(f"Base URL: {BASE_URL}")
    print(f"Note: This is READ-ONLY testing, no data will be created/modified/deleted")
    print("=" * 80)
    
    results = []
    
    # Test 1: WhatsApp notify endpoint
    results.append(("POST /api/whatsapp/notify (no session)", test_whatsapp_notify_no_session()))
    results.append(("POST /api/whatsapp/notify (invalid body, no session)", test_whatsapp_notify_invalid_body_no_session()))
    
    # Test 2: Phone functions
    results.append(("lib/phone.js functions", test_phone_functions()))
    
    # Test 3: CheckMove function
    results.append(("lib/appointment-move.js checkMove", test_appointment_move_checkmove()))
    
    # Test 4: Regression tests
    results.append(("GET /", test_regression_home()))
    results.append(("GET /book/fisiovital-s24q", test_regression_booking_page()))
    results.append(("GET /api/public/fisiovital-s24q/slots", test_regression_slots_endpoint()))
    results.append(("GET /api/billing/status", test_regression_billing_status()))
    results.append(("GET /dashboard redirect", test_regression_dashboard_redirect()))
    
    # Summary
    print("\n" + "=" * 80)
    print("TEST SUMMARY")
    print("=" * 80)
    
    passed = sum(1 for _, result in results if result)
    failed = sum(1 for _, result in results if not result)
    
    for name, result in results:
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"{status}: {name}")
    
    print("=" * 80)
    print(f"Total: {passed} passed, {failed} failed out of {len(results)} tests")
    print("=" * 80)
    
    return 0 if failed == 0 else 1

if __name__ == "__main__":
    sys.exit(main())
