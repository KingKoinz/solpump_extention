// SolPumpAI Extension - Main Content Script
console.log('[SolPumpAI] Extension activated');

class SolPumpAIAnalyzer {
  constructor() {
    this.isActive = false;
    this.licenseKey = null;
    this.gameHistory = [];
    this.currentPrediction = null;
    this.backendURL = 'http://localhost:5000/api';
    
    this.init();
  }

  init() {
    console.log(`[SolPumpAI] Extension starting on: ${window.location.href}`);
    
    // Always set up message listener, even if not on supported site
    chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
      console.log('[SolPumpAI] Message received in content script:', msg.action);
      this.handleMessage(msg, sendResponse);
      return true; // Keep message channel open for async response
    });
    
    // Check if we're on solpump.io
    if (!this.isOnSolPump()) {
      console.log('[SolPumpAI] Not on supported site - extension inactive but listening for messages');
      return;
    }

    console.log('[SolPumpAI] Detected supported site - initializing...');
    
    // Load license key from storage
    this.loadLicense();
    
    // Set up game monitoring
    this.startGameMonitoring();
  }

  isOnSolPump() {
    const hostname = window.location.hostname;
    const isOnSite = hostname.includes('solpump.io') || hostname.includes('solpump') || hostname.includes('pump.fun');
    console.log(`[SolPumpAI] Hostname check: ${hostname} - Match: ${isOnSite}`);
    return isOnSite;
  }

  async loadLicense() {
    try {
      const result = await chrome.storage.local.get(['solpumpai_license']);
      if (result.solpumpai_license) {
        this.licenseKey = result.solpumpai_license;
        console.log('[SolPumpAI] License loaded');
        await this.verifyLicense();
      } else {
        console.log('[SolPumpAI] No license found - user needs to activate');
      }
    } catch (error) {
      console.error('[SolPumpAI] License load error:', error);
    }
  }

  async verifyLicense() {
    if (!this.licenseKey) return false;

    try {
      const response = await fetch(`${this.backendURL}/verify-license`, {
        method: 'POST',
        headers: {
          'X-License-Key': this.licenseKey,
          'Content-Type': 'application/json'
        }
      });

      const data = await response.json();
      
      if (response.ok && data.valid) {
        this.isActive = true;
        console.log(`[SolPumpAI] License verified - ${data.calls_remaining} calls remaining`);
        return true;
      } else {
        console.error('[SolPumpAI] License verification failed:', data.error);
        this.isActive = false;
        return false;
      }
    } catch (error) {
      console.error('[SolPumpAI] License verification error:', error);
      this.isActive = false;
      return false;
    }
  }

  startGameMonitoring() {
    console.log('[SolPumpAI] Starting game monitoring...');
    
    // Monitor for crash results in multiple ways
    this.watchForCrashResults();
    this.watchWebSocket();
  }

  watchForCrashResults() {
    console.log('[SolPumpAI] Setting up DOM monitoring...');
    
    // Monitor for crash results in multiple ways
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === 1) { // Element node
            this.scanForCrashResult(node);
          }
        });
        
        // Also check for text changes in existing nodes
        if (mutation.type === 'childList' || mutation.type === 'characterData') {
          if (mutation.target && mutation.target.textContent) {
            this.scanForCrashResult(mutation.target);
          }
        }
      });
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: false
    });

    // Scan existing content immediately
    console.log('[SolPumpAI] Scanning existing page content...');
    this.scanForCrashResult(document.body);
    
    // Periodic scanning as backup
    setInterval(() => {
      console.log('[SolPumpAI] Periodic scan...');
      this.scanForCrashResult(document.body);
    }, 5000);
    
    console.log('[SolPumpAI] DOM monitoring active');
  }

  scanForCrashResult(element) {
    // Look for crash multiplier patterns - more aggressive scanning
    const textContent = element.textContent || '';
    
    // Common patterns for crash games
    const multiplierPatterns = [
      /(\d+\.?\d*)x/gi,
      /crashed?\s*at\s*(\d+\.?\d*)/gi,
      /multiplier[:\s]*(\d+\.?\d*)/gi,
      /(\d+\.?\d*)\s*x/gi,
      /x(\d+\.?\d*)/gi
    ];

    for (const pattern of multiplierPatterns) {
      let match;
      pattern.lastIndex = 0; // Reset regex
      while ((match = pattern.exec(textContent)) !== null) {
        const multiplierStr = match[1] || match[0].replace(/[^\d.]/g, '');
        const multiplier = parseFloat(multiplierStr);
        
        if (multiplier >= 1.0 && multiplier <= 1000) {
          console.log(`[SolPumpAI] Found potential crash result: ${multiplier}x from text: "${match[0]}"`);
          this.handleCrashResult(multiplier);
        }
      }
    }

    // Also look for specific game elements by class/id
    const gameElements = element.querySelectorAll ? element.querySelectorAll([
      '[class*="crash"]', 
      '[class*="multiplier"]', 
      '[class*="result"]',
      '[class*="game"]',
      '[id*="crash"]',
      '[id*="multiplier"]',
      '[id*="result"]'
    ].join(',')) : [];

    gameElements.forEach(el => {
      const text = el.textContent || '';
      const multiplierMatch = text.match(/(\d+\.?\d*)/);
      if (multiplierMatch) {
        const multiplier = parseFloat(multiplierMatch[1]);
        if (multiplier >= 1.0 && multiplier <= 1000) {
          console.log(`[SolPumpAI] Found crash result in element: ${multiplier}x`);
          this.handleCrashResult(multiplier);
        }
      }
    });
  }

  watchWebSocket() {
    console.log('[SolPumpAI] Setting up WebSocket monitoring...');
    
    // Use web_accessible_resources instead of inline script to avoid CSP violations
    const script = document.createElement('script');
    script.src = chrome.runtime.getURL('injected.js');
    (document.head || document.documentElement).appendChild(script);
    script.onload = function() {
      this.remove();
      console.log('[SolPumpAI] Injected script loaded');
    };

    // Listen for WebSocket data from injected script
    window.addEventListener('message', (event) => {
      if (event.data.type === 'SOLPUMPAI_CRASH_DATA') {
        console.log('[SolPumpAI] WebSocket crash data received:', event.data);
        const data = event.data.data;
        if (data.multiplier) {
          this.handleCrashResult(parseFloat(data.multiplier));
        }
      }
      
      if (event.data.type === 'CRASH_RESULT') {
        console.log('[SolPumpAI] API crash data received:', event.data);
        if (event.data.multiplier) {
          this.handleCrashResult(parseFloat(event.data.multiplier));
        }
      }
    });
    
    console.log('[SolPumpAI] WebSocket monitoring active');
  }

  handleCrashResult(multiplier) {
    if (!multiplier || multiplier < 1.0) return;
    
    // Avoid duplicate entries (same multiplier within 2 seconds)
    const now = Date.now();
    const recentResults = this.gameHistory.filter(game => now - game.timestamp < 2000);
    if (recentResults.some(game => Math.abs(game.multiplier - multiplier) < 0.01)) {
      console.log(`[SolPumpAI] Duplicate crash result ignored: ${multiplier}x`);
      return;
    }
    
    console.log(`[SolPumpAI] NEW CRASH DETECTED: ${multiplier}x`);
    
    // Add to history
    const result = {
      multiplier: multiplier,
      timestamp: now
    };
    
    this.gameHistory.push(result);
    
    // Keep only last 100 games
    if (this.gameHistory.length > 100) {
      this.gameHistory = this.gameHistory.slice(-100);
    }
    
    // Save to storage
    chrome.storage.local.set({
      solpumpai_history: this.gameHistory
    });
    
    console.log(`[SolPumpAI] Total games detected: ${this.gameHistory.length}`);
    
    // Get AI prediction for next game
    if (this.isActive && this.gameHistory.length >= 3) {
      console.log('[SolPumpAI] Requesting AI prediction...');
      this.getAIPrediction();
    } else if (!this.isActive) {
      console.log('[SolPumpAI] License not active - no AI prediction');
    } else {
      console.log(`[SolPumpAI] Need more games for prediction (${this.gameHistory.length}/3)`);
    }
  }

  async getAIPrediction() {
    if (!this.licenseKey || !this.isActive) {
      console.log('[SolPumpAI] No active license for predictions');
      return;
    }

    try {
      console.log('[SolPumpAI] Requesting AI prediction...');
      
      const response = await fetch(`${this.backendURL}/analyze`, {
        method: 'POST',
        headers: {
          'X-License-Key': this.licenseKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          crashHistory: this.gameHistory.slice(-50) // Send last 50 games
        })
      });

      const data = await response.json();
      
      if (response.ok) {
        console.log('[SolPumpAI] AI prediction received');
        
        try {
          const analysis = JSON.parse(data.analysis);
          this.currentPrediction = {
            shouldBet: analysis.shouldBet,
            targetMultiplier: analysis.targetMultiplier,
            confidence: analysis.confidence,
            probability2x: analysis.probability2x,
            reasoning: analysis.reasoning,
            callsRemaining: data.calls_remaining
          };
        } catch (e) {
          // Fallback if analysis isn't JSON
          this.currentPrediction = {
            shouldBet: false,
            confidence: 'LOW',
            reasoning: 'AI analysis error',
            callsRemaining: data.calls_remaining
          };
        }
        
        // Save prediction to storage
        chrome.storage.local.set({
          solpumpai_prediction: this.currentPrediction
        });
        
        // Notify popup if open
        chrome.runtime.sendMessage({
          type: 'PREDICTION_UPDATE',
          prediction: this.currentPrediction
        });
        
      } else {
        console.error('[SolPumpAI] Prediction error:', data.error);
        if (data.error.includes('calls remaining')) {
          this.isActive = false;
        }
      }
    } catch (error) {
      console.error('[SolPumpAI] Prediction request failed:', error);
    }
  }

  async handleMessage(msg, sendResponse) {
    console.log('[SolPumpAI] Message received:', msg.action);
    
    try {
      switch (msg.action) {
        case 'getStatus':
          const status = {
            isActive: this.isActive,
            onSolPump: this.isOnSolPump(),
            hasLicense: !!this.licenseKey,
            gamesDetected: this.gameHistory.length,
            currentPrediction: this.currentPrediction
          };
          console.log('[SolPumpAI] Sending status:', status);
          sendResponse(status);
          break;
          
        case 'setLicense':
          this.licenseKey = msg.licenseKey;
          await chrome.storage.local.set({
            solpumpai_license: this.licenseKey
          });
          const isValid = await this.verifyLicense();
          sendResponse({ success: isValid });
          break;
          
        case 'getHistory':
          sendResponse({ history: this.gameHistory });
          break;
          
        case 'clearData':
          this.gameHistory = [];
          this.currentPrediction = null;
          await chrome.storage.local.clear();
          sendResponse({ success: true });
          break;
          
        default:
          console.log('[SolPumpAI] Unknown action:', msg.action);
          sendResponse({ error: 'Unknown action' });
      }
    } catch (error) {
      console.error('[SolPumpAI] Message handler error:', error);
      sendResponse({ error: error.message });
    }
  }
}

// Initialize the analyzer
try {
  const analyzer = new SolPumpAIAnalyzer();
  console.log('[SolPumpAI] Content script initialized successfully');
  
  // Let the extension know we're ready
  setTimeout(() => {
    chrome.runtime.sendMessage({ type: 'CONTENT_SCRIPT_READY' }).catch(e => {
      console.log('[SolPumpAI] Could not notify extension ready (normal if popup not open)');
    });
  }, 1000);
  
} catch (error) {
  console.error('[SolPumpAI] Content script initialization failed:', error);
}