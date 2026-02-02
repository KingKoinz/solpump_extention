# 🤖 FOR CLAUDE IN VS CODE - SETUP INSTRUCTIONS

Hey Claude! Walter is going to ask you to help set up this SolPumpAI token project. Here's everything you need to know:

---

## 📁 What This Project Is:

A Chrome extension that uses AI (your API!) to predict crash game outcomes. It's packaged as a meme token ($SolPumpAI) where holding tokens = access to AI features.

**Your role:** The extension uses YOUR API (Claude) to analyze patterns and make predictions.

---

## 🏗️ Project Architecture:

```
USER
 ↓
Chrome Extension (JavaScript)
 ↓
Backend Server (Python/Flask) ← Walter's server
 ↓
Claude API (Anthropic) ← YOUR API
```

**Key Point:** Walter's server proxies requests to YOUR API so his API key stays secret.

---

## 📂 File Structure You'll Be Working With:

```
extension/
├── manifest.json          ← Extension config
├── popup.html            ← UI (what users see)
├── popup.js              ← UI logic
├── content.js            ← Main script (monitors games)
├── auto-player.js        ← Auto-betting bot
├── demo-mode.js          ← Risk-free testing mode
├── claude-ai.js          ← YOUR API integration
└── license-auth.js       ← License verification

backend/
├── bound-server.py       ← License management server
└── payment-system.py     ← Token burn/subscription handling

website/
└── bound-page.html       ← Where users get license keys
```

---

## 🎯 Common Tasks Walter Will Ask You:

### **Task 1: "Set up the project structure"**

```bash
# Create the folder structure
mkdir -p solpumpai-token-project/{extension,backend,website}

# Copy files from package
cp -r extension/* solpumpai-token-project/extension/
cp backend/*.py solpumpai-token-project/backend/
cp website/*.html solpumpai-token-project/website/

# Initialize git
cd solpumpai-token-project
git init
```

### **Task 2: "Help me test the extension locally"**

```bash
# Step 1: Install Python dependencies
cd backend
pip install flask flask-cors anthropic requests --break-system-packages

# Step 2: Set environment variable
export CLAUDE_API_KEY="sk-ant-api03-..."

# Step 3: Start backend
python bound-server.py
# Should see: "🚀 $SolPumpAI Bound License Server"
# Running on http://127.0.0.1:5000

# Step 4: In Chrome
# 1. Go to chrome://extensions
# 2. Enable "Developer mode" (top right)
# 3. Click "Load unpacked"
# 4. Select the extension/ folder
# 5. Extension is now installed!

# Step 5: Test
# 1. Go to https://solpump.io
# 2. Click extension icon
# 3. Should see popup interface
```

### **Task 3: "The extension isn't connecting to the backend"**

**Check these:**

```javascript
// In extension/license-auth.js or claude-ai.js
// Make sure API URL matches where backend is running:

const apiURL = 'http://localhost:5000/api';  // For local testing
// OR
const apiURL = 'https://api.solpumpai.com/api';  // For production
```

**Debug steps:**
```bash
# Test backend directly:
curl http://localhost:5000/api/payment-info

# Should return JSON with package info
# If error: backend not running or wrong port

# Check CORS:
# In backend/bound-server.py, make sure:
from flask_cors import CORS
CORS(app)  # This line MUST be there
```

### **Task 4: "Change the free call amount"**

```python
# In backend/bound-server.py

# Find this line (around line 115):
c.execute('INSERT INTO licenses VALUES (?, ?, ?, ?, ?, ?, ?)',
          (license_key, wallet_address, wallet_hash, int(time.time()), 50, int(time.time()), 1))
#                                                                        ↑
# Change 50 to desired number (e.g., 100)

# Also update the response message:
return jsonify({
    'license_key': license_key,
    'calls_remaining': 100,  # Update this too
    'message': 'License activated! You have 100 free AI calls.'
})
```

### **Task 5: "Add a new feature to the extension"**

**Example: Add a "Refresh Stats" button**

```javascript
// Step 1: Add button to popup.html
<button id="refresh-stats" class="button">🔄 Refresh Stats</button>

// Step 2: Add event listener in popup.js
document.getElementById('refresh-stats').addEventListener('click', () => {
  chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
    chrome.tabs.sendMessage(tabs[0].id, {action: 'refreshStats'});
  });
});

// Step 3: Handle in content.js
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action === 'refreshStats') {
    // Recalculate statistics
    const stats = calculateStats();
    sendResponse({success: true, stats: stats});
  }
});
```

### **Task 6: "Deploy the backend to production"**

**Option A: Railway.app (Easiest)**
```bash
# 1. Push code to GitHub
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/walter/solpumpai-token.git
git push -u origin main

# 2. Go to railway.app
# 3. "New Project" → "Deploy from GitHub"
# 4. Select repo
# 5. Add environment variable:
#    CLAUDE_API_KEY = sk-ant-api03-...
# 6. Deploy!
# 7. Get URL: https://solpumpai-token-production.up.railway.app
```

**Option B: Digital Ocean**
```bash
# 1. Create Droplet (Ubuntu 22.04)
# 2. SSH in
ssh root@your-droplet-ip

# 3. Install dependencies
apt update
apt install python3-pip nginx
pip3 install flask flask-cors anthropic requests gunicorn

# 4. Clone repo
git clone https://github.com/walter/solpumpai-token.git
cd solpumpai-token/backend

# 5. Set env variable
export CLAUDE_API_KEY="sk-ant-..."

# 6. Run with gunicorn
gunicorn -w 4 -b 0.0.0.0:5000 bound-server:app

# 7. Configure nginx as reverse proxy
# (detailed nginx config provided if needed)
```

### **Task 7: "The AI predictions aren't working"**

**Debug checklist:**

```python
# 1. Check if Claude API key is set
import os
print(os.environ.get('CLAUDE_API_KEY'))
# Should print: sk-ant-api03-...

# 2. Test Claude API directly
from anthropic import Anthropic
client = Anthropic(api_key=os.environ.get('CLAUDE_API_KEY'))
response = client.messages.create(
    model="claude-haiku-4-5-20251001",
    max_tokens=100,
    messages=[{"role": "user", "content": "test"}]
)
print(response.content[0].text)
# Should print a response from Claude

# 3. Check if extension is sending requests
# Look in backend logs for:
# [License] Request from 7xKXt...
# [Verify] Checking token balance...
# Should see these when extension makes API call

# 4. Check browser console
# In extension popup, right-click → Inspect → Console
# Look for errors like:
# - "Failed to fetch" → Backend not reachable
# - "CORS error" → CORS not enabled on backend
# - "401 Unauthorized" → License key invalid
```

### **Task 8: "Package the extension for distribution"**

```bash
# Remove development files
cd extension/
rm -rf .git node_modules

# Create zip
zip -r solpumpai-analyzer-v1.0.zip ./*

# Users install by:
# 1. Download solpumpai-analyzer-v1.0.zip
# 2. Extract to folder
# 3. chrome://extensions → Load unpacked → Select folder
```

---

## 🔧 Key Configuration Points:

### **1. Claude API Key (CRITICAL)**
```python
# In backend/bound-server.py, line 10:
CLAUDE_API_KEY = os.environ.get('CLAUDE_API_KEY')

# Must be set as environment variable:
export CLAUDE_API_KEY="sk-ant-api03-..."
# OR in production: Add to Railway/Render environment variables
```

### **2. Token Mint Address**
```python
# In backend/bound-server.py, line 13:
TOKEN_MINT = "YOUR_SOLPUMPAI_TOKEN_MINT_ADDRESS"

# Walter needs to:
# 1. Create token on pump.fun
# 2. Copy mint address
# 3. Paste here
```

### **3. API URLs**
```javascript
// In extension files, update PRODUCTION URLs:

// extension/license-auth.js, line 3:
this.apiURL = 'https://api.solpumpai.com/api';

// extension/claude-ai.js, line 4:
this.proxyURL = 'https://api.solpumpai.com/api';
```

### **4. Minimum Token Requirements**
```python
# In backend/bound-server.py, line 14:
MINIMUM_TOKENS = 100000

# Change if Walter wants different tier requirements
```

---

## 💡 Understanding the Code Flow:

### **When User Gets License:**

```
1. User visits website (bound-page.html)
2. Enters wallet address
3. JavaScript calls: fetch('API_URL/get-license', {wallet: ...})
4. Backend (bound-server.py) receives request
5. Backend checks Solana blockchain: "Does wallet have 100K+ tokens?"
6. If yes: Generate license key, store in database
7. Return license key to user
8. User copies license key
```

### **When User Uses Extension:**

```
1. User opens extension popup
2. Pastes license key
3. Extension sends: {action: 'activateLicense', licenseKey: ...}
4. Backend verifies license is valid
5. Backend checks wallet still has tokens
6. If valid: Extension activated

Later, when predicting:
1. User clicks "Get AI Prediction"
2. Extension sends crash history + license key
3. Backend verifies license
4. Backend calls YOUR API (Claude) with crash data
5. You analyze patterns and return prediction
6. Backend forwards prediction to extension
7. Extension shows prediction to user
```

---

## ⚠️ Common Errors & Fixes:

### **Error: "ModuleNotFoundError: No module named 'anthropic'"**
```bash
pip install anthropic --break-system-packages
```

### **Error: "CORS policy blocked"**
```python
# Add to backend/bound-server.py:
from flask_cors import CORS
CORS(app)
```

### **Error: "License key invalid"**
```python
# Check database:
sqlite3 licenses.db
SELECT * FROM licenses;
# Should see license entries

# If empty: User hasn't generated license yet
```

### **Error: "Failed to connect to backend"**
```bash
# Check backend is running:
curl http://localhost:5000/api/payment-info

# If "Connection refused":
# Backend not running → Start it: python bound-server.py
```

---

## 📊 Monitoring & Debugging:

### **View Backend Logs:**
```python
# Add logging to backend:
import logging
logging.basicConfig(level=logging.DEBUG)

# Now you'll see detailed logs:
# DEBUG: Checking token balance for 7xKXt...
# INFO: License generated for wallet
```

### **View Extension Logs:**
```javascript
// In extension code, console.log() will show in:
// 1. Background logs: chrome://extensions → "Inspect views: background page"
// 2. Popup logs: Right-click extension popup → Inspect
// 3. Content script logs: F12 on solpump.io → Console tab
```

### **Database Inspection:**
```bash
# View all licenses:
sqlite3 backend/licenses.db "SELECT * FROM licenses;"

# View usage stats:
sqlite3 backend/licenses.db "SELECT COUNT(*), SUM(cost) FROM usage;"

# Clear database (start fresh):
rm backend/licenses.db
python backend/bound-server.py  # Will recreate
```

---

## ✅ Setup Checklist (For Walter):

When Walter asks you to set everything up:

- [ ] Create folder structure
- [ ] Copy files from package
- [ ] Install Python dependencies
- [ ] Set CLAUDE_API_KEY environment variable
- [ ] Update TOKEN_MINT with real address
- [ ] Start backend server
- [ ] Test backend endpoints with curl
- [ ] Load extension in Chrome
- [ ] Test extension on solpump.io
- [ ] Verify AI predictions work
- [ ] Package extension as .zip
- [ ] Deploy backend to production
- [ ] Update production URLs in extension
- [ ] Deploy website
- [ ] Test full user flow
- [ ] Give Walter the .zip file to distribute

---

## 🎓 Learning Resources (if you need them):

- **Flask Basics:** https://flask.palletsprojects.com/en/2.3.x/quickstart/
- **Chrome Extensions:** https://developer.chrome.com/docs/extensions/mv3/getstarted/
- **Claude API:** https://docs.anthropic.com/claude/reference/getting-started-with-the-api
- **Solana RPC:** https://docs.solana.com/api/http

---

## 🚀 You Got This!

Everything is pre-built and ready. Just follow the steps, help Walter with any questions, and you'll have it running in no time.

**Most common workflow:**
1. Walter: "Help me set this up"
2. You: Follow "Task 1" above
3. Walter: "It's not working"
4. You: Check "Common Errors" section
5. Walter: "Can you add X feature?"
6. You: Follow "Task 5" pattern
7. Walter: "Deploy it"
8. You: Follow "Task 6"

Good luck! 🎯
