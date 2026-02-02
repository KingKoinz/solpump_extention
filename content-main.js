// SolPumpAI Extension - Real Data Capture v3
console.log('[SolPumpAI] v3 Content script loaded');

// Inject the page-context script to intercept WebSocket
(function injectScript() {
  try {
    const script = document.createElement('script');
    script.src = chrome.runtime.getURL('injected.js');
    script.onload = function() {
      console.log('[SolPumpAI] Injected script successfully loaded into page context');
      this.remove();
    };
    script.onerror = function() {
      console.error('[SolPumpAI] Failed to load injected script');
      this.remove();
    };
    (document.head || document.documentElement).appendChild(script);
  } catch (err) {
    console.error('[SolPumpAI] Error injecting script:', err);
  }
})();

// Global state
let gameHistory = [];
let licenseKey = null;
let isActive = false;
let demoMode = false;
let demoSession = null; // Virtual betting session

// Demo session tracker
class DemoSession {
  constructor(betAmount, targetMultiplier, stopLoss, takeProfit) {
    this.betAmount = betAmount;
    this.targetMultiplier = targetMultiplier;
    this.stopLoss = stopLoss;
    this.takeProfit = takeProfit;
    this.virtualBalance = 1.0; // Start with 1 SOL
    this.totalBets = 0;
    this.wins = 0;
    this.losses = 0;
    this.betsPlaced = [];
    this.sessionProfit = 0;
  }

  placeBet(crashMultiplier, crashTimestamp) {
    // Check if we've hit stop loss or take profit
    if (this.sessionProfit <= -this.stopLoss || this.sessionProfit >= this.takeProfit) {
      console.log('[SolPumpAI] Demo: Stop loss/take profit hit, not placing bet');
      return null;
    }

    const bet = {
      amount: this.betAmount,
      target: this.targetMultiplier,
      crashMultiplier: crashMultiplier,
      timestamp: crashTimestamp,
      result: crashMultiplier >= this.targetMultiplier ? 'WIN' : 'LOSS'
    };

    this.totalBets += this.betAmount;

    if (bet.result === 'WIN') {
      const profit = this.betAmount * (this.targetMultiplier - 1);
      this.virtualBalance += profit;
      this.sessionProfit += profit;
      this.wins++;
      console.log(`[SolPumpAI] Demo: BET WON! +${profit.toFixed(4)} SOL (Exited at ${this.targetMultiplier}x, Crash: ${crashMultiplier}x)`);
    } else {
      this.virtualBalance -= this.betAmount;
      this.sessionProfit -= this.betAmount;
      this.losses++;
      console.log(`[SolPumpAI] Demo: BET LOST! -${this.betAmount.toFixed(4)} SOL (Crash: ${crashMultiplier}x < Target: ${this.targetMultiplier}x)`);
    }

    this.betsPlaced.push(bet);
    return bet;
  }

  getStats() {
    const gamesPlayed = this.wins + this.losses;
    const winRate = gamesPlayed > 0 ? ((this.wins / gamesPlayed) * 100).toFixed(1) : 0;
    const stats = {
      gamesPlayed: gamesPlayed,
      wins: this.wins,
      losses: this.losses,
      winRate: parseFloat(winRate),
      totalBet: this.totalBets,
      virtualBalance: this.virtualBalance.toFixed(4),
      profit: this.sessionProfit.toFixed(4)
    };
    console.log('[SolPumpAI] DemoSession.getStats():', JSON.stringify(stats));
    return stats;
  }
}

// Track recently processed crashes by game ID to prevent duplicates
let processedCrashIds = new Set();

// Track active games for live multiplier monitoring (for auto-cashout feature)
let activeGames = {}; // { gameId: { targetMultiplier, startTime, maxLiveMultiplier } }

// Listen for real crash data from injected script
window.addEventListener('message', (event) => {
  try {
    if (event.source !== window) return;

    // Handle live game state updates during gameplay
    if (event.data.type === 'GAME_STATE_UPDATE') {
      const gameId = event.data.gameId;
      const liveMultiplier = event.data.liveMultiplier;
      const liveMultiplierField = event.data.liveMultiplierField;

      if (gameId && liveMultiplier !== null && liveMultiplier !== undefined) {
        // Track this game's progress
        if (!activeGames[gameId]) {
          activeGames[gameId] = {
            startTime: Date.now(),
            maxLiveMultiplier: liveMultiplier,
            liveMultiplierField: liveMultiplierField
          };
          console.log(`[SolPumpAI] 🎮 New game started (${gameId}), tracking field: ${liveMultiplierField}`);
        }

        // Update max live multiplier seen for this game
        if (liveMultiplier > activeGames[gameId].maxLiveMultiplier) {
          activeGames[gameId].maxLiveMultiplier = liveMultiplier;
        }

        // Check if demo mode is active and if we have a target to monitor
        if (demoMode && demoSession) {
          const targetMultiplier = demoSession.targetMultiplier;

          // If live multiplier has reached or exceeded target, trigger auto-cashout
          if (liveMultiplier >= targetMultiplier) {
            console.log(`[SolPumpAI] 🎯 AUTO-CASHOUT TRIGGERED: Live ${liveMultiplier}x (${liveMultiplierField}) >= Target ${targetMultiplier}x for game ${gameId}`);
            // In real mode, this would trigger an actual click/cashout
            // In demo mode, we'll wait for the crash result and the bet will be evaluated
          }
        }
      }
      return; // Don't process this further
    }

    // Log all postMessage events for debugging
    if (event.data.type === 'CRASH_RESULT') {
      const multiplier = event.data.multiplier;
      const gameId = event.data.gameId; // Unique game identifier
      const now = Date.now();

      console.log('[SolPumpAI] Received CRASH_RESULT postMessage:', { multiplier, gameId });

      // Skip if we've already processed this game ID (prevents duplicates)
      if (gameId && processedCrashIds.has(gameId)) {
        console.log('[SolPumpAI] Duplicate crash ignored (game ID:', gameId, ')');
        return;
      }

      // Mark this game as processed
      if (gameId) {
        processedCrashIds.add(gameId);
        // Cleanup: keep only last 100 game IDs to prevent memory leak
        if (processedCrashIds.size > 100) {
          const idsArray = Array.from(processedCrashIds);
          processedCrashIds = new Set(idsArray.slice(-50));
        }
        // Clean up active game tracking (game has ended)
        delete activeGames[gameId];
      }

      const timestamp = now;
      console.log('[SolPumpAI] ✅ REAL CRASH DETECTED:', multiplier, 'x');

      // Add to real game history
      gameHistory.push({
        multiplier: multiplier,
        timestamp: timestamp,
        source: 'real'
      });

      // Keep max 500 games
      if (gameHistory.length > 500) {
        gameHistory.shift();
      }

      // DEMO MODE: Simulate betting on this crash
      if (demoMode && demoSession) {
        console.log('[SolPumpAI] DEMO MODE: Placing bet for crash', multiplier, 'x');
        const bet = demoSession.placeBet(multiplier, timestamp);
        if (bet) {
          // Add bet result to history with demo info
          gameHistory.push({
            multiplier: multiplier,
            timestamp: timestamp,
            source: 'demo_bet',
            betAmount: bet.amount,
            targetMultiplier: bet.target,
            result: bet.result,
            profitLoss: bet.result === 'WIN' ? (bet.amount * (bet.target - 1)) : (-bet.amount)
          });
          console.log('[SolPumpAI] Demo bet processed - Result:', bet.result, 'Updated stats:', demoSession.getStats());
        } else {
          console.log('[SolPumpAI] Demo bet returned null - likely hit stop loss/take profit');
        }
      } else {
        console.log('[SolPumpAI] Demo mode disabled or demoSession null. demoMode:', demoMode, 'demoSession:', !!demoSession);
      }

      const realCount = gameHistory.filter(g => g.source === 'real').length;
      console.log('[SolPumpAI] Game history updated - Total:', gameHistory.length, '| Real data:', realCount);

      // Notify popup of new crash (with error handling for extension context)
      try {
        if (chrome && chrome.runtime && chrome.runtime.id) {
          chrome.runtime.sendMessage({
            action: 'crashDetected',
            multiplier: multiplier,
            totalGames: gameHistory.length,
            realGames: realCount
          }).catch(() => {
            // Popup might not be open, ignore error
          });
        }
      } catch (err) {
        // Extension context invalidated, silently ignore
        // The data is still stored in gameHistory
      }
    }
  } catch (error) {
    console.error('[SolPumpAI] Error in message listener:', error);
  }
});

// Message handler - SYNCHRONOUS ONLY
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  console.log('[SolPumpAI] Message:', msg.action);

  if (msg.action === 'generateDemoData') {
    // Enable demo mode - will listen to REAL crash data and simulate betting
    console.log('[SolPumpAI] Demo mode enabled - will track real crashes with simulated betting');
    demoMode = true;

    // If we don't have any real data yet, generate some test data to show the feature works
    if (gameHistory.filter(g => g.source === 'real').length === 0) {
      console.log('[SolPumpAI] No real games yet, generating 50 test games for demo...');
      for (let i = 0; i < 50; i++) {
        let mult = 1 + Math.random() * 5;
        gameHistory.push({
          multiplier: parseFloat(mult.toFixed(2)),
          timestamp: Date.now() - (50 - i) * 30000,
          source: 'demo'
        });
      }
    }

    const stats = analyzeGames();
    console.log('[SolPumpAI] Demo mode active, current games:', gameHistory.length, 'real:', gameHistory.filter(g => g.source === 'real').length);
    sendResponse({ success: true, stats: stats, count: gameHistory.length });
    return true;
  }

  if (msg.action === 'getStats') {
    const stats = analyzeGames();
    console.log('[SolPumpAI] Stats sent, real games:', gameHistory.filter(g => g.source === 'real').length);

    // Include demo session stats if active
    let demoStats = null;
    if (demoMode && demoSession) {
      demoStats = demoSession.getStats();
      console.log('[SolPumpAI] Demo mode is ACTIVE, sending demoStats:', demoStats);
    } else {
      console.log('[SolPumpAI] Demo mode is OFF or demoSession is null. demoMode:', demoMode, 'demoSession:', !!demoSession);
    }

    console.log('[SolPumpAI] Sending response with:', { gamesDetected: gameHistory.length, demoMode: demoMode, hasDemoStats: !!demoStats });
    sendResponse({ success: true, stats: stats, gamesDetected: gameHistory.length, demoMode: demoMode, demoStats: demoStats });
    return true;
  }

  if (msg.action === 'getHistory') {
    sendResponse({ success: true, history: gameHistory });
    return true;
  }

  if (msg.action === 'clearData') {
    console.log('[SolPumpAI] clearData action received');
    console.log('[SolPumpAI] Before clear - gameHistory length:', gameHistory.length);
    gameHistory = [];
    demoMode = false;
    console.log('[SolPumpAI] After clear - gameHistory length:', gameHistory.length);
    console.log('[SolPumpAI] Data cleared successfully');
    sendResponse({ success: true });
    return true;
  }

  if (msg.action === 'setLicense') {
    licenseKey = msg.licenseKey;
    isActive = true;
    console.log('[SolPumpAI] License set');
    sendResponse({ success: true });
    return true;
  }

  if (msg.action === 'setDemoMode') {
    if (msg.enabled) {
      // Enable demo mode with settings
      demoMode = true;
      demoSession = new DemoSession(
        msg.betAmount || 0.01,
        msg.targetMultiplier || 2.0,
        msg.stopLoss || 0.1,
        msg.takeProfit || 0.5
      );
      console.log('[SolPumpAI] Demo mode ENABLED with settings:', {
        betAmount: demoSession.betAmount,
        targetMultiplier: demoSession.targetMultiplier,
        stopLoss: demoSession.stopLoss,
        takeProfit: demoSession.takeProfit
      });
      console.log('[SolPumpAI] Initial demoSession state:', JSON.stringify(demoSession.getStats()));
    } else {
      // Disable demo mode
      demoMode = false;
      if (demoSession) {
        console.log('[SolPumpAI] Demo mode DISABLED. Final stats:', demoSession.getStats());
      }
      demoSession = null;
      activeGames = {}; // Clear active game tracking
      console.log('[SolPumpAI] demoSession set to null');
    }
    sendResponse({ success: true });
    return true;
  }

  sendResponse({ error: 'Unknown action' });
  return true;
});

// Analysis functions
function analyzeGames() {
  if (gameHistory.length === 0) {
    return {
      timestamp: Date.now(),
      totalGames: 0,
      latest: null,
      windows: { last10: null, last20: null, last50: null, all: null },
      patterns: [],
      prediction: { recommendation: 'WAIT', confidence: 'NONE', target: null, reasons: [] }
    };
  }

  const stats = {
    timestamp: Date.now(),
    totalGames: gameHistory.length,
    latest: gameHistory[gameHistory.length - 1].multiplier,
    windows: {
      last10: analyzeWindow(gameHistory.slice(-10)),
      last20: analyzeWindow(gameHistory.slice(-20)),
      last50: analyzeWindow(gameHistory.slice(-50)),
      all: analyzeWindow(gameHistory)
    },
    patterns: [],
    prediction: makePrediction(),
    demoMode: demoMode,
    realGamesCount: gameHistory.filter(g => g.source === 'real').length
  };

  return stats;
}

function analyzeWindow(games) {
  if (games.length === 0) return null;

  const mults = games.map(g => g.multiplier);
  const sum = mults.reduce((a, b) => a + b, 0);
  const avg = sum / mults.length;
  const max = Math.max(...mults);
  const min = Math.min(...mults);
  const above2 = mults.filter(m => m >= 2.0).length;
  const above1_5 = mults.filter(m => m >= 1.5).length;

  return {
    count: mults.length,
    average: parseFloat(avg.toFixed(2)),
    max: parseFloat(max.toFixed(2)),
    min: parseFloat(min.toFixed(2)),
    volatility: 0.5,
    trend: 0,
    frequencies: {
      above1_5: { count: above1_5, rate: parseFloat((above1_5 / mults.length * 100).toFixed(1)) },
      above2_0: { count: above2, rate: parseFloat((above2 / mults.length * 100).toFixed(1)) },
      above3_0: { count: 0, rate: 0 },
      above5_0: { count: 0, rate: 0 }
    }
  };
}

function makePrediction() {
  if (gameHistory.length < 10) {
    return {
      recommendation: 'WAIT',
      reason: 'Need more data',
      confidence: 'NONE',
      target: null,
      reasons: [],
      probability2x: 0,
      probability1_5x: 0
    };
  }

  const recent = gameHistory.slice(-20);
  const mults = recent.map(g => g.multiplier);
  const above2 = mults.filter(m => m >= 2.0).length;
  const above1_5 = mults.filter(m => m >= 1.5).length;
  const rate2x = (above2 / mults.length * 100);
  const rate1_5x = (above1_5 / mults.length * 100);

  let rec = 'WAIT';
  let conf = 'NONE';
  let target = null;
  let reasons = [];

  if (rate2x >= 50) {
    rec = 'BET';
    target = '2.0x';
    conf = 'HIGH';
    reasons.push(`High 2x+ rate (${rate2x}%)`);
  } else if (rate1_5x >= 60) {
    rec = 'BET';
    target = '1.5x';
    conf = 'LOW';
    reasons.push(`High 1.5x+ rate (${rate1_5x}%)`);
  }

  return {
    recommendation: rec,
    target: target,
    confidence: conf,
    score: above2,
    reasons: reasons,
    probability2x: Math.min(rate2x / 100, 0.9),
    probability1_5x: Math.min(rate1_5x / 100, 0.95)
  };
}

console.log('[SolPumpAI] v3 Listening for real crash data from website...');
console.log('[SolPumpAI] v3 Initialized');
