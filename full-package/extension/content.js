// content.js - Main monitoring script
console.log('[Solpump Analyzer] Extension loaded');

class CrashMonitor {
  constructor() {
    this.results = [];
    this.isMonitoring = false;
    this.lastResult = null;
    
    // Pattern detection settings
    this.patternWindow = {
      small: 10,
      medium: 20,
      large: 50
    };
    
    this.init();
  }

  init() {
    console.log('[Solpump Analyzer] Initializing monitor...');
    
    // Inject script to access page context (for WebSocket interception)
    this.injectPageScript();
    
    // Listen for messages from injected script
    window.addEventListener('message', (event) => {
      if (event.source !== window) return;
      
      if (event.data.type === 'CRASH_RESULT') {
        this.handleCrashResult(event.data.multiplier);
      } else if (event.data.type === 'GAME_STATE') {
        this.handleGameState(event.data);
      }
    });
    
    // Listen for messages from popup
    chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
      this.handlePopupMessage(msg, sendResponse);
      return true; // Keep channel open for async response
    });
    
    // Try DOM-based detection as fallback
    this.observeDOM();
    
    // Load historical data
    this.loadHistoricalData();
  }

  injectPageScript() {
    const script = document.createElement('script');
    script.src = chrome.runtime.getURL('injected.js');
    script.onload = function() {
      this.remove();
    };
    (document.head || document.documentElement).appendChild(script);
  }

  observeDOM() {
    // Watch for crash results in the DOM
    const observer = new MutationObserver((mutations) => {
      mutations.forEach(mutation => {
        mutation.addedNodes.forEach(node => {
          if (node.nodeType === 1) { // Element node
            this.scanForCrashResult(node);
          }
        });
      });
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  scanForCrashResult(element) {
    // Look for crash multiplier patterns in text
    const text = element.textContent || '';
    
    // Common patterns: "1.50x", "Crashed at 2.34x", etc.
    const patterns = [
      /crashed\s+at\s+(\d+\.?\d*)x/i,
      /(\d+\.?\d*)x/,
      /multiplier[:\s]+(\d+\.?\d*)/i
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        const multiplier = parseFloat(match[1]);
        if (multiplier > 0 && multiplier < 1000) { // Sanity check
          this.handleCrashResult(multiplier);
          break;
        }
      }
    }
  }

  handleCrashResult(multiplier) {
    if (!multiplier || multiplier === this.lastResult) return;
    
    this.lastResult = multiplier;
    const result = {
      multiplier: parseFloat(multiplier.toFixed(2)),
      timestamp: Date.now(),
      date: new Date().toISOString()
    };

    console.log('[Solpump Analyzer] Crash detected:', result.multiplier + 'x');
    
    this.results.push(result);
    
    // Keep last 500 in memory
    if (this.results.length > 500) {
      this.results.shift();
    }

    // Store in chrome.storage
    this.saveResult(result);
    
    // Analyze pattern
    this.analyzeAndAlert(result);
  }

  handleGameState(state) {
    // Handle real-time game state updates
    console.log('[Solpump Analyzer] Game state:', state);
  }

  async saveResult(result) {
    chrome.storage.local.get(['allResults'], (data) => {
      const allResults = data.allResults || [];
      allResults.push(result);
      
      // Keep last 10000 results
      if (allResults.length > 10000) {
        allResults.splice(0, allResults.length - 10000);
      }
      
      chrome.storage.local.set({ 
        allResults,
        lastUpdate: Date.now()
      });
    });
  }

  async loadHistoricalData() {
    chrome.storage.local.get(['allResults'], (data) => {
      if (data.allResults && data.allResults.length > 0) {
        console.log('[Solpump Analyzer] Loaded', data.allResults.length, 'historical results');
        this.results = data.allResults.slice(-500); // Keep last 500 in memory
      }
    });
  }

  analyzeAndAlert(latestResult) {
    if (this.results.length < 10) return;

    const analysis = this.performAnalysis();
    
    // Check for alert conditions
    const alerts = this.checkAlertConditions(analysis);
    
    if (alerts.length > 0) {
      alerts.forEach(alert => {
        this.sendAlert(alert, analysis);
      });
    }

    // Send update to popup
    chrome.runtime.sendMessage({
      action: 'statsUpdate',
      stats: analysis
    });
  }

  performAnalysis() {
    const recent10 = this.results.slice(-10);
    const recent20 = this.results.slice(-20);
    const recent50 = this.results.slice(-50);
    const all = this.results;

    return {
      timestamp: Date.now(),
      latest: this.lastResult,
      totalGames: this.results.length,
      windows: {
        last10: this.analyzeWindow(recent10),
        last20: this.analyzeWindow(recent20),
        last50: this.analyzeWindow(recent50),
        all: this.analyzeWindow(all)
      },
      patterns: this.detectPatterns(),
      prediction: this.makePrediction()
    };
  }

  analyzeWindow(results) {
    if (results.length === 0) return null;

    const multipliers = results.map(r => r.multiplier);
    
    const above1_5 = multipliers.filter(m => m >= 1.5).length;
    const above2_0 = multipliers.filter(m => m >= 2.0).length;
    const above3_0 = multipliers.filter(m => m >= 3.0).length;
    const above5_0 = multipliers.filter(m => m >= 5.0).length;
    
    const sum = multipliers.reduce((a, b) => a + b, 0);
    const avg = sum / multipliers.length;
    const max = Math.max(...multipliers);
    const min = Math.min(...multipliers);
    
    // Calculate volatility
    const variance = multipliers.reduce((a, b) => a + Math.pow(b - avg, 2), 0) / multipliers.length;
    const volatility = Math.sqrt(variance);

    // Calculate trend
    const trend = this.calculateTrend(multipliers);

    return {
      count: multipliers.length,
      average: parseFloat(avg.toFixed(2)),
      max: parseFloat(max.toFixed(2)),
      min: parseFloat(min.toFixed(2)),
      volatility: parseFloat(volatility.toFixed(2)),
      trend: parseFloat(trend.toFixed(3)),
      frequencies: {
        above1_5: { count: above1_5, rate: parseFloat((above1_5 / multipliers.length * 100).toFixed(1)) },
        above2_0: { count: above2_0, rate: parseFloat((above2_0 / multipliers.length * 100).toFixed(1)) },
        above3_0: { count: above3_0, rate: parseFloat((above3_0 / multipliers.length * 100).toFixed(1)) },
        above5_0: { count: above5_0, rate: parseFloat((above5_0 / multipliers.length * 100).toFixed(1)) }
      }
    };
  }

  calculateTrend(values) {
    const n = values.length;
    if (n < 2) return 0;

    const x = Array.from({ length: n }, (_, i) => i);
    const y = values;
    
    const sumX = x.reduce((a, b) => a + b, 0);
    const sumY = y.reduce((a, b) => a + b, 0);
    const sumXY = x.reduce((a, i) => a + i * y[i], 0);
    const sumX2 = x.reduce((a, i) => a + i * i, 0);
    
    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    return slope;
  }

  detectPatterns() {
    const patterns = [];
    
    if (this.results.length < 10) return patterns;

    const recent10 = this.results.slice(-10).map(r => r.multiplier);
    const recent5 = this.results.slice(-5).map(r => r.multiplier);

    // Hot streak detection
    const high2x_in10 = recent10.filter(m => m >= 2.0).length;
    const high1_5_in10 = recent10.filter(m => m >= 1.5).length;
    
    if (high2x_in10 >= 5) {
      patterns.push({
        type: 'HOT_STREAK_2X',
        description: `${high2x_in10}/10 games crashed above 2.0x`,
        confidence: high2x_in10 >= 7 ? 'HIGH' : 'MEDIUM'
      });
    }

    if (high1_5_in10 >= 7) {
      patterns.push({
        type: 'HOT_STREAK_1.5X',
        description: `${high1_5_in10}/10 games crashed above 1.5x`,
        confidence: high1_5_in10 >= 8 ? 'HIGH' : 'MEDIUM'
      });
    }

    // Uptrend detection
    const avg5 = recent5.reduce((a, b) => a + b, 0) / 5;
    if (avg5 >= 2.5) {
      patterns.push({
        type: 'HIGH_AVERAGE',
        description: `Last 5 games averaged ${avg5.toFixed(2)}x`,
        confidence: 'MEDIUM'
      });
    }

    // Consecutive highs
    let consecutiveAbove2 = 0;
    for (let i = recent10.length - 1; i >= 0; i--) {
      if (recent10[i] >= 2.0) {
        consecutiveAbove2++;
      } else {
        break;
      }
    }

    if (consecutiveAbove2 >= 3) {
      patterns.push({
        type: 'CONSECUTIVE_HIGHS',
        description: `${consecutiveAbove2} consecutive games above 2.0x`,
        confidence: 'HIGH'
      });
    }

    // Cold streak (opposite)
    const lowStreak = recent10.filter(m => m < 1.5).length;
    if (lowStreak >= 6) {
      patterns.push({
        type: 'COLD_STREAK',
        description: `${lowStreak}/10 games below 1.5x - potential reversion`,
        confidence: 'LOW'
      });
    }

    return patterns;
  }

  makePrediction() {
    if (this.results.length < 20) {
      return {
        recommendation: 'WAIT',
        reason: 'Not enough data (need 20+ games)',
        confidence: 'NONE'
      };
    }

    const stats = this.analyzeWindow(this.results.slice(-20));
    const patterns = this.detectPatterns();

    // Simple rule-based prediction
    let score = 0;
    let reasons = [];

    // Check for hot streak
    if (stats.frequencies.above2_0.rate >= 50) {
      score += 3;
      reasons.push(`High 2x+ rate (${stats.frequencies.above2_0.rate}%)`);
    } else if (stats.frequencies.above2_0.rate >= 40) {
      score += 2;
      reasons.push(`Good 2x+ rate (${stats.frequencies.above2_0.rate}%)`);
    }

    if (stats.frequencies.above1_5.rate >= 60) {
      score += 2;
      reasons.push(`High 1.5x+ rate (${stats.frequencies.above1_5.rate}%)`);
    }

    // Check trend
    if (stats.trend > 0.05) {
      score += 2;
      reasons.push('Upward trend detected');
    }

    // Check patterns
    const highConfidencePatterns = patterns.filter(p => p.confidence === 'HIGH');
    if (highConfidencePatterns.length > 0) {
      score += 3;
      reasons.push(highConfidencePatterns[0].description);
    }

    // Cold streak (potential reversion)
    const coldStreak = patterns.find(p => p.type === 'COLD_STREAK');
    if (coldStreak) {
      score += 1;
      reasons.push('Cold streak - mean reversion possible');
    }

    // Make recommendation
    let recommendation, confidence, target;

    if (score >= 6) {
      recommendation = 'BET';
      target = '2.0x';
      confidence = 'HIGH';
    } else if (score >= 4) {
      recommendation = 'BET';
      target = '1.5x';
      confidence = 'MEDIUM';
    } else if (score >= 2) {
      recommendation = 'BET';
      target = '1.5x';
      confidence = 'LOW';
    } else {
      recommendation = 'WAIT';
      target = null;
      confidence = 'NONE';
    }

    return {
      recommendation,
      target,
      confidence,
      score,
      reasons,
      probability2x: Math.min(stats.frequencies.above2_0.rate / 100, 0.9),
      probability1_5x: Math.min(stats.frequencies.above1_5.rate / 100, 0.95)
    };
  }

  checkAlertConditions(analysis) {
    const alerts = [];
    const prediction = analysis.prediction;

    // Alert on high confidence bets
    if (prediction.confidence === 'HIGH') {
      alerts.push({
        type: 'HIGH_CONFIDENCE',
        title: '🔥 High Confidence Bet',
        message: `Target: ${prediction.target} - ${prediction.reasons.join(', ')}`,
        priority: 2
      });
    }

    // Alert on medium confidence for 2x
    if (prediction.confidence === 'MEDIUM' && prediction.target === '2.0x') {
      alerts.push({
        type: 'MEDIUM_CONFIDENCE',
        title: '⚡ Good Opportunity',
        message: `Target: ${prediction.target} - ${prediction.reasons[0]}`,
        priority: 1
      });
    }

    // Alert on patterns
    const highPatterns = analysis.patterns.filter(p => p.confidence === 'HIGH');
    if (highPatterns.length > 0 && prediction.recommendation === 'BET') {
      alerts.push({
        type: 'PATTERN_DETECTED',
        title: '📊 Pattern Alert',
        message: highPatterns[0].description,
        priority: 1
      });
    }

    return alerts;
  }

  sendAlert(alert, analysis) {
    console.log('[Solpump Analyzer] Alert:', alert.title);
    
    // Send to background for notification
    chrome.runtime.sendMessage({
      action: 'showNotification',
      alert,
      analysis
    });

    // Play sound (optional)
    this.playAlertSound();
  }

  playAlertSound() {
    // Create audio element for alert
    const audio = new Audio();
    // Using a data URL for a simple beep
    audio.src = 'data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBCt8zPLTgjMGHm7A7+OZSA0PWqzn7K1aFgxBm+DyvmohBSl5yvLUhC8GI3bG79eSQQsWYbXq6qVTFApFnN/yuWodBCl4yPLUhC8GI3bG79eSQQsWYbXq6qVTFApFnN/yuWodBCl4yPLUhC8GI3bG79eSQQsWYbXq6qVTFApFnN/yuWodBCl4yPLUhC8GI3bG79eSQQsWYbXq6qVTFApFnN/yuWodBCl4yPLUhC8GI3bG79eSQQsWYbXq6qVTFApFnN/yuWodBCl4yPLUhC8GI3bG79eSQQsWYbXq6qVTFApFnN/yuWodBCl4yPLUhC8GI3bG79eSQQsWYbXq6qVTFApFnN/yuWodBCl4yPLUhC8GI3bG79eSQQsWYbXq6qVTFApFnN/yuWodBCl4yPLUhC8GI3bG79eSQQsWYbXq6qVTFApFnN/yuWodBCl4yPLUhC8GI3bG79eSQQsWYbXq6qVTFApFnN/yuWodBCl4yPLUhC8GI3bG79eSQQsWYbXq6qVTFApFnN/yuWodBCl4yPLUhC8GI3bG79eSQQsWYbXq6qVTFApFnN/yuWodBCl4yPLUhC8GI3bG79eSQQsWYbXq6qVTFApFnN/yuWodBCl4yPLUhC8GI3bG79eSQQsWYbXq6qVTFApFnN/yuWodBCl4yPLUhC8GI3bG79eSQQsWYbXq6qVTFApFnN/yuWodBCl4yPLUhC8GI3bG79eSQQsWYbXq6qVTFApFnN/yuWodBCl4yPLUhC8GI3bG79eSQQsWYbXq6qVTFApFnN/yuWodBCl4yPLUhC8GI3bG79eSQQsWYbXq6qVTFApFnN/yuWo=';
    audio.play().catch(e => console.log('Could not play sound'));
  }

  handlePopupMessage(msg, sendResponse) {
    switch(msg.action) {
      case 'getStats':
        const analysis = this.performAnalysis();
        sendResponse({ success: true, stats: analysis });
        break;
        
      case 'clearData':
        this.results = [];
        chrome.storage.local.set({ allResults: [] });
        sendResponse({ success: true });
        break;
        
      case 'getHistory':
        chrome.storage.local.get(['allResults'], (data) => {
          sendResponse({ success: true, history: data.allResults || [] });
        });
        break;
        
      default:
        sendResponse({ success: false, error: 'Unknown action' });
    }
  }
}

// Initialize
const monitor = new CrashMonitor();
