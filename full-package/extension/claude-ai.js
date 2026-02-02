// claude-ai.js - Claude API integration with smart model routing
class ClaudeAIAnalyzer {
  constructor() {
    this.apiKey = null;
    this.baseURL = 'https://api.anthropic.com/v1/messages';
    this.models = {
      fast: 'claude-haiku-4-5-20251001',      // Cheap & fast
      smart: 'claude-sonnet-4-5-20250929',    // Balanced
      deep: 'claude-opus-4-5-20251101'        // Expensive but best
    };
    
    this.usage = {
      totalCalls: 0,
      totalCost: 0,
      callsByModel: {
        fast: 0,
        smart: 0,
        deep: 0
      }
    };
    
    this.loadSettings();
  }

  loadSettings() {
    chrome.storage.local.get(['claudeApiKey', 'claudeUsage'], (data) => {
      if (data.claudeApiKey) {
        this.apiKey = data.claudeApiKey;
        console.log('[Claude AI] ✅ API key loaded');
      }
      if (data.claudeUsage) {
        this.usage = data.claudeUsage;
      }
    });
  }

  saveUsage() {
    chrome.storage.local.set({ claudeUsage: this.usage });
  }

  setApiKey(key) {
    this.apiKey = key;
    chrome.storage.local.set({ claudeApiKey: key });
    console.log('[Claude AI] 🔑 API key saved');
  }

  // Smart model selection based on context
  selectModel(context) {
    const { gamesPlayed, suspiciousActivity, forceDeep } = context;

    // Force deep analysis if requested
    if (forceDeep) {
      return { model: this.models.deep, reason: 'User requested deep dive' };
    }

    // Use Opus for suspicious patterns
    if (suspiciousActivity) {
      return { model: this.models.deep, reason: 'Suspicious activity detected' };
    }

    // Use Sonnet every 10 games for validation
    if (gamesPlayed % 10 === 0) {
      return { model: this.models.smart, reason: 'Periodic validation check' };
    }

    // Default: Use Haiku (cheapest)
    return { model: this.models.fast, reason: 'Standard analysis' };
  }

  // Main analysis function
  async analyze(crashHistory, options = {}) {
    if (!this.apiKey) {
      console.error('[Claude AI] ❌ No API key set');
      return { error: 'API key not configured' };
    }

    const modelSelection = this.selectModel({
      gamesPlayed: crashHistory.length,
      suspiciousActivity: options.suspicious || false,
      forceDeep: options.forceDeep || false
    });

    console.log(`[Claude AI] 🤖 Using ${modelSelection.model} - ${modelSelection.reason}`);

    const prompt = this.buildPrompt(crashHistory, options);
    
    try {
      const response = await this.callClaudeAPI(modelSelection.model, prompt);
      const analysis = this.parseResponse(response);
      
      // Track usage
      this.trackUsage(modelSelection.model, response);
      
      return {
        ...analysis,
        modelUsed: modelSelection.model,
        cost: this.estimateCost(response, modelSelection.model)
      };
    } catch (error) {
      console.error('[Claude AI] ❌ Analysis failed:', error);
      return { error: error.message };
    }
  }

  buildPrompt(crashHistory, options) {
    const recent50 = crashHistory.slice(-50);
    const recent20 = crashHistory.slice(-20);
    const recent10 = crashHistory.slice(-10);

    const dataString = recent50.map(r => r.multiplier.toFixed(2)).join(', ');

    let prompt = `You are analyzing crash game results from Solpump casino to detect patterns and make betting predictions.

## Recent Crash Data (last 50 games):
${dataString}

## Quick Stats:
- Last 10 average: ${(recent10.reduce((a,b) => a + b.multiplier, 0) / 10).toFixed(2)}x
- Last 20 average: ${(recent20.reduce((a,b) => a + b.multiplier, 0) / 20).toFixed(2)}x
- Games >2x in last 10: ${recent10.filter(r => r.multiplier >= 2).length}
- Games >1.5x in last 10: ${recent10.filter(r => r.multiplier >= 1.5).length}

## Your Task:
Analyze this data and provide:

1. **Pattern Detection**: Any exploitable patterns, streaks, or anomalies?
2. **Statistical Analysis**: Probability of next crash being >2x and >1.5x
3. **Betting Recommendation**: Should bet now? What target multiplier?
4. **Risk Assessment**: Confidence level (HIGH/MEDIUM/LOW)
5. **Reasoning**: Why this recommendation?

${options.suspicious ? '\n⚠️ IMPORTANT: There are signs of potential manipulation. Check if results seem rigged or if visible "big wins" are fake.\n' : ''}

Respond in JSON format:
{
  "shouldBet": true/false,
  "targetMultiplier": 1.5 or 2.0 or 2.5,
  "confidence": "HIGH"/"MEDIUM"/"LOW"/"NONE",
  "probability2x": 0.0-1.0,
  "probability1_5x": 0.0-1.0,
  "detectedPatterns": ["pattern1", "pattern2"],
  "reasoning": "clear explanation",
  "suspiciousActivity": "none" or "description of manipulation"
}`;

    return prompt;
  }

  async callClaudeAPI(model, prompt) {
    const response = await fetch(this.baseURL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: model,
        max_tokens: 1000,
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ]
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || 'API call failed');
    }

    return await response.json();
  }

  parseResponse(response) {
    try {
      const content = response.content[0].text;
      
      // Extract JSON from response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        
        return {
          shouldBet: parsed.shouldBet,
          targetMultiplier: parsed.targetMultiplier,
          confidence: parsed.confidence,
          probability2x: parsed.probability2x,
          probability1_5x: parsed.probability1_5x,
          patterns: parsed.detectedPatterns || [],
          reasoning: parsed.reasoning,
          suspicious: parsed.suspiciousActivity,
          rawResponse: content
        };
      }
    } catch (error) {
      console.error('[Claude AI] ❌ Failed to parse response:', error);
    }

    return { error: 'Failed to parse AI response' };
  }

  trackUsage(model, response) {
    this.usage.totalCalls++;
    
    // Determine which model category
    let modelType = 'fast';
    if (model.includes('sonnet')) modelType = 'smart';
    if (model.includes('opus')) modelType = 'deep';
    
    this.usage.callsByModel[modelType]++;
    
    // Estimate cost
    const cost = this.estimateCost(response, model);
    this.usage.totalCost += cost;
    
    this.saveUsage();
    
    console.log(`[Claude AI] 💰 Cost: $${cost.toFixed(4)} | Total: $${this.usage.totalCost.toFixed(2)}`);
  }

  estimateCost(response, model) {
    // Get token usage
    const inputTokens = response.usage?.input_tokens || 500;
    const outputTokens = response.usage?.output_tokens || 200;

    // Pricing per million tokens
    let inputCost, outputCost;
    
    if (model.includes('haiku')) {
      inputCost = 0.25;
      outputCost = 1.25;
    } else if (model.includes('sonnet')) {
      inputCost = 3;
      outputCost = 15;
    } else if (model.includes('opus')) {
      inputCost = 15;
      outputCost = 75;
    } else {
      return 0;
    }

    const cost = (inputTokens * inputCost / 1000000) + (outputTokens * outputCost / 1000000);
    return cost;
  }

  // Deep dive analysis (uses Opus)
  async deepDive(crashHistory, userBetHistory) {
    console.log('[Claude AI] 🔬 Running DEEP DIVE analysis...');
    
    const prompt = `You are a forensic analyst investigating potential manipulation in a crash gambling game.

## All Crash Results (last 100):
${crashHistory.slice(-100).map((r, i) => `${i+1}. ${r.multiplier.toFixed(2)}x`).join('\n')}

## User's Actual Bets:
${userBetHistory.map((b, i) => `${i+1}. Bet ${b.amount} SOL, Result: ${b.result}x, ${b.won ? 'WON' : 'LOST'} ${b.amount * b.result} SOL`).join('\n')}

## Investigation Tasks:

1. **Outcome Correlation**: Do crash results differ when user bets vs. when watching?
2. **Manipulation Detection**: Any signs of rigged outcomes or fake "big wins"?
3. **Player Profiling**: Is the user being targeted/throttled after winning?
4. **Statistical Anomalies**: Do results deviate from expected random distribution?
5. **Timing Patterns**: Do big multipliers happen at suspicious intervals?

Provide a DETAILED forensic report in JSON:
{
  "manipulationDetected": true/false,
  "confidence": "VERY_HIGH"/"HIGH"/"MEDIUM"/"LOW",
  "evidenceList": ["evidence1", "evidence2", ...],
  "outcomeCorrelation": {
    "whenBetting": "description",
    "whenWatching": "description",
    "differential": "percentage difference"
  },
  "recommendation": "STOP_PLAYING" or "CONTINUE_CAUTIOUSLY" or "NO_ISSUES_DETECTED",
  "detailedAnalysis": "comprehensive explanation",
  "actionItems": ["what user should do"]
}`;

    const response = await this.callClaudeAPI(this.models.deep, prompt);
    const analysis = this.parseResponse(response);
    
    console.log('[Claude AI] 🔬 Deep dive complete!');
    
    return {
      ...analysis,
      type: 'DEEP_DIVE',
      cost: this.estimateCost(response, this.models.deep)
    };
  }

  getUsageStats() {
    return {
      totalCalls: this.usage.totalCalls,
      totalCost: this.usage.totalCost.toFixed(4),
      breakdown: {
        haiku: this.usage.callsByModel.fast,
        sonnet: this.usage.callsByModel.smart,
        opus: this.usage.callsByModel.deep
      },
      averageCost: (this.usage.totalCost / this.usage.totalCalls).toFixed(4)
    };
  }

  resetUsage() {
    this.usage = {
      totalCalls: 0,
      totalCost: 0,
      callsByModel: { fast: 0, smart: 0, deep: 0 }
    };
    this.saveUsage();
  }
}

// Initialize Claude AI
const claudeAI = new ClaudeAIAnalyzer();

// Listen for commands
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action === 'setClaudeKey') {
    claudeAI.setApiKey(msg.apiKey);
    sendResponse({ success: true });
  } else if (msg.action === 'analyzeWithClaude') {
    claudeAI.analyze(msg.crashHistory, msg.options).then(result => {
      sendResponse({ success: true, analysis: result });
    });
    return true; // Keep channel open for async
  } else if (msg.action === 'deepDive') {
    claudeAI.deepDive(msg.crashHistory, msg.userBetHistory).then(result => {
      sendResponse({ success: true, analysis: result });
    });
    return true;
  } else if (msg.action === 'getClaudeUsage') {
    sendResponse({ success: true, usage: claudeAI.getUsageStats() });
  }
});

console.log('[Claude AI] 🤖 Claude API integration loaded');
