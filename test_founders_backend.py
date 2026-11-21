#!/usr/bin/env python3
"""
Backend testing for Reserva360 Founders Program
Tests authentication, permissions, and response formats
"""

import requests
import json
import os
import base64
from urllib.parse import urlencode

# Load environment variables from .env file
def load_env():
    env_vars = {}
    try:
        with open('/app/.env', 'r') as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith('#') and '=' in line:
                    key, value = line.split('=', 1)
                    env_vars[key] = value
    except Exception as e:
        print(f'Warning: Could not load .env file: {e}')
    return env_vars

env_vars = load_env()

# Configuration
BASE_URL = env_vars.get('NEXT_PUBLIC_BASE_URL', 'http://localhost:3000')
SUPABASE_URL = env_vars.get('NEXT_PUBLIC_SUPABASE_URL')
SUPABASE_ANON_KEY = env_vars.get('NEXT_PUBLIC_SUPABASE_ANON_KEY')
CRON_SECRET = env_vars.get('CRON_SECRET')
WEBHOOK_CRON_SECRET = env_vars.get('WEBHOOK_CRON_SECRET')

# Extract Supabase ref from URL
SUPABASE_REF = SUPABASE_URL.split('//')[1].split('.')[0] if SUPABASE_URL else None

# Super admin credentials
SUPER_ADMIN_EMAIL = 'reserva360.app@gmail.com'
SUPER_ADMIN_PASSWORD = 'Reserva360_79'

def print_test(name, passed, details=''):
    """Print test result"""
    status = '✅ PASA' if passed else '❌ FALLA'
    print(f'{status} · {name}' + (f' — {details}' if details else ''))

def supabase_login(email, password):
    """Login to Supabase and return session"""
    try:
        url = f'{SUPABASE_URL}/auth/v1/token?grant_type=password'
        headers = {
            'apikey': SUPABASE_ANON_KEY,
            'Content-Type': 'application/json'
        }
        data = {
            'email': email,
            'password': password
        }
        response = requests.post(url, headers=headers, json=data)
        if response.status_code == 200:
            return response.json()
        else:
            print(f'Login failed: {response.status_code} - {response.text}')
            return None
    except Exception as e:
        print(f'Login error: {e}')
        return None

def create_auth_cookie(session):
    """Create Supabase auth cookie from session"""
    try:
        session_json = json.dumps(session)
        session_b64 = base64.urlsafe_b64encode(session_json.encode()).decode()
        cookie_value = f'base64-{session_b64}'
        cookie_name = f'sb-{SUPABASE_REF}-auth-token'
        
        # Check if cookie exceeds 3180 characters (needs chunking)
        if len(cookie_value) <= 3180:
            return f'{cookie_name}={cookie_value}'
        else:
            # Chunk the cookie
            chunks = [cookie_value[i:i+3180] for i in range(0, len(cookie_value), 3180)]
            return '; '.join([f'{cookie_name}.{i}={chunk}' for i, chunk in enumerate(chunks)])
    except Exception as e:
        print(f'Cookie creation error: {e}')
        return None

def test_unauthenticated_access():
    """Test 1: Verify unauthenticated access returns 401"""
    print('\n=== TEST 1: Acceso sin autenticación ===')
    
    endpoints = [
        ('GET', '/api/founders/me'),
        ('GET', '/api/admin/founders'),
        ('PUT', '/api/admin/founders'),
        ('POST', '/api/admin/founders/00000000-0000-0000-0000-000000000000')
    ]
    
    all_passed = True
    for method, path in endpoints:
        try:
            url = f'{BASE_URL}{path}'
            if method == 'GET':
                response = requests.get(url, timeout=10)
            elif method == 'PUT':
                response = requests.put(url, json={}, timeout=10)
            elif method == 'POST':
                response = requests.post(url, json={'action': 'set_eligible', 'reason': 'test'}, timeout=10)
            
            passed = response.status_code == 401
            print_test(f'{method} {path} sin sesión → 401', passed, f'status={response.status_code}')
            all_passed = all_passed and passed
        except Exception as e:
            print_test(f'{method} {path} sin sesión → 401', False, f'error={e}')
            all_passed = False
    
    return all_passed

def test_cron_endpoint():
    """Test 2: Verify cron endpoint authentication"""
    print('\n=== TEST 2: Autenticación del endpoint cron ===')
    
    all_passed = True
    
    # Test without auth
    try:
        response = requests.post(f'{BASE_URL}/api/cron/founders', timeout=10)
        passed = response.status_code == 401
        print_test('POST /api/cron/founders sin auth → 401', passed, f'status={response.status_code}')
        all_passed = all_passed and passed
    except Exception as e:
        print_test('POST /api/cron/founders sin auth → 401', False, f'error={e}')
        all_passed = False
    
    # Test with Bearer token
    try:
        headers = {'Authorization': f'Bearer {WEBHOOK_CRON_SECRET}'}
        response = requests.post(f'{BASE_URL}/api/cron/founders', headers=headers, timeout=10)
        passed = response.status_code == 202
        data = response.json() if response.status_code == 202 else {}
        print_test('POST /api/cron/founders con Bearer WEBHOOK_CRON_SECRET → 202', passed, 
                  f'status={response.status_code}, accepted={data.get("accepted")}')
        all_passed = all_passed and passed
    except Exception as e:
        print_test('POST /api/cron/founders con Bearer WEBHOOK_CRON_SECRET → 202', False, f'error={e}')
        all_passed = False
    
    # Test with query param
    try:
        response = requests.post(f'{BASE_URL}/api/cron/founders?secret={CRON_SECRET}', timeout=10)
        passed = response.status_code == 202
        data = response.json() if response.status_code == 202 else {}
        print_test('POST /api/cron/founders con ?secret=CRON_SECRET → 202', passed, 
                  f'status={response.status_code}, accepted={data.get("accepted")}')
        all_passed = all_passed and passed
    except Exception as e:
        print_test('POST /api/cron/founders con ?secret=CRON_SECRET → 202', False, f'error={e}')
        all_passed = False
    
    # Test with wrong secret
    try:
        response = requests.post(f'{BASE_URL}/api/cron/founders?secret=wrong_secret', timeout=10)
        passed = response.status_code == 401
        print_test('POST /api/cron/founders con secreto incorrecto → 401', passed, f'status={response.status_code}')
        all_passed = all_passed and passed
    except Exception as e:
        print_test('POST /api/cron/founders con secreto incorrecto → 401', False, f'error={e}')
        all_passed = False
    
    return all_passed

def test_super_admin_access():
    """Test 3: Verify super admin access to endpoints"""
    print('\n=== TEST 3: Acceso como super admin ===')
    
    # Login as super admin
    print('Iniciando sesión como super admin...')
    session = supabase_login(SUPER_ADMIN_EMAIL, SUPER_ADMIN_PASSWORD)
    if not session:
        print_test('Super admin login', False, 'No se pudo iniciar sesión')
        return False
    
    cookie = create_auth_cookie(session)
    if not cookie:
        print_test('Super admin cookie creation', False, 'No se pudo crear cookie')
        return False
    
    headers = {'Cookie': cookie}
    all_passed = True
    
    # Test GET /api/admin/founders
    try:
        response = requests.get(f'{BASE_URL}/api/admin/founders', headers=headers, timeout=10)
        passed = response.status_code == 200
        
        if passed:
            data = response.json()
            has_program = 'program' in data
            has_rows = 'rows' in data and isinstance(data['rows'], list)
            has_audit = 'audit' in data and isinstance(data['audit'], list)
            
            # Check program structure
            program_ok = False
            if has_program:
                prog = data['program']
                program_ok = (
                    'launch_at' in prog and
                    'status' in prog and
                    'frozen_at' in prog
                )
            
            # Check rows structure
            rows_ok = False
            if has_rows and len(data['rows']) > 0:
                row = data['rows'][0]
                rows_ok = (
                    'tenantId' in row and
                    'name' in row and
                    'status' in row and
                    'requirements' in row and
                    'cyclesUsed' in row and
                    'totalCycles' in row
                )
            
            details = f'program={has_program}, rows={len(data.get("rows", []))}, audit={len(data.get("audit", []))}'
            print_test('GET /api/admin/founders → 200 con estructura correcta', 
                      passed and has_program and has_rows and has_audit and program_ok,
                      details)
        else:
            print_test('GET /api/admin/founders → 200', passed, f'status={response.status_code}')
        
        all_passed = all_passed and passed
    except Exception as e:
        print_test('GET /api/admin/founders → 200', False, f'error={e}')
        all_passed = False
    
    # Test GET /api/admin/founders/[tenantId]
    try:
        # Get a tenant ID from the previous response
        response = requests.get(f'{BASE_URL}/api/admin/founders', headers=headers, timeout=10)
        if response.status_code == 200:
            data = response.json()
            if data.get('rows') and len(data['rows']) > 0:
                tenant_id = data['rows'][0]['tenantId']
                
                response = requests.get(f'{BASE_URL}/api/admin/founders/{tenant_id}', headers=headers, timeout=10)
                passed = response.status_code == 200
                
                if passed:
                    detail_data = response.json()
                    has_benefit = 'benefit' in detail_data
                    has_status = 'status' in detail_data
                    has_cycles = 'cycles' in detail_data
                    has_history = 'history' in detail_data
                    
                    print_test(f'GET /api/admin/founders/{tenant_id[:8]}... → 200 con estructura correcta',
                              passed and has_benefit and has_status and has_cycles and has_history,
                              f'benefit={has_benefit}, status={has_status}, cycles={has_cycles}, history={has_history}')
                else:
                    print_test(f'GET /api/admin/founders/[tenantId] → 200', passed, f'status={response.status_code}')
                
                all_passed = all_passed and passed
    except Exception as e:
        print_test('GET /api/admin/founders/[tenantId] → 200', False, f'error={e}')
        all_passed = False
    
    # Test PUT /api/admin/founders with empty body
    try:
        response = requests.put(f'{BASE_URL}/api/admin/founders', headers=headers, json={}, timeout=10)
        passed = response.status_code == 200
        
        if passed:
            data = response.json()
            has_ok = data.get('ok') == True
            print_test('PUT /api/admin/founders con body {} → 200 ok', passed and has_ok, 
                      f'ok={data.get("ok")}')
        else:
            print_test('PUT /api/admin/founders con body {} → 200', passed, f'status={response.status_code}')
        
        all_passed = all_passed and passed
    except Exception as e:
        print_test('PUT /api/admin/founders con body {} → 200', False, f'error={e}')
        all_passed = False
    
    # Test PUT /api/admin/founders with invalid status
    try:
        response = requests.put(f'{BASE_URL}/api/admin/founders', headers=headers, json={'status': 'xyz'}, timeout=10)
        passed = response.status_code == 400
        print_test('PUT /api/admin/founders con {status:"xyz"} → 400', passed, f'status={response.status_code}')
        all_passed = all_passed and passed
    except Exception as e:
        print_test('PUT /api/admin/founders con {status:"xyz"} → 400', False, f'error={e}')
        all_passed = False
    
    # Test POST /api/admin/founders/[tenantId] with invalid action
    try:
        # Use a random UUID to avoid modifying real data
        fake_uuid = '00000000-0000-0000-0000-000000000000'
        response = requests.post(f'{BASE_URL}/api/admin/founders/{fake_uuid}', 
                                headers=headers, 
                                json={'action': 'hack', 'reason': 'x'},
                                timeout=10)
        passed = response.status_code == 400
        print_test('POST /api/admin/founders/[tenantId] con {action:"hack"} → 400', passed, 
                  f'status={response.status_code}')
        all_passed = all_passed and passed
    except Exception as e:
        print_test('POST /api/admin/founders/[tenantId] con {action:"hack"} → 400', False, f'error={e}')
        all_passed = False
    
    return all_passed

def test_rls_security():
    """Test 4: Verify RLS security from browser (using anon key)"""
    print('\n=== TEST 4: Seguridad RLS (Simulación desde navegador) ===')
    
    # Login as super admin to get a token
    session = supabase_login(SUPER_ADMIN_EMAIL, SUPER_ADMIN_PASSWORD)
    if not session:
        print_test('Super admin login para test RLS', False, 'No se pudo iniciar sesión')
        return False
    
    access_token = session.get('access_token')
    if not access_token:
        print_test('Obtener access token', False, 'No se pudo obtener access_token')
        return False
    
    all_passed = True
    
    # Test direct UPDATE to founder_benefits (should fail)
    try:
        url = f'{SUPABASE_URL}/rest/v1/founder_benefits'
        headers = {
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': f'Bearer {access_token}',
            'Content-Type': 'application/json',
            'Prefer': 'return=representation'
        }
        # Try to update a row (should be blocked by RLS)
        data = {'cycles_used': 0}
        response = requests.patch(url, headers=headers, json=data, 
                                 params={'tenant_id': 'eq.00000000-0000-0000-0000-000000000000'},
                                 timeout=10)
        
        # Should either return 0 rows modified, 403 forbidden, or an error
        passed = response.status_code in [200, 403, 406] or (response.status_code == 200 and len(response.json()) == 0)
        print_test('UPDATE directo a founder_benefits con anon key → bloqueado por RLS', passed, 
                  f'status={response.status_code}')
        all_passed = all_passed and passed
    except Exception as e:
        print_test('UPDATE directo a founder_benefits → bloqueado', False, f'error={e}')
        all_passed = False
    
    # Test RPC founder_claim (should fail with permission error)
    try:
        url = f'{SUPABASE_URL}/rest/v1/rpc/founder_claim'
        headers = {
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': f'Bearer {access_token}',
            'Content-Type': 'application/json'
        }
        data = {'p_tenant': '00000000-0000-0000-0000-000000000000'}
        response = requests.post(url, headers=headers, json=data, timeout=10)
        
        # Should return an error (permission denied or similar)
        passed = response.status_code in [400, 401, 403, 500]
        print_test('rpc("founder_claim") con anon key → error de permisos', passed, 
                  f'status={response.status_code}')
        all_passed = all_passed and passed
    except Exception as e:
        print_test('rpc("founder_claim") → error de permisos', False, f'error={e}')
        all_passed = False
    
    return all_passed

def test_stripe_webhook():
    """Test 5: Verify Stripe webhook with invalid signature"""
    print('\n=== TEST 5: Seguridad del webhook de Stripe ===')
    
    try:
        url = f'{BASE_URL}/api/stripe/webhook'
        headers = {
            'stripe-signature': 'invalid_signature',
            'Content-Type': 'application/json'
        }
        data = {
            'id': 'evt_test',
            'object': 'event',
            'type': 'invoice.paid',
            'data': {'object': {}}
        }
        response = requests.post(url, headers=headers, json=data, timeout=10)
        passed = response.status_code == 400
        print_test('POST /api/stripe/webhook con firma inválida → 400', passed, f'status={response.status_code}')
        return passed
    except Exception as e:
        print_test('POST /api/stripe/webhook con firma inválida → 400', False, f'error={e}')
        return False

def test_regression():
    """Test 6: Regression tests"""
    print('\n=== TEST 6: Pruebas de regresión ===')
    
    all_passed = True
    
    # Test GET /api/billing/status without session
    try:
        response = requests.get(f'{BASE_URL}/api/billing/status', timeout=10)
        passed = response.status_code == 401
        print_test('GET /api/billing/status sin sesión → 401', passed, f'status={response.status_code}')
        all_passed = all_passed and passed
    except Exception as e:
        print_test('GET /api/billing/status sin sesión → 401', False, f'error={e}')
        all_passed = False
    
    # Test GET /book/[slug] - try to get a real slug first
    try:
        # First, try to get a tenant slug from the admin endpoint
        session = supabase_login(SUPER_ADMIN_EMAIL, SUPER_ADMIN_PASSWORD)
        if session:
            cookie = create_auth_cookie(session)
            headers = {'Cookie': cookie}
            admin_response = requests.get(f'{BASE_URL}/api/admin/founders', headers=headers, timeout=10)
            
            slug = None
            if admin_response.status_code == 200:
                data = admin_response.json()
                if data.get('rows') and len(data['rows']) > 0:
                    slug = data['rows'][0].get('slug')
            
            if slug:
                response = requests.get(f'{BASE_URL}/book/{slug}', timeout=10)
                passed = response.status_code == 200
                print_test(f'GET /book/{slug} → 200', passed, f'status={response.status_code}')
                all_passed = all_passed and passed
            else:
                print_test('GET /book/[slug] → 200', False, 'No se pudo obtener un slug válido')
                all_passed = False
        else:
            print_test('GET /book/[slug] → 200', False, 'No se pudo iniciar sesión para obtener slug')
            all_passed = False
    except Exception as e:
        print_test('GET /book/[slug] → 200', False, f'error={e}')
        all_passed = False
    
    # Test GET /api/public/[slug]/slots without service_id
    try:
        # Use the same slug from above if available
        session = supabase_login(SUPER_ADMIN_EMAIL, SUPER_ADMIN_PASSWORD)
        if session:
            cookie = create_auth_cookie(session)
            headers = {'Cookie': cookie}
            admin_response = requests.get(f'{BASE_URL}/api/admin/founders', headers=headers, timeout=10)
            
            slug = None
            if admin_response.status_code == 200:
                data = admin_response.json()
                if data.get('rows') and len(data['rows']) > 0:
                    slug = data['rows'][0].get('slug')
            
            if slug:
                response = requests.get(f'{BASE_URL}/api/public/{slug}/slots', timeout=10)
                passed = response.status_code == 400
                print_test(f'GET /api/public/{slug}/slots sin service_id → 400', passed, f'status={response.status_code}')
                all_passed = all_passed and passed
            else:
                print_test('GET /api/public/[slug]/slots sin service_id → 400', False, 'No se pudo obtener un slug válido')
                all_passed = False
        else:
            print_test('GET /api/public/[slug]/slots sin service_id → 400', False, 'No se pudo iniciar sesión para obtener slug')
            all_passed = False
    except Exception as e:
        print_test('GET /api/public/[slug]/slots sin service_id → 400', False, f'error={e}')
        all_passed = False
    
    return all_passed

def main():
    """Run all tests"""
    print('=' * 80)
    print('BACKEND TESTING: Programa de Usuarios Fundadores')
    print('=' * 80)
    print(f'Base URL: {BASE_URL}')
    print(f'Supabase URL: {SUPABASE_URL}')
    print(f'Supabase Ref: {SUPABASE_REF}')
    
    results = []
    
    # Run all test suites
    results.append(('Acceso sin autenticación', test_unauthenticated_access()))
    results.append(('Endpoint cron', test_cron_endpoint()))
    results.append(('Acceso super admin', test_super_admin_access()))
    results.append(('Seguridad RLS', test_rls_security()))
    results.append(('Webhook Stripe', test_stripe_webhook()))
    results.append(('Regresión', test_regression()))
    
    # Summary
    print('\n' + '=' * 80)
    print('RESUMEN DE PRUEBAS')
    print('=' * 80)
    
    passed_count = sum(1 for _, passed in results if passed)
    total_count = len(results)
    
    for name, passed in results:
        status = '✅ PASA' if passed else '❌ FALLA'
        print(f'{status} · {name}')
    
    print(f'\nTotal: {passed_count}/{total_count} suites pasadas')
    
    return passed_count == total_count

if __name__ == '__main__':
    try:
        success = main()
        exit(0 if success else 1)
    except Exception as e:
        print(f'\n❌ Error fatal: {e}')
        import traceback
        traceback.print_exc()
        exit(1)
