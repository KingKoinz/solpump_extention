# BOUND LICENSE SYSTEM - Wallet Address Permanently Tied to License
# One wallet = One license (unique binding)
# Re-verify token balance periodically

from flask import Flask, request, jsonify
from flask_cors import CORS
import anthropic
import os
import secrets
import sqlite3
import requests
import time
import hashlib

app = Flask(__name__)
CORS(app)

CLAUDE_API_KEY = os.environ.get('CLAUDE_API_KEY')
claude_client = anthropic.Anthropic(api_key=CLAUDE_API_KEY)

TOKEN_MINT = "C4br6g4CBAP2grzc2sUrU9wUN7eJGZZpePCN1yjapump"
MINIMUM_TOKENS = 1000  # Lowered for testing
REVERIFY_INTERVAL = 86400  # 24 hours

def init_db():
    conn = sqlite3.connect('licenses.db')
    c = conn.cursor()
    
    # License bound to wallet
    c.execute('''CREATE TABLE IF NOT EXISTS licenses
                 (license_key TEXT PRIMARY KEY, 
                  wallet_address TEXT UNIQUE,  -- ONE wallet = ONE license
                  wallet_hash TEXT,            -- For privacy/indexing
                  created_at INTEGER,
                  calls_remaining INTEGER,
                  last_verified INTEGER,
                  is_active INTEGER DEFAULT 1)''')
    
    # Usage tracking
    c.execute('''CREATE TABLE IF NOT EXISTS usage
                 (id INTEGER PRIMARY KEY AUTOINCREMENT,
                  license_key TEXT, 
                  wallet_address TEXT,
                  timestamp INTEGER, 
                  model TEXT, 
                  cost REAL)''')
    
    # Verification log
    c.execute('''CREATE TABLE IF NOT EXISTS verification_log
                 (id INTEGER PRIMARY KEY AUTOINCREMENT,
                  wallet_address TEXT,
                  timestamp INTEGER,
                  had_tokens INTEGER,
                  balance REAL)''')
    
    conn.commit()
    conn.close()

init_db()

def hash_wallet(wallet_address):
    """Create privacy-preserving hash of wallet address"""
    return hashlib.sha256(wallet_address.encode()).hexdigest()[:16]

def check_token_balance(wallet_address):
    """
    Check Solana blockchain - does this wallet hold required tokens?
    NO WALLET CONNECTION - just reading public blockchain data
    """
    rpc_url = "https://api.mainnet-beta.solana.com"
    
    try:
        payload = {
            "jsonrpc": "2.0",
            "id": 1,
            "method": "getTokenAccountsByOwner",
            "params": [
                wallet_address,
                {"mint": TOKEN_MINT},
                {"encoding": "jsonParsed"}
            ]
        }
        
        print(f"[DEBUG] Checking balance for wallet: {wallet_address[:8]}...")
        print(f"[DEBUG] Looking for token mint: {TOKEN_MINT}")
        
        response = requests.post(rpc_url, json=payload, timeout=10)
        data = response.json()
        
        print(f"[DEBUG] RPC Response: {data}")
        
        if 'result' in data and data['result']['value']:
            token_account = data['result']['value'][0]
            balance = int(token_account['account']['data']['parsed']['info']['tokenAmount']['amount'])
            decimals = token_account['account']['data']['parsed']['info']['tokenAmount']['decimals']
            actual_balance = balance / (10 ** decimals)
            
            # Log verification
            log_verification(wallet_address, True, actual_balance)
            
            print(f"[Verify] Wallet {wallet_address[:8]}... has {actual_balance:,.0f} tokens (need {MINIMUM_TOKENS:,})")
            return actual_balance >= MINIMUM_TOKENS
        else:
            log_verification(wallet_address, False, 0)
            print(f"[Verify] Wallet {wallet_address[:8]}... has NO token accounts for this mint")
            return False
            
    except Exception as e:
        print(f"[Verify] Error checking balance: {e}")
        return False

def log_verification(wallet_address, had_tokens, balance):
    """Log verification attempts for audit trail"""
    conn = sqlite3.connect('licenses.db')
    c = conn.cursor()
    c.execute('INSERT INTO verification_log VALUES (NULL, ?, ?, ?, ?)',
              (wallet_address, int(time.time()), 1 if had_tokens else 0, balance))
    conn.commit()
    conn.close()

@app.route('/api/get-license', methods=['POST'])
def get_license():
    """
    User provides ONLY wallet address (public, safe to share)
    Server verifies tokens and issues/returns license
    License is BOUND to wallet - one-to-one relationship
    """
    
    data = request.json
    wallet_address = data.get('wallet')
    
    if not wallet_address:
        return jsonify({'error': 'Wallet address required'}), 400
    
    # Basic validation
    if len(wallet_address) < 32 or len(wallet_address) > 44:
        return jsonify({'error': 'Invalid Solana wallet address format'}), 400
    
    print(f"[License] Request from {wallet_address[:8]}...")
    
    # Check if this wallet ALREADY has a license
    conn = sqlite3.connect('licenses.db')
    c = conn.cursor()
    c.execute('SELECT license_key, calls_remaining, is_active, last_verified FROM licenses WHERE wallet_address = ?',
              (wallet_address,))
    existing = c.fetchone()
    
    if existing:
        license_key, calls_remaining, is_active, last_verified = existing
        
        # Check if we should re-verify (every 24h)
        if time.time() - last_verified > REVERIFY_INTERVAL:
            print(f"[License] Re-verifying token balance for {wallet_address[:8]}...")
            
            has_tokens = check_token_balance(wallet_address)
            
            if not has_tokens:
                # Tokens sold/transferred - DEACTIVATE license
                c.execute('UPDATE licenses SET is_active = 0 WHERE wallet_address = ?',
                          (wallet_address,))
                conn.commit()
                conn.close()
                
                return jsonify({
                    'error': 'Token balance below minimum. Your license has been deactivated.',
                    'required': MINIMUM_TOKENS,
                    'message': 'Please ensure you hold at least {:,} $SolPumpAI tokens to reactivate.'.format(MINIMUM_TOKENS),
                    'buy_link': 'https://pump.fun/C4br6g4CBAP2grzc2sUrU9wUN7eJGZZpePCN1yjapump'
                }), 403
            
            # Still has tokens - update verification time and reactivate if needed
            c.execute('UPDATE licenses SET last_verified = ?, is_active = 1 WHERE wallet_address = ?',
                      (int(time.time()), wallet_address))
            conn.commit()
        
        conn.close()
        
        if not is_active:
            return jsonify({
                'error': 'License deactivated due to insufficient token balance.',
                'required': MINIMUM_TOKENS
            }), 403
        
        # Return existing license
        return jsonify({
            'license_key': license_key,
            'calls_remaining': calls_remaining,
            'wallet': wallet_address[:8] + '...' + wallet_address[-4:],
            'message': 'Welcome back! Your license is still active.',
            'status': 'existing'
        })
    
    # NEW wallet - verify token balance FIRST
    print(f"[License] Verifying token balance for new wallet...")
    
    has_tokens = check_token_balance(wallet_address)
    
    if not has_tokens:
        conn.close()
        return jsonify({
            'error': f'Insufficient token balance. Need at least {MINIMUM_TOKENS:,} $SolPumpAI tokens.',
            'required': MINIMUM_TOKENS,
            'current': 0,
            'buy_link': 'https://pump.fun/C4br6g4CBAP2grzc2sUrU9wUN7eJGZZpePCN1yjapump',
            'message': 'Buy $SolPumpAI tokens first, then come back to get your license.'
        }), 403
    
    # Generate NEW license key
    # Make it deterministic based on wallet (optional - for recovery)
    # Or completely random (better security)
    license_key = f"SOLPUMPAI-{secrets.token_urlsafe(20)}"
    
    wallet_hash = hash_wallet(wallet_address)
    
    # Store the binding: wallet ↔ license (permanent)
    c.execute('INSERT INTO licenses VALUES (?, ?, ?, ?, ?, ?, ?)',
              (license_key, wallet_address, wallet_hash, int(time.time()), 50, int(time.time()), 1))
    conn.commit()
    conn.close()
    
    print(f"[License] ✅ Generated and BOUND license to {wallet_address[:8]}...")
    
    return jsonify({
        'license_key': license_key,
        'calls_remaining': 50,
        'wallet': wallet_address[:8] + '...' + wallet_address[-4:],
        'message': 'License activated! You have 50 free AI calls to get started.',
        'status': 'new',
        'important': 'This license is permanently bound to your wallet. Keep it safe!'
    })

@app.route('/api/verify-license', methods=['POST'])
def verify_license():
    """
    Extension calls this to verify license is still valid
    Checks: 1) License exists, 2) Wallet still has tokens
    """
    
    license_key = request.headers.get('X-License-Key')
    
    if not license_key:
        return jsonify({'error': 'License key required'}), 401
    
    conn = sqlite3.connect('licenses.db')
    c = conn.cursor()
    c.execute('SELECT wallet_address, is_active, calls_remaining, last_verified FROM licenses WHERE license_key = ?',
              (license_key,))
    result = c.fetchone()
    
    if not result:
        conn.close()
        return jsonify({'error': 'Invalid license key'}), 401
    
    wallet_address, is_active, calls_remaining, last_verified = result
    
    # Check if should re-verify token balance
    if time.time() - last_verified > REVERIFY_INTERVAL:
        print(f"[Verify] Re-checking token balance for {wallet_address[:8]}...")
        
        has_tokens = check_token_balance(wallet_address)
        
        if not has_tokens:
            # Deactivate
            c.execute('UPDATE licenses SET is_active = 0 WHERE license_key = ?',
                      (license_key,))
            conn.commit()
            conn.close()
            
            return jsonify({
                'error': 'License deactivated: wallet no longer holds required tokens',
                'valid': False
            }), 403
        
        # Update verification time
        c.execute('UPDATE licenses SET last_verified = ?, is_active = 1 WHERE license_key = ?',
                  (int(time.time()), license_key))
        conn.commit()
    
    conn.close()
    
    if not is_active:
        return jsonify({
            'error': 'License deactivated',
            'valid': False
        }), 403
    
    return jsonify({
        'valid': True,
        'calls_remaining': calls_remaining,
        'wallet': wallet_address[:8] + '...' + wallet_address[-4:]
    })

@app.route('/api/analyze', methods=['POST'])
def analyze():
    """
    AI analysis endpoint - requires valid license
    Automatically checks wallet still has tokens (if due for re-verification)
    """
    
    license_key = request.headers.get('X-License-Key')
    
    if not license_key:
        return jsonify({'error': 'License key required'}), 401
    
    # Verify license and wallet
    conn = sqlite3.connect('licenses.db')
    c = conn.cursor()
    c.execute('SELECT wallet_address, calls_remaining, is_active, last_verified FROM licenses WHERE license_key = ?',
              (license_key,))
    result = c.fetchone()
    
    if not result:
        conn.close()
        return jsonify({'error': 'Invalid license key'}), 401
    
    wallet_address, calls_remaining, is_active, last_verified = result
    
    # Re-verify if needed
    if time.time() - last_verified > REVERIFY_INTERVAL:
        if not check_token_balance(wallet_address):
            c.execute('UPDATE licenses SET is_active = 0 WHERE license_key = ?', (license_key,))
            conn.commit()
            conn.close()
            return jsonify({'error': 'License deactivated: insufficient tokens'}), 403
        
        c.execute('UPDATE licenses SET last_verified = ? WHERE license_key = ?',
                  (int(time.time()), license_key))
        conn.commit()
    
    if not is_active:
        conn.close()
        return jsonify({'error': 'License deactivated'}), 403
    
    if calls_remaining <= 0:
        conn.close()
        return jsonify({'error': 'No calls remaining'}), 403
    
    # Process the AI request
    data = request.json
    crash_history = data.get('crashHistory', [])
    
    try:
        # Smart model routing
        model = "claude-haiku-4-5-20251001"
        if len(crash_history) % 10 == 0:
            model = "claude-sonnet-4-5-20250929"
        
        # Build prompt
        recent50 = crash_history[-50:]
        dataString = ', '.join([f"{r['multiplier']:.2f}" for r in recent50])
        
        prompt = f"""Analyze crash game patterns: {dataString}

Provide JSON prediction:
{{
  "shouldBet": true/false,
  "targetMultiplier": 2.0,
  "confidence": "HIGH"/"MEDIUM"/"LOW",
  "probability2x": 0.65,
  "reasoning": "brief explanation"
}}"""
        
        response = claude_client.messages.create(
            model=model,
            max_tokens=1000,
            messages=[{"role": "user", "content": prompt}]
        )
        
        # Track usage
        cost = estimate_cost(model, response.usage)
        
        # Log usage with wallet address
        c.execute('INSERT INTO usage VALUES (NULL, ?, ?, ?, ?, ?)',
                  (license_key, wallet_address, int(time.time()), model, cost))
        
        # Deduct call
        c.execute('UPDATE licenses SET calls_remaining = calls_remaining - 1 WHERE license_key = ?',
                  (license_key,))
        
        # Get updated remaining
        c.execute('SELECT calls_remaining FROM licenses WHERE license_key = ?', (license_key,))
        calls_remaining = c.fetchone()[0]
        
        conn.commit()
        conn.close()
        
        return jsonify({
            'analysis': response.content[0].text,
            'model_used': model,
            'cost': cost,
            'calls_remaining': calls_remaining
        })
        
    except Exception as e:
        conn.close()
        return jsonify({'error': str(e)}), 500

@app.route('/api/license-status', methods=['GET'])
def license_status():
    """Get license status and usage stats"""
    
    license_key = request.headers.get('X-License-Key')
    
    if not license_key:
        return jsonify({'error': 'License key required'}), 401
    
    conn = sqlite3.connect('licenses.db')
    c = conn.cursor()
    
    c.execute('SELECT wallet_address, calls_remaining, created_at, is_active FROM licenses WHERE license_key = ?',
              (license_key,))
    result = c.fetchone()
    
    if not result:
        conn.close()
        return jsonify({'error': 'Invalid license key'}), 401
    
    wallet_address, calls_remaining, created_at, is_active = result
    
    # Get usage stats
    c.execute('SELECT COUNT(*), SUM(cost) FROM usage WHERE license_key = ?', (license_key,))
    total_calls, total_cost = c.fetchone()
    
    conn.close()
    
    return jsonify({
        'wallet': wallet_address[:8] + '...' + wallet_address[-4:],
        'calls_remaining': calls_remaining,
        'total_calls': total_calls or 0,
        'total_cost': total_cost or 0,
        'created_at': created_at,
        'is_active': bool(is_active),
        'bound_to': 'This license is permanently bound to your wallet address'
    })

def estimate_cost(model, usage):
    input_tokens = usage.input_tokens
    output_tokens = usage.output_tokens
    
    if 'haiku' in model:
        return (input_tokens * 0.25 + output_tokens * 1.25) / 1_000_000
    elif 'sonnet' in model:
        return (input_tokens * 3 + output_tokens * 15) / 1_000_000
    elif 'opus' in model:
        return (input_tokens * 15 + output_tokens * 75) / 1_000_000
    return 0

if __name__ == '__main__':
    print("🚀 $SolPumpAI Bound License Server")
    print("   ✅ No wallet connection required")
    print("   ✅ License permanently bound to wallet address")
    print("   ✅ One wallet = One license")
    print("   ✅ Auto re-verification every 24h")
    app.run(host='0.0.0.0', port=5000)
