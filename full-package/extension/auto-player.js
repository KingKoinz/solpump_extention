// auto-player.js - Automated betting bot for Solpump
class SolpumpAutoPlayer {
  constructor() {
    this.enabled = false;
    this.settings = {
      betAmount: 0.01,        // How much SOL to bet each round
      targetMultiplier: 2.0,  // When to cash out (2x = double your money)
      maxLoss: 0.1,           // Stop if you lose this much SOL total
      maxWin: 0.5,            // Stop if you win this much SOL total
      strategy: 'CONSERVATIVE' // CONSERVATIVE, MODERATE, AGGRESSIVE
    };
    
    this.stats = {
      gamesPlayed: 0,
      wins: 0,
      losses: 0,
      totalBet: 0,
      totalWon: 0,
      profit: 0,
      currentStreak: 0
    };
    
    this.isPlaying = false;
    this.currentGame = null;
  }

  // Start the auto-player
  start() {
    console.log('[AutoPlayer] 🤖 Starting automated betting...');
    this.enabled = true;
    this.waitForNextGame();
  }

  // Stop the auto-player
  stop() {
    console.log('[AutoPlayer] ⏹️ Stopping automated betting...');
    this.enabled = false;
    this.isPlaying = false;
  }

  // Wait for a new game to start
  waitForNextGame() {
    if (!this.enabled) return;

    // Check if we hit stop-loss or take-profit
    if (this.shouldStop()) {
      this.stop();
      this.showResults();
      return;
    }

    console.log('[AutoPlayer] ⏳ Waiting for next game...');
    
    // Poll for game state
    const checkInterval = setInterval(() => {
      if (!this.enabled) {
        clearInterval(checkInterval);
        return;
      }

      const gameState = this.detectGameState();
      
      if (gameState === 'BETTING_OPEN') {
        clearInterval(checkInterval);
        this.placeBet();
      }
    }, 100); // Check every 100ms
  }

  // Detect current game state by reading the page
  detectGameState() {
    // Look for common UI elements that indicate game state
    
    // Method 1: Check for "Place Bet" button
    const betButton = this.findBetButton();
    if (betButton && !betButton.disabled) {
      return 'BETTING_OPEN';
    }

    // Method 2: Check for "Crashed at X.XX" text
    const crashedText = document.body.textContent;
    if (crashedText.includes('Crashed') || crashedText.includes('crashed')) {
      return 'GAME_ENDED';
    }

    // Method 3: Check for rising multiplier
    const multiplier = this.getCurrentMultiplier();
    if (multiplier > 1.0) {
      return 'GAME_RUNNING';
    }

    return 'WAITING';
  }

  // Find the bet button on the page
  findBetButton() {
    // Try common selectors
    const selectors = [
      'button[class*="bet"]',
      'button:contains("Bet")',
      'button:contains("Place")',
      '.bet-button',
      '#bet-button',
      'button[type="submit"]'
    ];

    for (const selector of selectors) {
      const button = document.querySelector(selector);
      if (button && button.textContent.toLowerCase().includes('bet')) {
        return button;
      }
    }

    // Fallback: find any button with "bet" in text
    const buttons = document.querySelectorAll('button');
    for (const button of buttons) {
      if (button.textContent.toLowerCase().includes('bet') || 
          button.textContent.toLowerCase().includes('place')) {
        return button;
      }
    }

    return null;
  }

  // Find the bet amount input field
  findBetInput() {
    const selectors = [
      'input[type="number"]',
      'input[placeholder*="amount"]',
      'input[placeholder*="bet"]',
      '.bet-input',
      '#bet-amount'
    ];

    for (const selector of selectors) {
      const input = document.querySelector(selector);
      if (input) return input;
    }

    return null;
  }

  // Find the cashout button
  findCashoutButton() {
    const selectors = [
      'button[class*="cashout"]',
      'button:contains("Cash")',
      '.cashout-button',
      '#cashout'
    ];

    for (const selector of selectors) {
      const button = document.querySelector(selector);
      if (button && button.textContent.toLowerCase().includes('cash')) {
        return button;
      }
    }

    const buttons = document.querySelectorAll('button');
    for (const button of buttons) {
      if (button.textContent.toLowerCase().includes('cash')) {
        return button;
      }
    }

    return null;
  }

  // Get current multiplier from the page
  getCurrentMultiplier() {
    // Look for numbers followed by 'x'
    const text = document.body.textContent;
    const matches = text.match(/(\d+\.?\d*)x/g);
    
    if (matches && matches.length > 0) {
      // Get the largest number (likely the current multiplier)
      const multipliers = matches.map(m => parseFloat(m.replace('x', '')));
      return Math.max(...multipliers);
    }

    return 0;
  }

  // Place a bet
  async placeBet() {
    if (!this.enabled || this.isPlaying) return;

    console.log(`[AutoPlayer] 💰 Placing bet: ${this.settings.betAmount} SOL`);
    
    this.isPlaying = true;
    this.currentGame = {
      betAmount: this.settings.betAmount,
      targetMultiplier: this.settings.targetMultiplier,
      startTime: Date.now()
    };

    try {
      // Step 1: Set bet amount
      const betInput = this.findBetInput();
      if (betInput) {
        betInput.value = this.settings.betAmount;
        betInput.dispatchEvent(new Event('input', { bubbles: true }));
        betInput.dispatchEvent(new Event('change', { bubbles: true }));
        await this.sleep(100);
      }

      // Step 2: Click bet button
      const betButton = this.findBetButton();
      if (betButton) {
        betButton.click();
        console.log('[AutoPlayer] ✅ Bet placed!');
        
        // Wait for game to start
        await this.sleep(500);
        
        // Monitor for cashout
        this.monitorForCashout();
      } else {
        console.log('[AutoPlayer] ❌ Could not find bet button');
        this.isPlaying = false;
        this.waitForNextGame();
      }
    } catch (error) {
      console.error('[AutoPlayer] ❌ Error placing bet:', error);
      this.isPlaying = false;
      this.waitForNextGame();
    }
  }

  // Monitor the game and cashout at target multiplier
  monitorForCashout() {
    console.log(`[AutoPlayer] 👀 Monitoring for ${this.settings.targetMultiplier}x...`);
    
    const checkInterval = setInterval(() => {
      if (!this.enabled || !this.isPlaying) {
        clearInterval(checkInterval);
        return;
      }

      const currentMultiplier = this.getCurrentMultiplier();

      // Check if we hit our target
      if (currentMultiplier >= this.settings.targetMultiplier) {
        clearInterval(checkInterval);
        this.cashout(currentMultiplier);
        return;
      }

      // Check if game crashed before we could cashout
      if (this.detectGameState() === 'GAME_ENDED') {
        clearInterval(checkInterval);
        this.handleLoss();
        return;
      }

      // Safety timeout (30 seconds max)
      if (Date.now() - this.currentGame.startTime > 30000) {
        clearInterval(checkInterval);
        console.log('[AutoPlayer] ⏱️ Timeout - forcing cashout');
        this.cashout(currentMultiplier);
      }
    }, 50); // Check every 50ms for quick reaction
  }

  // Execute cashout
  async cashout(multiplier) {
    console.log(`[AutoPlayer] 💸 Cashing out at ${multiplier.toFixed(2)}x`);
    
    const cashoutButton = this.findCashoutButton();
    if (cashoutButton && !cashoutButton.disabled) {
      cashoutButton.click();
      
      const winAmount = this.currentGame.betAmount * multiplier;
      this.recordWin(winAmount, multiplier);
      
      console.log(`[AutoPlayer] ✅ WIN! +${winAmount.toFixed(4)} SOL`);
    } else {
      console.log('[AutoPlayer] ⚠️ Could not cashout - button not found');
      this.handleLoss();
    }

    this.isPlaying = false;
    await this.sleep(2000); // Wait 2 seconds before next game
    this.waitForNextGame();
  }

  // Handle when we lose (game crashed before cashout)
  handleLoss() {
    console.log(`[AutoPlayer] ❌ LOSS - Game crashed before ${this.settings.targetMultiplier}x`);
    
    this.recordLoss(this.currentGame.betAmount);
    
    this.isPlaying = false;
    this.sleep(2000).then(() => this.waitForNextGame());
  }

  // Record a win
  recordWin(amount, multiplier) {
    this.stats.gamesPlayed++;
    this.stats.wins++;
    this.stats.totalWon += amount;
    this.stats.profit = this.stats.totalWon - this.stats.totalBet;
    this.stats.currentStreak++;

    this.updateUI();
    this.saveStats();
  }

  // Record a loss
  recordLoss(amount) {
    this.stats.gamesPlayed++;
    this.stats.losses++;
    this.stats.totalBet += amount;
    this.stats.profit = this.stats.totalWon - this.stats.totalBet;
    this.stats.currentStreak = 0;

    this.updateUI();
    this.saveStats();
  }

  // Check if we should stop (hit limits)
  shouldStop() {
    // Stop on max loss
    if (this.stats.profit <= -this.settings.maxLoss) {
      console.log(`[AutoPlayer] 🛑 Stop loss hit: ${this.stats.profit.toFixed(4)} SOL`);
      return true;
    }

    // Stop on max win
    if (this.stats.profit >= this.settings.maxWin) {
      console.log(`[AutoPlayer] 🎉 Take profit hit: ${this.stats.profit.toFixed(4)} SOL`);
      return true;
    }

    return false;
  }

  // Show final results
  showResults() {
    const winRate = (this.stats.wins / this.stats.gamesPlayed * 100).toFixed(1);
    
    console.log('\n' + '='.repeat(50));
    console.log('🤖 AUTO-PLAYER SESSION RESULTS');
    console.log('='.repeat(50));
    console.log(`Games Played: ${this.stats.gamesPlayed}`);
    console.log(`Wins: ${this.stats.wins} (${winRate}%)`);
    console.log(`Losses: ${this.stats.losses}`);
    console.log(`Total Bet: ${this.stats.totalBet.toFixed(4)} SOL`);
    console.log(`Total Won: ${this.stats.totalWon.toFixed(4)} SOL`);
    console.log(`Profit/Loss: ${this.stats.profit.toFixed(4)} SOL`);
    console.log('='.repeat(50));

    alert(`Auto-Player Stopped!\n\nProfit/Loss: ${this.stats.profit.toFixed(4)} SOL\nWin Rate: ${winRate}%`);
  }

  // Update UI to show stats
  updateUI() {
    // Send message to extension popup to update display
    chrome.runtime.sendMessage({
      action: 'autoPlayerStats',
      stats: this.stats
    });
  }

  // Save stats to storage
  saveStats() {
    chrome.storage.local.set({ autoPlayerStats: this.stats });
  }

  // Helper: sleep function
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Configure settings
  configure(settings) {
    this.settings = { ...this.settings, ...settings };
    console.log('[AutoPlayer] ⚙️ Settings updated:', this.settings);
  }
}

// Initialize auto-player
const autoPlayer = new SolpumpAutoPlayer();

// Listen for commands from popup
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action === 'startAutoPlay') {
    autoPlayer.configure(msg.settings);
    autoPlayer.start();
    sendResponse({ success: true });
  } else if (msg.action === 'stopAutoPlay') {
    autoPlayer.stop();
    sendResponse({ success: true });
  } else if (msg.action === 'getAutoPlayerStats') {
    sendResponse({ success: true, stats: autoPlayer.stats });
  }
});

console.log('[AutoPlayer] 🤖 Auto-player loaded and ready');
