#!/usr/bin/env python3

import requests
import json

# Your wallet and token details
WALLET_ADDRESS = "7yNfNADhnCikE4EquxEZjpEqHeSRQngP8RbRWmuAYWWx"
TOKEN_MINT = "C4br6g4CBAP2grzc2sUrU9wUN7eJGZZpePCN1yjapump"

def test_token_balance():
    print(f"Testing token balance for wallet: {WALLET_ADDRESS}")
    print(f"Looking for token mint: {TOKEN_MINT}")
    print("-" * 60)
    
    rpc_url = "https://api.mainnet-beta.solana.com"
    
    payload = {
        "jsonrpc": "2.0",
        "id": 1,
        "method": "getTokenAccountsByOwner",
        "params": [
            WALLET_ADDRESS,
            {"mint": TOKEN_MINT},
            {"encoding": "jsonParsed"}
        ]
    }
    
    try:
        print("Making RPC call to Solana...")
        response = requests.post(rpc_url, json=payload, timeout=10)
        data = response.json()
        
        print(f"Raw RPC Response:")
        print(json.dumps(data, indent=2))
        print("-" * 60)
        
        if 'error' in data:
            print(f"❌ RPC Error: {data['error']}")
            return
            
        if 'result' in data:
            accounts = data['result']['value']
            print(f"Found {len(accounts)} token account(s)")
            
            if accounts:
                for i, account in enumerate(accounts):
                    token_info = account['account']['data']['parsed']['info']
                    balance = int(token_info['tokenAmount']['amount'])
                    decimals = token_info['tokenAmount']['decimals']
                    actual_balance = balance / (10 ** decimals)
                    
                    print(f"Account {i+1}:")
                    print(f"  Raw balance: {balance}")
                    print(f"  Decimals: {decimals}")
                    print(f"  Actual balance: {actual_balance:,.0f}")
                    print(f"  Owner: {token_info['owner']}")
                    print(f"  Mint: {token_info['mint']}")
                    
                    if actual_balance >= 1000:
                        print("✅ SUFFICIENT BALANCE!")
                    else:
                        print("❌ Insufficient balance")
            else:
                print("❌ No token accounts found for this mint")
                print("\nPossible reasons:")
                print("1. Wallet doesn't hold any of this token")
                print("2. Token mint address is incorrect")
                print("3. Wallet address is incorrect")
        else:
            print("❌ Unexpected response format")
            
    except Exception as e:
        print(f"❌ Error: {e}")

if __name__ == "__main__":
    test_token_balance()