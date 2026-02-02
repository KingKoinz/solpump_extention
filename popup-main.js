// SolPumpAI Popup - Simple and Functional
let statusCheckInterval = null;
let isUserTyping = false;

document.addEventListener('DOMContentLoaded', () => {
  checkExtensionStatus();
  
  // Refresh status every 3 seconds, but not while user is typing
  statusCheckInterval = setInterval(() => {
    if (!isUserTyping) {
      checkExtensionStatus();
    }
  }, 3000);
});

async function checkExtensionStatus() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    console.log('Current tab URL:', tab.url);
    
    // Check if on supported site
    if (!tab.url.includes('solpump.io') && !tab.url.includes('solpump') && !tab.url.includes('pump.fun')) {
      showNotOnSolPump(tab.url);
      return;
    }
    
    console.log('On supported site, checking content script...');
    
    // Get status from content script
    chrome.tabs.sendMessage(tab.id, { action: 'getStatus' }, (response) => {
      if (chrome.runtime.lastError) {
        console.error('Content script error:', chrome.runtime.lastError.message || chrome.runtime.lastError);
        showContentScriptError(tab.url);
        return;
      }
      
      console.log('Content script response:', response);
      updateStatusDisplay(response);
    });
    
  } catch (error) {
    console.error('Status check error:', error);
    showError('Failed to check status: ' + error.message);
  }
}

function showNotOnSolPump(currentUrl) {
  const loading = document.getElementById('loading');
  const error = document.getElementById('error');
  
  if (loading) loading.style.display = 'none';
  if (error) {
    error.style.display = 'block';
    error.innerHTML = `
      <h3>⚠️ Wrong Website</h3>
      <p><strong>Current:</strong> ${currentUrl || 'Unknown'}</p>
      <p><strong>Required:</strong> solpump.io or pump.fun</p>
      <button id="open-solpump" class="button">
        🚀 Open solpump.io
      </button>
      <button id="open-pumpfun" class="button">
        💰 Open pump.fun
      </button>
    `;
    
    // Add event listeners without inline handlers
    const solpumpBtn = document.getElementById('open-solpump');
    const pumpfunBtn = document.getElementById('open-pumpfun');
    if (solpumpBtn) solpumpBtn.addEventListener('click', () => window.open('https://solpump.io', '_blank'));
    if (pumpfunBtn) pumpfunBtn.addEventListener('click', () => window.open('https://pump.fun', '_blank'));
  }
}

function showContentScriptError(currentUrl) {
  const loading = document.getElementById('loading');
  const error = document.getElementById('error');
  
  if (loading) loading.style.display = 'none';
  if (error) {
    error.style.display = 'block';
    error.innerHTML = `
      <h3>🔧 Extension Not Active</h3>
      <p><strong>URL:</strong> ${currentUrl}</p>
      <p>Content script not responding. Try:</p>
      <ul style="text-align: left; margin: 10px 0; padding-left: 20px;">
        <li>Refresh the page (F5)</li>
        <li>Reload extension in chrome://extensions</li>
        <li>Check browser console (F12)</li>
      </ul>
      <button id="refresh-btn" class="button">
        🔄 Refresh Page
      </button>
    `;
    
    // Add event listener for refresh button
    const refreshBtn = document.getElementById('refresh-btn');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', async () => {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        chrome.tabs.reload(tab.id);
      });
    }
  }
}

function showError(message) {
  const loading = document.getElementById('loading');
  const error = document.getElementById('error');
  
  if (loading) loading.style.display = 'none';
  if (error) {
    error.style.display = 'block';
    error.innerHTML = `
      <h3>❌ Error</h3>
      <p>${message}</p>
    `;
  }
}

function updateStatusDisplay(status) {
  const loading = document.getElementById('loading');
  const error = document.getElementById('error');
  
  if (loading) loading.style.display = 'none';
  if (error) error.style.display = 'none';
  
  if (!status.hasLicense) {
    showLicenseSetup();
    return;
  }
  
  if (!status.isActive) {
    showInactiveLicense();
    return;
  }
  
  showMainInterface(status);
}

function showLicenseSetup() {
  const container = document.querySelector('.container');
  if (!container) {
    console.error('Container element not found');
    return;
  }
  
  container.innerHTML = `
    <div class="prediction-card">
      <div class="prediction-title">🔑 License Required</div>
      <p style="margin: 15px 0; font-size: 14px;">
        Enter your SolPumpAI license key to activate AI predictions.
      </p>
      
      <div class="form-group">
        <input type="text" id="licenseInput" placeholder="SOLPUMPAI-..." 
               style="width: 100%; padding: 12px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.3); 
                      background: rgba(0,0,0,0.3); color: white; font-size: 14px;">
      </div>
      
      <button id="activateBtn" class="button">
        Activate License 🚀
      </button>
      
      <p style="margin-top: 15px; font-size: 12px; opacity: 0.8;">
        Don't have a license? <a href="http://localhost:8000/bound-page.html" target="_blank" style="color: #44ff44;">Get one here</a>
      </p>
    </div>
  `;
  
  // Add event listener for activate button
  const activateBtn = document.getElementById('activateBtn');
  const licenseInput = document.getElementById('licenseInput');
  
  if (activateBtn) {
    activateBtn.addEventListener('click', activateLicense);
  }
  
  // Prevent interface refreshing while user is typing
  if (licenseInput) {
    licenseInput.addEventListener('input', () => {
      isUserTyping = true;
      clearTimeout(window.typingTimeout);
      window.typingTimeout = setTimeout(() => {
        isUserTyping = false;
      }, 2000); // Stop considering user as typing after 2 seconds of no input
    });
    
    licenseInput.addEventListener('focus', () => {
      isUserTyping = true;
    });
    
    licenseInput.addEventListener('blur', () => {
      setTimeout(() => {
        isUserTyping = false;
      }, 500);
    });
  }
}

function showInactiveLicense() {
  const container = document.querySelector('.container');
  if (!container) {
    console.error('Container element not found');
    return;
  }
  
  container.innerHTML = `
    <div class="prediction-card">
      <div class="prediction-title">⚠️ License Inactive</div>
      <p style="margin: 15px 0; font-size: 14px; color: #ff6b6b;">
        Your license is not active. This usually means:
      </p>
      <ul style="margin: 10px 0; padding-left: 20px; font-size: 12px;">
        <li>You don't have enough $SolPumpAI tokens</li>
        <li>No API calls remaining</li>
        <li>Backend server is offline</li>
      </ul>
      
      <button id="reload-btn" class="button">
        🔄 Retry
      </button>
      
      <button id="clear-license-btn" class="button" style="background: rgba(255,68,68,0.3); margin-top: 10px;">
        🗑️ Clear License
      </button>
    </div>
  `;
  
  // Add event listeners
  const reloadBtn = document.getElementById('reload-btn');
  const clearLicenseBtn = document.getElementById('clear-license-btn');
  
  if (reloadBtn) {
    reloadBtn.addEventListener('click', checkExtensionStatus);
  }
  
  if (clearLicenseBtn) {
    clearLicenseBtn.addEventListener('click', clearLicense);
  }
}

function showMainInterface(status) {
  const prediction = status.currentPrediction;
  const container = document.querySelector('.container');
  
  if (!container) {
    console.error('Container element not found');
    return;
  }
  
  container.innerHTML = `
    <div class="stats-grid" style="margin-bottom: 15px;">
      <div class="stat-box">
        <div class="stat-label">Games Detected</div>
        <div class="stat-value" style="color: ${status.gamesDetected > 0 ? '#44ff44' : '#ff6b6b'}">
          ${status.gamesDetected}
        </div>
      </div>
      <div class="stat-box">
        <div class="stat-label">Status</div>
        <div class="stat-value" style="color: #44ff44;">Active</div>
      </div>
    </div>

    <div class="prediction-card">
      <div class="prediction-title">🤖 AI Prediction</div>
      
      ${prediction ? `
        <div class="recommendation ${prediction.shouldBet ? 'BET' : 'WAIT'}">
          ${prediction.shouldBet ? '🎯 BET' : '⏳ WAIT'}
        </div>
        
        <div style="text-align: center; margin: 10px 0;">
          <span class="confidence-badge confidence-${prediction.confidence}">
            ${prediction.confidence} CONFIDENCE
          </span>
        </div>
        
        ${prediction.targetMultiplier ? `
          <p style="text-align: center; margin: 10px 0;">
            Target: <strong>${prediction.targetMultiplier}x</strong>
          </p>
        ` : ''}
        
        <div style="font-size: 12px; margin: 15px 0; opacity: 0.9;">
          <strong>Reasoning:</strong><br>
          ${prediction.reasoning}
        </div>
        
        ${prediction.probability2x ? `
          <div class="stat-box" style="margin: 10px 0;">
            <div class="stat-label">2x+ Probability</div>
            <div class="stat-value">${Math.round(prediction.probability2x * 100)}%</div>
          </div>
        ` : ''}
        
        <p style="font-size: 11px; color: rgba(255,255,255,0.6); margin-top: 15px;">
          API Calls Remaining: ${prediction.callsRemaining || 'Unknown'}
        </p>
      ` : `
        <div style="text-align: center; padding: 30px; opacity: 0.6;">
          <p>Waiting for game data...</p>
          <p style="font-size: 12px; margin-top: 10px;">
            Play a few games on solpump.io to get AI predictions
          </p>
        </div>
      `}
    </div>
    
    <div class="prediction-card">
      <div class="prediction-title">📊 Recent Games</div>
      <button id="show-history-btn" class="button" style="margin: 10px 0;">
        View History
      </button>
      <button id="clear-data-btn" class="button" style="background: rgba(255,68,68,0.3);">
        Clear Data
      </button>
    </div>
  `;
  
  // Add event listeners
  const showHistoryBtn = document.getElementById('show-history-btn');
  const clearDataBtn = document.getElementById('clear-data-btn');
  
  if (showHistoryBtn) {
    showHistoryBtn.addEventListener('click', showHistory);
  }
  
  if (clearDataBtn) {
    clearDataBtn.addEventListener('click', clearData);
  }
}

async function activateLicense() {
  const licenseKey = document.getElementById('licenseInput').value.trim();
  
  if (!licenseKey) {
    alert('Please enter a license key');
    return;
  }
  
  document.getElementById('activateBtn').textContent = 'Activating...';
  document.getElementById('activateBtn').disabled = true;
  
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    chrome.tabs.sendMessage(tab.id, {
      action: 'setLicense',
      licenseKey: licenseKey
    }, (response) => {
      if (response && response.success) {
        alert('✅ License activated successfully!');
        location.reload();
      } else {
        alert('❌ License activation failed. Check your license key.');
        document.getElementById('activateBtn').textContent = 'Activate License 🚀';
        document.getElementById('activateBtn').disabled = false;
      }
    });
    
  } catch (error) {
    console.error('License activation error:', error);
    alert('❌ Activation error. Make sure you are on solpump.io');
    document.getElementById('activateBtn').textContent = 'Activate License 🚀';
    document.getElementById('activateBtn').disabled = false;
  }
}

async function clearLicense() {
  if (confirm('Clear license and all data?')) {
    await chrome.storage.local.clear();
    location.reload();
  }
}

async function clearData() {
  if (confirm('Clear all game history?')) {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    chrome.tabs.sendMessage(tab.id, { action: 'clearData' }, () => {
      alert('✅ Data cleared');
      location.reload();
    });
  }
}

async function showHistory() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  
  chrome.tabs.sendMessage(tab.id, { action: 'getHistory' }, (response) => {
    if (response && response.history) {
      const history = response.history.slice(-20); // Last 20 games
      
      let historyHTML = '<h3>📈 Last 20 Games</h3>';
      
      if (history.length === 0) {
        historyHTML += '<p>No games detected yet</p>';
      } else {
        historyHTML += '<div style="max-height: 200px; overflow-y: auto;">';
        history.reverse().forEach((game, i) => {
          const color = game.multiplier >= 2.0 ? '#44ff44' : game.multiplier >= 1.5 ? '#ffaa00' : '#ff6b6b';
          historyHTML += `
            <div style="padding: 5px; border-bottom: 1px solid rgba(255,255,255,0.1);">
              <span style="color: ${color}; font-weight: bold;">${game.multiplier}x</span>
              <span style="float: right; font-size: 10px; opacity: 0.6;">
                ${new Date(game.timestamp).toLocaleTimeString()}
              </span>
            </div>
          `;
        });
        historyHTML += '</div>';
      }
      
      const container = document.querySelector('.container');
      if (!container) {
        console.error('Container element not found');
        return;
      }
      
      container.innerHTML = `
        <div class="prediction-card">
          ${historyHTML}
          <button id="back-btn" class="button" style="margin-top: 15px;">
            ← Back
          </button>
        </div>
      `;
      
      // Add event listener without inline handler
      const backBtn = document.getElementById('back-btn');
      if (backBtn) {
        backBtn.addEventListener('click', checkExtensionStatus);
      }
    }
  });
}

function setupLicenseForm() {
  // This function is no longer needed since we handle it in showLicenseSetup
  // Keep it empty for backward compatibility
}