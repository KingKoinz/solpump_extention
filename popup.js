// popup.js - Popup UI logic
let currentStats = null;

document.addEventListener('DOMContentLoaded', () => {
  loadStats();
  setupTabs();
  setupButtons();
  setupCrashListener();

  // Auto-refresh every 3 seconds
  setInterval(loadStats, 3000);
});

// Suppress unhandled promise rejection warnings
chrome.runtime.onMessage.addListener(() => true);

function setupCrashListener() {
  // Listen for crash detection notifications from content script
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'crashDetected') {
      console.log('[Popup] Crash detected!', message.multiplier, 'x');
      showCrashNotification(message.multiplier, message.realGames);
      // Immediately refresh stats and history when crash detected
      loadStats();
      if (document.querySelector('.tab.active[data-tab="history"]')) {
        loadHistory();
      }
    }
  });
}

function showCrashNotification(multiplier, realGames) {
  // Create a temporary notification element
  const notification = document.createElement('div');
  notification.style.cssText = `
    position: fixed;
    top: 10px;
    right: 10px;
    background: linear-gradient(135deg, #00ff00, #00aa00);
    color: #000;
    padding: 12px 20px;
    border-radius: 8px;
    font-weight: bold;
    font-size: 14px;
    z-index: 10000;
    box-shadow: 0 4px 12px rgba(0, 255, 0, 0.3);
    animation: slideIn 0.3s ease-out;
  `;
  notification.textContent = `✅ CRASH: ${multiplier.toFixed(2)}x (Real data #${realGames})`;

  // Add animation
  const style = document.createElement('style');
  style.textContent = `
    @keyframes slideIn {
      from { transform: translateX(400px); opacity: 0; }
      to { transform: translateX(0); opacity: 1; }
    }
  `;
  document.head.appendChild(style);

  document.body.appendChild(notification);

  // Remove after 3 seconds
  setTimeout(() => {
    notification.style.transition = 'opacity 0.3s ease-out';
    notification.style.opacity = '0';
    setTimeout(() => notification.remove(), 300);
  }, 3000);
}

function setupTabs() {
  const tabs = document.querySelectorAll('.tab');
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const tabName = tab.dataset.tab;
      
      // Update active tab
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      
      // Update active content
      document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
      });
      document.getElementById(`tab-${tabName}`).classList.add('active');
      
      // Load specific data if needed
      if (tabName === 'history') {
        loadHistory();
      }
    });
  });
}

function setupButtons() {
  // Demo data generation
  const generateDemoBtn = document.getElementById('generate-demo-data');
  if (generateDemoBtn) {
    generateDemoBtn.addEventListener('click', () => {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (!tabs[0]) return;
        chrome.tabs.sendMessage(tabs[0].id, { action: 'generateDemoData' }, (response) => {
          if (chrome.runtime.lastError) {
            alert('[ERROR] Content script not loaded. Refresh solpump.io and try again.');
            return;
          }
          if (response && response.success) {
            alert('[OK] Generated ' + response.count + ' test games!\n\nSwitch to Prediction tab to see analysis');
            loadStats();
          } else {
            alert('[ERROR] Could not generate demo data');
          }
        });
      });
    });
  }

  // Auto-play controls
  document.getElementById('start-autoplay').addEventListener('click', () => {
    const settings = {
      betAmount: parseFloat(document.getElementById('bet-amount').value),
      targetMultiplier: parseFloat(document.getElementById('target-mult').value),
      maxLoss: parseFloat(document.getElementById('stop-loss').value),
      maxWin: parseFloat(document.getElementById('take-profit').value)
    };

    if (confirm(`Start auto-playing with ${settings.betAmount} SOL bets at ${settings.targetMultiplier}x target?`)) {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (!tabs[0]) return;
        chrome.tabs.sendMessage(tabs[0].id, {
          action: 'startAutoPlay',
          settings: settings
        }, (response) => {
          if (chrome.runtime.lastError) {
            alert('[ERROR] Content script not loaded. Refresh solpump.io and try again.');
            return;
          }
          if (response && response.success) {
            document.getElementById('start-autoplay').style.display = 'none';
            document.getElementById('stop-autoplay').style.display = 'block';
            document.getElementById('autoplay-stats-card').style.display = 'block';
            alert('Auto-player started! 🤖');
          }
        });
      });
    }
  });

  document.getElementById('stop-autoplay').addEventListener('click', () => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (!tabs[0]) return;
      chrome.tabs.sendMessage(tabs[0].id, { action: 'stopAutoPlay' }, (response) => {
        if (chrome.runtime.lastError) {
          alert('[ERROR] Content script not loaded. Refresh solpump.io and try again.');
          return;
        }
        if (response && response.success) {
          document.getElementById('start-autoplay').style.display = 'block';
          document.getElementById('stop-autoplay').style.display = 'none';
          alert('Auto-player stopped! ⏹️');
        }
      });
    });
  });

  // Start demo mode button
  const startDemoBtn = document.getElementById('start-demo');
  if (startDemoBtn) {
    startDemoBtn.addEventListener('click', () => {
      console.log('[Popup] Start demo mode clicked');

      // Get demo settings from inputs
      const betAmount = parseFloat(document.getElementById('demo-bet-amount').value) || 0.01;
      const targetMultiplier = parseFloat(document.getElementById('demo-target').value) || 2.0;
      const stopLoss = 0.1; // Default stop loss
      const takeProfit = 0.5; // Default take profit

      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (!tabs[0]) return;
        chrome.tabs.sendMessage(tabs[0].id, {
          action: 'setDemoMode',
          enabled: true,
          betAmount: betAmount,
          targetMultiplier: targetMultiplier,
          stopLoss: stopLoss,
          takeProfit: takeProfit
        }, (response) => {
          if (chrome.runtime.lastError) {
            alert('[ERROR] Content script not loaded. Refresh solpump.io and try again.');
            return;
          }
          if (response && response.success) {
            alert(`[OK] Demo mode started!\nBetting ${betAmount} SOL at ${targetMultiplier}x target`);
            document.getElementById('start-demo').style.display = 'none';
            document.getElementById('stop-demo').style.display = 'block';
            document.getElementById('demo-stats-card').style.display = 'block';
            loadStats();
          } else {
            alert('[ERROR] Could not enable demo mode');
          }
        });
      });
    });
  }

  // Stop demo mode button
  const stopDemoBtn = document.getElementById('stop-demo');
  if (stopDemoBtn) {
    stopDemoBtn.addEventListener('click', () => {
      console.log('[Popup] Stop demo mode clicked');
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (!tabs[0]) return;
        chrome.tabs.sendMessage(tabs[0].id, { action: 'setDemoMode', enabled: false }, (response) => {
          if (chrome.runtime.lastError) {
            alert('[ERROR] Content script not loaded.');
            return;
          }
          if (response && response.success) {
            alert('[OK] Demo mode disabled.');
            document.getElementById('start-demo').style.display = 'block';
            document.getElementById('stop-demo').style.display = 'none';
            loadStats();
          }
        });
      });
    });
  }

  // Clear data button
  document.getElementById('clear-data').addEventListener('click', () => {
    console.log('[Popup] Clear data button clicked');
    if (confirm('Are you sure you want to clear all historical data?')) {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        console.log('[Popup] Found tabs:', tabs.length);
        if (!tabs[0]) {
          alert('[ERROR] No active tab found');
          return;
        }
        console.log('[Popup] Sending clearData message to tab:', tabs[0].id);
        chrome.tabs.sendMessage(tabs[0].id, { action: 'clearData' }, (response) => {
          const error = chrome.runtime.lastError;
          console.log('[Popup] Got response:', response, 'Error:', error);
          if (error) {
            showError('Content script not loaded. Refresh solpump.io.');
            return;
          }
          if (response && response.success) {
            alert('Data cleared!');
            loadStats();
          } else {
            showError('Failed to clear data');
          }
        });
      });
    }
  });
}

function loadStats() {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (!tabs[0]) return;

    chrome.tabs.sendMessage(tabs[0].id, { action: 'getStats' }, (response) => {
      // Suppress lastError to avoid console warnings
      const error = chrome.runtime.lastError;

      console.log('[Popup] loadStats response:', { success: !!response?.success, demoMode: response?.demoMode, hasDemoStats: !!response?.demoStats, gamesDetected: response?.gamesDetected });
      if (response?.demoStats) {
        console.log('[Popup] Received demoStats:', response.demoStats);
      }

      if (response && response.success) {
        currentStats = response.stats;
        updateUI(currentStats, response.demoStats, response.demoMode);
        hideLoading();
      } else if (error) {
        showError('Please navigate to solpump.io to use this extension');
      } else {
        showError('No data available yet. Play some games on Solpump!');
      }
    });
  });
}

function loadHistory() {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    chrome.tabs.sendMessage(tabs[0].id, { action: 'getHistory' }, (response) => {
      if (response && response.success) {
        displayHistory(response.history);
      }
    });
  });
}

function updateUI(stats, demoStats, demoMode) {
  if (!stats || !stats.prediction) return;

  // Update demo stats if demo mode is active
  if (demoMode && demoStats) {
    console.log('[Popup] Updating demo stats:', demoStats);
    const demoGamesEl = document.getElementById('demo-games');
    const demoWinrateEl = document.getElementById('demo-winrate');
    const demoBalanceEl = document.getElementById('demo-balance');
    const demoProfitEl = document.getElementById('demo-profit');

    if (demoGamesEl) demoGamesEl.textContent = demoStats.gamesPlayed;
    if (demoWinrateEl) demoWinrateEl.textContent = demoStats.winRate + '%';
    if (demoBalanceEl) demoBalanceEl.textContent = demoStats.virtualBalance + ' SOL';
    if (demoProfitEl) {
      demoProfitEl.textContent = demoStats.profit + ' SOL';
      demoProfitEl.className = 'stat-value ' + (parseFloat(demoStats.profit) >= 0 ? 'good' : 'bad');
    }
    console.log('[Popup] Demo stats updated in UI');
  } else {
    console.log('[Popup] NOT updating demo stats. demoMode:', demoMode, 'hasDemoStats:', !!demoStats);
  }

  // Update prediction
  const pred = stats.prediction;
  const recElement = document.getElementById('recommendation');
  const confidenceBadge = document.getElementById('confidence-badge');
  const targetElement = document.getElementById('target');
  const reasonsList = document.getElementById('reasons-list');

  recElement.textContent = pred.recommendation;
  recElement.className = `recommendation ${pred.recommendation}`;
  
  confidenceBadge.textContent = pred.confidence;
  confidenceBadge.className = `confidence-badge confidence-${pred.confidence}`;

  if (pred.target) {
    targetElement.textContent = `Target: ${pred.target}`;
  } else {
    targetElement.textContent = pred.reason || '';
  }

  // Update reasons
  reasonsList.innerHTML = '';
  if (pred.reasons && pred.reasons.length > 0) {
    pred.reasons.forEach(reason => {
      const li = document.createElement('li');
      li.textContent = reason;
      reasonsList.appendChild(li);
    });
  }

  // Update probabilities
  document.getElementById('prob-2x').textContent = 
    (pred.probability2x * 100).toFixed(0) + '%';
  document.getElementById('prob-1-5x').textContent = 
    (pred.probability1_5x * 100).toFixed(0) + '%';

  // Color code probabilities
  const prob2xEl = document.getElementById('prob-2x');
  if (pred.probability2x >= 0.5) {
    prob2xEl.classList.add('good');
    prob2xEl.classList.remove('bad');
  } else {
    prob2xEl.classList.add('bad');
    prob2xEl.classList.remove('good');
  }

  // Update patterns
  if (stats.patterns && stats.patterns.length > 0) {
    document.getElementById('patterns-card').style.display = 'block';
    const patternsList = document.getElementById('patterns-list');
    patternsList.innerHTML = '';
    
    stats.patterns.forEach(pattern => {
      const div = document.createElement('div');
      div.className = 'pattern-item';
      div.innerHTML = `
        <span>${pattern.description}</span>
        <span class="confidence-badge confidence-${pattern.confidence}">${pattern.confidence}</span>
      `;
      patternsList.appendChild(div);
    });
  } else {
    document.getElementById('patterns-card').style.display = 'none';
  }

  // Update stats tab
  if (stats.windows) {
    updateWindowStats('10', stats.windows.last10);
    updateWindowStats('50', stats.windows.last50);
  }

  // Update total games
  document.getElementById('total-games').textContent = stats.totalGames || 0;
}

function updateWindowStats(window, data) {
  if (!data) return;

  if (window === '10') {
    document.getElementById('avg-10').textContent = data.average + 'x';
    document.getElementById('rate-2x-10').textContent = data.frequencies.above2_0.rate + '%';
  } else if (window === '50') {
    document.getElementById('avg-50').textContent = data.average + 'x';
    document.getElementById('vol-50').textContent = data.volatility.toFixed(2);
    document.getElementById('rate-1-5x-50').textContent = data.frequencies.above1_5.rate + '%';
    document.getElementById('rate-2x-50').textContent = data.frequencies.above2_0.rate + '%';
  }
}

function displayHistory(history) {
  const historyList = document.getElementById('history-list');
  
  if (!history || history.length === 0) {
    historyList.innerHTML = '<div style="text-align: center; opacity: 0.6; padding: 20px;">No data yet</div>';
    return;
  }

  historyList.innerHTML = '';
  
  // Show last 20
  const recent = history.slice(-20).reverse();
  
  recent.forEach(result => {
    const div = document.createElement('div');
    div.className = 'history-item';

    const multiplier = result.multiplier;
    let multiplierClass = 'low';
    if (multiplier >= 2.0) multiplierClass = 'high';
    else if (multiplier >= 1.5) multiplierClass = 'medium';

    const time = new Date(result.timestamp).toLocaleTimeString();

    // Show demo bet info if available
    if (result.source === 'demo_bet') {
      const profitLoss = parseFloat(result.profitLoss);
      const profitClass = profitLoss > 0 ? 'good' : profitLoss < 0 ? 'bad' : '';
      const profitText = profitLoss > 0 ? `+${profitLoss.toFixed(4)}` : `${profitLoss.toFixed(4)}`;

      div.innerHTML = `
        <div style="display: flex; justify-content: space-between; width: 100%;">
          <div>
            <span class="multiplier ${multiplierClass}">${multiplier.toFixed(2)}x</span>
            <span style="opacity: 0.6; margin-left: 8px; font-size: 12px;">${result.result}</span>
          </div>
          <div style="text-align: right;">
            <span style="color: ${profitClass === 'good' ? '#44ff44' : '#ff4444'}; font-weight: bold;">${profitText} SOL</span>
            <span style="opacity: 0.6; margin-left: 8px; font-size: 12px;">${time}</span>
          </div>
        </div>
      `;
    } else {
      // Regular crash display
      div.innerHTML = `
        <span class="multiplier ${multiplierClass}">${multiplier.toFixed(2)}x</span>
        <span style="opacity: 0.6;">${time}</span>
      `;
    }

    historyList.appendChild(div);
  });
}

function showError(message) {
  const errorElement = document.getElementById('error');
  errorElement.textContent = message;
  errorElement.style.display = 'block';
  document.getElementById('loading').style.display = 'none';
}

// Listen for auto-player stats updates
chrome.runtime.onMessage.addListener((message) => {
  if (message.action === 'autoPlayerStats') {
    updateAutoPlayerStats(message.stats);
  }
});

function updateAutoPlayerStats(stats) {
  document.getElementById('ap-games').textContent = stats.gamesPlayed;
  
  const winRate = stats.gamesPlayed > 0 ? 
    (stats.wins / stats.gamesPlayed * 100).toFixed(1) : 0;
  document.getElementById('ap-winrate').textContent = winRate + '%';
  
  document.getElementById('ap-bet').textContent = stats.totalBet.toFixed(4);
  
  const profitEl = document.getElementById('ap-profit');
  profitEl.textContent = stats.profit.toFixed(4);
  profitEl.className = 'stat-value ' + (stats.profit >= 0 ? 'good' : 'bad');
}

function hideLoading() {
  document.getElementById('loading').style.display = 'none';
  document.getElementById('error').style.display = 'none';
}
