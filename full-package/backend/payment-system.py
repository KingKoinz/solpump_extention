# TOKEN PAYMENT SYSTEM - Users burn $SolPumpAI tokens to buy API calls
# Creates deflationary pressure & drives token demand

from flask import Flask, request, jsonify
import sqlite3
import requests
import time

# Token economics
BURN_RATES = {
    'small': {'tokens': 1000, 'calls': 100, 'price_per_call': 10},      # $0.01 per call if token = $0.001
    'medium': {'tokens': 5000, 'calls': 600, 'price_per_call': 8.33},   # 20% bulk discount
    'large': {'tokens': 10000, 'calls': 1500, 'price_per_call': 6.67},  # 33% bulk discount
}

TOKEN_MINT = "YOUR_SOLPUMPAI_TOKEN_MINT"
BURN_WALLET = "YOUR_BURN_WALLET_ADDRESS"  # Dead wallet for burning tokens

def check_burn_transaction(wallet_address, expected_amount, recent_window=300):
    """
    Check if user burned required tokens in last 5 minutes
    User sends tokens to burn wallet with memo: LICENSE_KEY
    """
    
    rpc_url = "https://api.mainnet-beta.solana.com"
    
    try:
        # Get recent transactions from user's wallet
        payload = {
            "jsonrpc": "2.0",
            "id": 1,
            "method": "getSignaturesForAddress",
            "params": [
                wallet_address,
                {"limit": 20}  # Check last 20 transactions
            ]
        }
        
        response = requests.post(rpc_url, json=payload, timeout=10)
        signatures = response.json()['result']
        
        # Check each transaction
        for sig_info in signatures:
            signature = sig_info['signature']
            timestamp = sig_info['blockTime']
            
            # Only check recent transactions (last 5 min)
            if time.time() - timestamp > recent_window:
                continue
            
            # Get transaction details
            tx_payload = {
                "jsonrpc": "2.0",
                "id": 1,
                "method": "getTransaction",
                "params": [
                    signature,
                    {"encoding": "jsonParsed", "maxSupportedTransactionVersion": 0}
                ]
            }
            
            tx_response = requests.post(rpc_url, json=tx_payload, timeout=10)
            tx_data = tx_response.json()['result']
            
            if not tx_data:
                continue
            
            # Parse transaction
            instructions = tx_data['transaction']['message']['instructions']
            
            for instruction in instructions:
                if instruction.get('program') == 'spl-token':
                    info = instruction.get('parsed', {}).get('info', {})
                    
                    # Check if it's a transfer to burn wallet
                    if (info.get('destination') == BURN_WALLET and 
                        info.get('tokenAmount', {}).get('uiAmount', 0) >= expected_amount):
                        
                        print(f"[Payment] ✅ Found burn transaction: {signature[:8]}...")
                        return {
                            'valid': True,
                            'signature': signature,
                            'amount': info['tokenAmount']['uiAmount'],
                            'timestamp': timestamp
                        }
        
        return {'valid': False, 'error': 'No burn transaction found in last 5 minutes'}
        
    except Exception as e:
        print(f"[Payment] Error checking burn: {e}")
        return {'valid': False, 'error': str(e)}

@app.route('/api/buy-calls', methods=['POST'])
def buy_calls():
    """
    User buys API calls by burning $SolPumpAI tokens
    
    Flow:
    1. User selects package (100, 600, or 1500 calls)
    2. Server tells them how many tokens to burn
    3. User sends tokens to burn wallet (via Phantom)
    4. User submits transaction signature
    5. Server verifies burn transaction
    6. Server adds calls to license
    """
    
    license_key = request.headers.get('X-License-Key')
    data = request.json
    
    package = data.get('package')  # 'small', 'medium', 'large'
    tx_signature = data.get('signature')  # Transaction signature
    
    if not license_key or not package or not tx_signature:
        return jsonify({'error': 'Missing required fields'}), 400
    
    if package not in BURN_RATES:
        return jsonify({'error': 'Invalid package'}), 400
    
    # Get license info
    conn = sqlite3.connect('licenses.db')
    c = conn.cursor()
    c.execute('SELECT wallet_address, calls_remaining FROM licenses WHERE license_key = ?',
              (license_key,))
    result = c.fetchone()
    
    if not result:
        conn.close()
        return jsonify({'error': 'Invalid license'}), 401
    
    wallet_address, current_calls = result
    
    # Get package details
    pkg = BURN_RATES[package]
    required_tokens = pkg['tokens']
    calls_to_add = pkg['calls']
    
    # Verify the burn transaction
    print(f"[Payment] Verifying {required_tokens} token burn from {wallet_address[:8]}...")
    
    burn_check = check_burn_transaction(wallet_address, required_tokens)
    
    if not burn_check['valid']:
        conn.close()
        return jsonify({
            'error': 'Burn transaction not verified',
            'details': burn_check.get('error'),
            'help': 'Make sure you sent tokens to the burn wallet in the last 5 minutes'
        }), 400
    
    # Check if we already processed this transaction
    c.execute('SELECT id FROM payments WHERE tx_signature = ?', (tx_signature,))
    if c.fetchone():
        conn.close()
        return jsonify({'error': 'Transaction already processed'}), 400
    
    # Add calls to license
    new_total = current_calls + calls_to_add
    c.execute('UPDATE licenses SET calls_remaining = ? WHERE license_key = ?',
              (new_total, license_key))
    
    # Log the payment
    c.execute('''INSERT INTO payments VALUES 
                 (NULL, ?, ?, ?, ?, ?, ?, ?)''',
              (license_key, wallet_address, package, required_tokens, 
               calls_to_add, tx_signature, int(time.time())))
    
    conn.commit()
    conn.close()
    
    print(f"[Payment] ✅ Added {calls_to_add} calls. New total: {new_total}")
    
    return jsonify({
        'success': True,
        'calls_added': calls_to_add,
        'calls_remaining': new_total,
        'tokens_burned': required_tokens,
        'message': f'Successfully added {calls_to_add} API calls!'
    })

@app.route('/api/payment-info', methods=['GET'])
def payment_info():
    """Get pricing info for buying calls"""
    
    return jsonify({
        'packages': [
            {
                'id': 'small',
                'name': '100 API Calls',
                'tokens_required': 1000,
                'calls': 100,
                'price_per_call': 10,
                'best_for': 'Casual users'
            },
            {
                'id': 'medium',
                'name': '600 API Calls',
                'tokens_required': 5000,
                'calls': 600,
                'price_per_call': 8.33,
                'discount': '17% off',
                'best_for': 'Regular users',
                'popular': True
            },
            {
                'id': 'large',
                'name': '1500 API Calls',
                'tokens_required': 10000,
                'calls': 1500,
                'price_per_call': 6.67,
                'discount': '33% off',
                'best_for': 'Power users'
            }
        ],
        'burn_wallet': BURN_WALLET,
        'token_mint': TOKEN_MINT,
        'instructions': [
            'Select a package',
            'Send tokens to burn wallet address',
            'Submit transaction signature',
            'Calls added instantly!'
        ]
    })

# Add to database init
def init_db_payments():
    conn = sqlite3.connect('licenses.db')
    c = conn.cursor()
    
    c.execute('''CREATE TABLE IF NOT EXISTS payments
                 (id INTEGER PRIMARY KEY AUTOINCREMENT,
                  license_key TEXT,
                  wallet_address TEXT,
                  package TEXT,
                  tokens_burned REAL,
                  calls_added INTEGER,
                  tx_signature TEXT UNIQUE,
                  timestamp INTEGER)''')
    
    conn.commit()
    conn.close()

init_db_payments()

print("💰 Token payment system loaded")
print(f"   Burn wallet: {BURN_WALLET}")
print(f"   Packages: 1K tokens = 100 calls, 5K = 600 calls, 10K = 1500 calls")
