// SolPumpAI Background Service Worker
console.log('[SolPumpAI] Background service worker loaded');

// Handle messages from content script and popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('[SolPumpAI] Background received message:', message.type);
  
  if (message.type === 'PREDICTION_UPDATE') {
    // Update badge when new prediction arrives
    updateBadge(message.prediction);
  }
  
  return true; // Keep message channel open for async response
});

function updateBadge(prediction) {
  if (!prediction) return;
  
  try {
    let badgeText = '';
    let badgeColor = '#666666';

    if (prediction.confidence === 'HIGH') {
      badgeText = '🔥';
      badgeColor = '#FF0000';
    } else if (prediction.confidence === 'MEDIUM') {
      badgeText = '⚡';
      badgeColor = '#FFA500';
    } else if (prediction.shouldBet) {
      badgeText = '💡';
      badgeColor = '#00AA00';
    }

    chrome.action.setBadgeText({ text: badgeText });
    chrome.action.setBadgeBackgroundColor({ color: badgeColor });
  } catch (error) {
    console.error('[SolPumpAI] Badge update error:', error);
  }
}

// Clean up old data periodically
chrome.runtime.onInstalled.addListener(() => {
  console.log('[SolPumpAI] Extension installed/updated');
  
  // Set up periodic cleanup
  chrome.alarms.create('cleanup', { periodInMinutes: 60 });
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'cleanup') {
    chrome.storage.local.get(['solpumpai_history'], (data) => {
      if (data.solpumpai_history && data.solpumpai_history.length > 1000) {
        // Keep only last 1000 games
        const trimmed = data.solpumpai_history.slice(-1000);
        chrome.storage.local.set({ solpumpai_history: trimmed });
        console.log('[SolPumpAI] Cleaned up old game history');
      }
    });
  }
});
