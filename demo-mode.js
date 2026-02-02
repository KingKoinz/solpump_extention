// demo-mode.js - Test all features without risking real money
class DemoMode {
  constructor() {
    this.enabled = false;
    this.virtualBalance = 1.0; // Start with 1 SOL virtual money
    this.settings = {
      betAmount: 0.01,
      targetMultiplier: 2.0,
      autoPlay: false
    };
    
    this.session = {
      gamesWatched: 0,
      virtualBets: [],
      virtualProfit: 0,
      wouldHaveWon: 0,
      wouldHaveLost: 0,
      predictions: [],
      aiRecommendations: []
    };

    this.init();
  }

  init() {
    console.log('[Demo Mode] 🎮 Initializing demo/watch mode...');
    this.loadSession();
  }

  enable() {
    this.enabled = true;
    console.log('[Demo Mode] ✅ Demo mode ENABLED - No real money will be used');
    console.log(`[Demo Mode] 💰 Virtual balance: ${this.virtualBalance} SOL`);
    
    // Show banner on page
    this.showDemoBanner();
  }

  disable() {
    this.enabled = false;
    console.log('[Demo Mode] ⏹️ Demo mode DISABLED');
    this.removeDemoBanner();
  }

  showDemoBanner() {
    // Add visual indicator that demo mode is active
    const banner = document.createElement('div');
    banner.id = 'demo-mode-banner';
    banner.innerHTML = `
      <div style="
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        background: linear-gradient(90deg, #ff6b6b, #feca57);
        color: #000;
        padding: 10px;
        text-align: center;
        font-weight: bold;
        font-size: 14px;
        z-index: 999999;
        box-shadow: 0 2px 10px rgba(0,0,0,0.3);
      ">
        🎮 DEMO MODE ACTIVE - NOT USING REAL MONEY - TRACKING ONLY
        <button style="
          margin-left: 20px;
          padding: 5px 15px;
          background: #fff;
          border: 2px solid #000;
          border-radius: 5px;
          cursor: pointer;
          font-weight: bold;
        " onclick="this.parentElement.remove()">
          Hide Banner
        </button>
      </div>
    `;
    document.body.prepend(banner);
  }

  removeDemoBanner() {
    const banner = document.getElementById('demo-mode-banner');
    if (banner) banner.remove();
  }

  // Simulate a bet without actually placing it
  simulateBet(crashResult, aiPrediction = null) {
    if (!this.enabled) return;

    const betAmount = this.settings.betAmount;
    const targetMultiplier = this.settings.targetMultiplier;
    
    // Check if we have virtual balance
    if (this.virtualBalance < betAmount) {
      console.log('[Demo Mode] ❌ Insufficient virtual balance!');
      return;
    }

    // Deduct virtual bet
    this.virtualBalance -= betAmount;

    // Determine outcome
    const won = crashResult.multiplier >= targetMultiplier;
    const payout = won ? betAmount * targetMultiplier : 0;
    const profit = payout - betAmount;

    // Update virtual balance
    if (won) {
      this.virtualBalance += payout;
    }

    // Record the virtual bet
    const virtualBet = {
      timestamp: Date.now(),
      betAmount,
      targetMultiplier,
      actualCrash: crashResult.multiplier,
      won,
      payout,
      profit,
      aiPrediction: aiPrediction,
      virtualBalance: this.virtualBalance
    };

    this.session.virtualBets.push(virtualBet);
    this.session.gamesWatched++;
    
    if (won) {
      this.session.wouldHaveWon++;
    } else {
      this.session.wouldHaveLost++;
    }
    
    this.session.virtualProfit = this.virtualBalance - 1.0; // Starting balance was 1.0

    // Log the result
    const emoji = won ? '✅' : '❌';
    const sign = profit >= 0 ? '+' : '';
    console.log(
      `[Demo Mode] ${emoji} Virtual Bet: ${betAmount} SOL @ ${targetMultiplier}x | ` +
      `Crashed: ${crashResult.multiplier.toFixed(2)}x | ` +
      `${won ? 'WON' : 'LOST'} | ` +
      `Profit: ${sign}${profit.toFixed(4)} SOL | ` +
      `Balance: ${this.virtualBalance.toFixed(4)} SOL`
    );

    // Show notification
    this.showNotification(virtualBet);

    // Save session
    this.saveSession();

    // Update UI
    this.updateUI();

    return virtualBet;
  }

  // Record AI prediction without betting
  recordPrediction(prediction, crashResult) {
    if (!this.enabled) return;

    this.session.gamesWatched++;

    const record = {
      timestamp: Date.now(),
      prediction: prediction,
      actualCrash: crashResult.multiplier,
      correct: this.isPredictionCorrect(prediction, crashResult.multiplier)
    };

    this.session.predictions.push(record);
    
    console.log(
      `[Demo Mode] 📊 AI Predicted: ${prediction.recommendation} @ ${prediction.target || 'N/A'} | ` +
      `Actual: ${crashResult.multiplier.toFixed(2)}x | ` +
      `${record.correct ? '✅ CORRECT' : '❌ WRONG'}`
    );

    this.saveSession();
    return record;
  }

  isPredictionCorrect(prediction, actualMultiplier) {
    if (prediction.recommendation === 'WAIT') {
      // Correct if crash was low
      return actualMultiplier < 1.5;
    } else if (prediction.recommendation === 'BET') {
      // Correct if crash hit the target
      return actualMultiplier >= (prediction.target || 1.5);
    }
    return false;
  }

  // Simulate auto-play in demo mode
  enableAutoDemo() {
    if (!this.enabled) {
      console.log('[Demo Mode] ⚠️ Enable demo mode first!');
      return;
    }

    this.settings.autoPlay = true;
    console.log('[Demo Mode] 🤖 Auto-demo ENABLED - Will simulate bets automatically');
  }

  disableAutoDemo() {
    this.settings.autoPlay = false;
    console.log('[Demo Mode] ⏹️ Auto-demo DISABLED');
  }

  // Automatically simulate bet when new crash happens
  handleNewCrash(crashResult, aiPrediction) {
    if (!this.enabled) return;

    // Record prediction
    if (aiPrediction) {
      this.recordPrediction(aiPrediction, crashResult);
    }

    // Auto-bet if enabled
    if (this.settings.autoPlay) {
      // Use AI recommendation if available
      if (aiPrediction && aiPrediction.recommendation === 'BET') {
        this.settings.targetMultiplier = aiPrediction.target || 2.0;
        this.simulateBet(crashResult, aiPrediction);
      } else if (!aiPrediction) {
        // No AI, just use default settings
        this.simulateBet(crashResult);
      } else {
        console.log('[Demo Mode] ⏸️ AI says WAIT - skipping this round');
      }
    }
  }

  showNotification(virtualBet) {
    const title = virtualBet.won ? 
      '✅ Virtual Win!' : 
      '❌ Virtual Loss';
    
    const message = virtualBet.won ?
      `Won ${virtualBet.payout.toFixed(4)} SOL (${virtualBet.targetMultiplier}x)` :
      `Lost ${virtualBet.betAmount.toFixed(4)} SOL (crashed at ${virtualBet.actualCrash.toFixed(2)}x)`;

    chrome.runtime.sendMessage({
      action: 'showNotification',
      alert: {
        type: 'DEMO_RESULT',
        title: title,
        message: message + ` | Balance: ${virtualBet.virtualBalance.toFixed(4)} SOL`,
        priority: 0
      }
    });
  }

  updateUI() {
    chrome.runtime.sendMessage({
      action: 'demoModeUpdate',
      session: this.getStats()
    });
  }

  getStats() {
    const winRate = this.session.wouldHaveWon + this.session.wouldHaveLost > 0 ?
      (this.session.wouldHaveWon / (this.session.wouldHaveWon + this.session.wouldHaveLost) * 100) : 0;

    const aiAccuracy = this.session.predictions.length > 0 ?
      (this.session.predictions.filter(p => p.correct).length / this.session.predictions.length * 100) : 0;

    return {
      enabled: this.enabled,
      virtualBalance: this.virtualBalance.toFixed(4),
      gamesWatched: this.session.gamesWatched,
      virtualBets: this.session.virtualBets.length,
      wouldHaveWon: this.session.wouldHaveWon,
      wouldHaveLost: this.session.wouldHaveLost,
      winRate: winRate.toFixed(1),
      virtualProfit: this.session.virtualProfit.toFixed(4),
      profitPercent: (this.session.virtualProfit * 100).toFixed(1),
      aiPredictions: this.session.predictions.length,
      aiAccuracy: aiAccuracy.toFixed(1),
      roi: this.calculateROI()
    };
  }

  calculateROI() {
    const totalBet = this.session.virtualBets.reduce((sum, bet) => sum + bet.betAmount, 0);
    if (totalBet === 0) return '0.0';
    
    const roi = (this.session.virtualProfit / totalBet * 100);
    return roi.toFixed(1);
  }

  saveSession() {
    chrome.storage.local.set({ 
      demoSession: this.session,
      demoBalance: this.virtualBalance 
    });
  }

  loadSession() {
    chrome.storage.local.get(['demoSession', 'demoBalance'], (data) => {
      if (data.demoSession) {
        this.session = data.demoSession;
        console.log('[Demo Mode] 📂 Loaded session:', this.session.gamesWatched, 'games');
      }
      if (data.demoBalance !== undefined) {
        this.virtualBalance = data.demoBalance;
      }
    });
  }

  resetSession() {
    this.session = {
      gamesWatched: 0,
      virtualBets: [],
      virtualProfit: 0,
      wouldHaveWon: 0,
      wouldHaveLost: 0,
      predictions: [],
      aiRecommendations: []
    };
    this.virtualBalance = 1.0;
    this.saveSession();
    console.log('[Demo Mode] 🔄 Session reset');
  }

  exportData() {
    const data = {
      session: this.session,
      stats: this.getStats(),
      virtualBets: this.session.virtualBets,
      predictions: this.session.predictions,
      exportDate: new Date().toISOString()
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `solpump-demo-session-${Date.now()}.json`;
    a.click();
    
    console.log('[Demo Mode] 💾 Data exported');
  }

  configure(settings) {
    this.settings = { ...this.settings, ...settings };
    console.log('[Demo Mode] ⚙️ Settings updated:', this.settings);
  }

  // Generate a detailed report
  generateReport() {
    const stats = this.getStats();
    
    const report = `
╔════════════════════════════════════════════════════════════╗
║           SOLPUMP DEMO MODE - SESSION REPORT               ║
╠════════════════════════════════════════════════════════════╣
║                                                            ║
║  Games Watched:        ${stats.gamesWatched.toString().padStart(4)}                               ║
║  Virtual Bets Placed:  ${stats.virtualBets.toString().padStart(4)}                               ║
║                                                            ║
║  Virtual Balance:      ${stats.virtualBalance} SOL (started: 1.0000)    ║
║  Profit/Loss:          ${stats.virtualProfit} SOL (${stats.profitPercent}%)           ║
║                                                            ║
║  Would Have Won:       ${stats.wouldHaveWon.toString().padStart(4)} games                          ║
║  Would Have Lost:      ${stats.wouldHaveLost.toString().padStart(4)} games                          ║
║  Win Rate:             ${stats.winRate}%                              ║
║  ROI:                  ${stats.roi}%                               ║
║                                                            ║
║  AI Predictions Made:  ${stats.aiPredictions.toString().padStart(4)}                               ║
║  AI Accuracy:          ${stats.aiAccuracy}%                              ║
║                                                            ║
╠════════════════════════════════════════════════════════════╣
║  📊 ANALYSIS                                               ║
╠════════════════════════════════════════════════════════════╣
${this.generateAnalysis(stats)}
╚════════════════════════════════════════════════════════════╝
    `;

    console.log(report);
    return report;
  }

  generateAnalysis(stats) {
    let analysis = '';
    
    if (parseFloat(stats.virtualProfit) > 0) {
      analysis += '║  ✅ PROFITABLE STRATEGY!                                  ║\n';
      analysis += '║     Your settings would have made money.                  ║\n';
    } else if (parseFloat(stats.virtualProfit) < -0.5) {
      analysis += '║  ❌ LOSING STRATEGY!                                      ║\n';
      analysis += '║     Your settings would have lost significant money.     ║\n';
    } else {
      analysis += '║  ⚠️  BREAK-EVEN STRATEGY                                  ║\n';
      analysis += '║     Your settings would be roughly neutral.               ║\n';
    }
    
    analysis += '║                                                            ║\n';
    
    if (parseFloat(stats.winRate) > 55) {
      analysis += '║  🎯 Win rate is good! (>55%)                              ║\n';
    } else if (parseFloat(stats.winRate) < 45) {
      analysis += '║  ⚠️  Win rate is low (<45%)                               ║\n';
      analysis += '║     Consider adjusting target multiplier.                ║\n';
    }
    
    if (parseFloat(stats.aiAccuracy) > 65) {
      analysis += '║  🤖 AI predictions are accurate! (>65%)                   ║\n';
      analysis += '║     Consider following AI recommendations.               ║\n';
    } else if (parseFloat(stats.aiAccuracy) < 55) {
      analysis += '║  ⚠️  AI accuracy is low (<55%)                            ║\n';
      analysis += '║     May need more training data.                         ║\n';
    }
    
    return analysis;
  }
}

// Initialize demo mode
const demoMode = new DemoMode();

// Listen for commands
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action === 'enableDemoMode') {
    demoMode.configure(msg.settings || {});
    demoMode.enable();
    if (msg.autoPlay) demoMode.enableAutoDemo();
    sendResponse({ success: true });
  } else if (msg.action === 'disableDemoMode') {
    demoMode.disable();
    demoMode.disableAutoDemo();
    sendResponse({ success: true });
  } else if (msg.action === 'getDemoStats') {
    sendResponse({ success: true, stats: demoMode.getStats() });
  } else if (msg.action === 'resetDemoSession') {
    demoMode.resetSession();
    sendResponse({ success: true });
  } else if (msg.action === 'exportDemoData') {
    demoMode.exportData();
    sendResponse({ success: true });
  } else if (msg.action === 'generateDemoReport') {
    const report = demoMode.generateReport();
    sendResponse({ success: true, report });
  }
});

// Hook into crash monitor to track results
window.addEventListener('message', (event) => {
  if (event.data.type === 'CRASH_RESULT' && demoMode.enabled) {
    // Get AI prediction if available
    chrome.runtime.sendMessage({ action: 'getLatestPrediction' }, (response) => {
      const aiPrediction = response?.prediction || null;
      
      demoMode.handleNewCrash({
        multiplier: event.data.multiplier,
        timestamp: Date.now()
      }, aiPrediction);
    });
  }
});

console.log('[Demo Mode] 🎮 Demo/Watch mode loaded');
