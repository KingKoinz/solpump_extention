// ai-predictor.js - FREE machine learning using TensorFlow.js
// This runs entirely in your browser - NO COSTS, NO API KEYS

class CrashAIPredictor {
  constructor() {
    this.model = null;
    this.isTraining = false;
    this.isTrained = false;
    this.minTrainingData = 100; // Need at least 100 games
    
    // Load TensorFlow.js from CDN (free)
    this.loadTensorFlow();
  }

  async loadTensorFlow() {
    // Load TensorFlow.js library
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.11.0/dist/tf.min.js';
    script.onload = () => {
      console.log('[AI] ✅ TensorFlow.js loaded (FREE)');
      this.initializeModel();
    };
    document.head.appendChild(script);
  }

  async initializeModel() {
    if (typeof tf === 'undefined') {
      console.log('[AI] ⏳ Waiting for TensorFlow...');
      setTimeout(() => this.initializeModel(), 1000);
      return;
    }

    console.log('[AI] 🧠 Creating neural network...');
    
    // Create a simple feedforward neural network
    this.model = tf.sequential({
      layers: [
        // Input: last 20 crash results + statistics
        tf.layers.dense({
          inputShape: [25], // 20 crashes + 5 features
          units: 64,
          activation: 'relu',
          kernelInitializer: 'heNormal'
        }),
        tf.layers.dropout({ rate: 0.3 }),
        
        tf.layers.dense({
          units: 32,
          activation: 'relu',
          kernelInitializer: 'heNormal'
        }),
        tf.layers.dropout({ rate: 0.2 }),
        
        tf.layers.dense({
          units: 16,
          activation: 'relu'
        }),
        
        // Output: 3 classes (low, medium, high multiplier)
        tf.layers.dense({
          units: 3,
          activation: 'softmax'
        })
      ]
    });

    // Compile the model
    this.model.compile({
      optimizer: tf.train.adam(0.001),
      loss: 'categoricalCrossentropy',
      metrics: ['accuracy']
    });

    console.log('[AI] ✅ Neural network ready!');
    
    // Try to load previously trained model
    await this.loadSavedModel();
  }

  // Prepare input features from crash history
  prepareFeatures(crashHistory) {
    if (crashHistory.length < 20) return null;

    const recent20 = crashHistory.slice(-20);
    const features = [];

    // Feature 1-20: Last 20 crash multipliers (normalized)
    recent20.forEach(crash => {
      features.push(Math.min(crash.multiplier / 10, 1)); // Normalize to 0-1
    });

    // Feature 21: Average of last 10
    const recent10 = recent20.slice(-10);
    const avg10 = recent10.reduce((a, b) => a + b.multiplier, 0) / 10;
    features.push(Math.min(avg10 / 5, 1));

    // Feature 22: Volatility
    const mean = recent20.reduce((a, b) => a + b.multiplier, 0) / 20;
    const variance = recent20.reduce((a, b) => a + Math.pow(b.multiplier - mean, 2), 0) / 20;
    const volatility = Math.sqrt(variance);
    features.push(Math.min(volatility / 3, 1));

    // Feature 23: Trend (slope)
    const trend = this.calculateTrend(recent20.map(c => c.multiplier));
    features.push(Math.max(-1, Math.min(1, trend)));

    // Feature 24: High multiplier rate (>2x in last 10)
    const highRate = recent10.filter(c => c.multiplier >= 2.0).length / 10;
    features.push(highRate);

    // Feature 25: Consecutive low crashes
    let consecutive = 0;
    for (let i = recent20.length - 1; i >= 0; i--) {
      if (recent20[i].multiplier < 1.5) consecutive++;
      else break;
    }
    features.push(Math.min(consecutive / 5, 1));

    return features;
  }

  calculateTrend(values) {
    const n = values.length;
    const x = Array.from({ length: n }, (_, i) => i);
    const sumX = x.reduce((a, b) => a + b, 0);
    const sumY = values.reduce((a, b) => a + b, 0);
    const sumXY = x.reduce((a, i) => a + i * values[i], 0);
    const sumX2 = x.reduce((a, i) => a + i * i, 0);
    return (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
  }

  // Classify crash result for training
  classifyResult(multiplier) {
    // 3 classes:
    // 0: Low (< 1.5x)
    // 1: Medium (1.5x - 2.5x)
    // 2: High (> 2.5x)
    
    if (multiplier < 1.5) return [1, 0, 0];
    if (multiplier < 2.5) return [0, 1, 0];
    return [0, 0, 1];
  }

  async train(crashHistory) {
    if (!this.model || this.isTraining) return;
    if (crashHistory.length < this.minTrainingData) {
      console.log(`[AI] ⏳ Need ${this.minTrainingData} games, have ${crashHistory.length}`);
      return;
    }

    console.log('[AI] 🎓 Training on', crashHistory.length, 'games...');
    this.isTraining = true;

    const xs = [];
    const ys = [];

    // Prepare training data
    for (let i = 20; i < crashHistory.length; i++) {
      const features = this.prepareFeatures(crashHistory.slice(0, i));
      if (!features) continue;

      const label = this.classifyResult(crashHistory[i].multiplier);
      
      xs.push(features);
      ys.push(label);
    }

    if (xs.length < 50) {
      console.log('[AI] ⚠️ Not enough training samples');
      this.isTraining = false;
      return;
    }

    const xsTensor = tf.tensor2d(xs);
    const ysTensor = tf.tensor2d(ys);

    try {
      // Train the model
      const history = await this.model.fit(xsTensor, ysTensor, {
        epochs: 30,
        batchSize: 16,
        validationSplit: 0.2,
        shuffle: true,
        verbose: 0,
        callbacks: {
          onEpochEnd: (epoch, logs) => {
            if (epoch % 5 === 0) {
              console.log(`[AI] Epoch ${epoch}: accuracy=${(logs.acc * 100).toFixed(1)}%`);
            }
          }
        }
      });

      const finalAccuracy = history.history.acc[history.history.acc.length - 1];
      console.log(`[AI] ✅ Training complete! Accuracy: ${(finalAccuracy * 100).toFixed(1)}%`);
      
      this.isTrained = true;
      await this.saveModel();
      
    } catch (error) {
      console.error('[AI] ❌ Training failed:', error);
    } finally {
      xsTensor.dispose();
      ysTensor.dispose();
      this.isTraining = false;
    }
  }

  async predict(crashHistory) {
    if (!this.model || !this.isTrained) {
      return this.getFallbackPrediction(crashHistory);
    }

    const features = this.prepareFeatures(crashHistory);
    if (!features) return null;

    try {
      const input = tf.tensor2d([features]);
      const prediction = this.model.predict(input);
      const probabilities = await prediction.data();
      
      input.dispose();
      prediction.dispose();

      return {
        probLow: probabilities[0],      // < 1.5x
        probMedium: probabilities[1],   // 1.5-2.5x
        probHigh: probabilities[2],     // > 2.5x
        confidence: Math.max(...probabilities),
        recommendation: this.getRecommendation(probabilities),
        type: 'AI_NEURAL_NETWORK'
      };
    } catch (error) {
      console.error('[AI] ❌ Prediction failed:', error);
      return this.getFallbackPrediction(crashHistory);
    }
  }

  getRecommendation(probabilities) {
    const [probLow, probMedium, probHigh] = probabilities;

    // High confidence for high multiplier
    if (probHigh > 0.5) {
      return {
        action: 'BET',
        target: 2.5,
        confidence: 'HIGH',
        reason: `AI predicts ${(probHigh * 100).toFixed(0)}% chance of >2.5x`
      };
    }

    // Medium confidence for medium multiplier
    if (probMedium > 0.4) {
      return {
        action: 'BET',
        target: 1.8,
        confidence: 'MEDIUM',
        reason: `AI predicts ${(probMedium * 100).toFixed(0)}% chance of 1.5-2.5x`
      };
    }

    // Combined probability for >1.5x
    const prob_above_1_5 = probMedium + probHigh;
    if (prob_above_1_5 > 0.6) {
      return {
        action: 'BET',
        target: 1.5,
        confidence: 'LOW',
        reason: `AI predicts ${(prob_above_1_5 * 100).toFixed(0)}% chance of >1.5x`
      };
    }

    return {
      action: 'WAIT',
      target: null,
      confidence: 'NONE',
      reason: `AI predicts ${(probLow * 100).toFixed(0)}% chance of low crash`
    };
  }

  getFallbackPrediction(crashHistory) {
    // Simple statistical fallback if AI not ready
    const recent10 = crashHistory.slice(-10);
    const above2x = recent10.filter(c => c.multiplier >= 2.0).length;
    const rate = above2x / 10;

    return {
      probLow: 1 - rate,
      probMedium: rate * 0.6,
      probHigh: rate * 0.4,
      confidence: rate,
      recommendation: {
        action: rate > 0.4 ? 'BET' : 'WAIT',
        target: rate > 0.5 ? 2.0 : 1.5,
        confidence: rate > 0.6 ? 'HIGH' : rate > 0.4 ? 'MEDIUM' : 'LOW',
        reason: 'Using statistical analysis (AI not trained yet)'
      },
      type: 'STATISTICAL_FALLBACK'
    };
  }

  async saveModel() {
    try {
      await this.model.save('localstorage://crash-predictor');
      console.log('[AI] 💾 Model saved to browser storage');
    } catch (error) {
      console.error('[AI] ⚠️ Could not save model:', error);
    }
  }

  async loadSavedModel() {
    try {
      const loadedModel = await tf.loadLayersModel('localstorage://crash-predictor');
      this.model = loadedModel;
      this.isTrained = true;
      console.log('[AI] 📂 Loaded previously trained model');
    } catch (error) {
      console.log('[AI] 💡 No saved model found - will train on new data');
    }
  }

  getStatus() {
    return {
      ready: this.model !== null,
      trained: this.isTrained,
      training: this.isTraining,
      type: 'TensorFlow.js (FREE)',
      cost: '$0.00'
    };
  }
}

// Initialize AI predictor
console.log('[AI] 🤖 Initializing FREE AI predictor...');
const aiPredictor = new CrashAIPredictor();

// Auto-train when enough data is available
chrome.storage.local.get(['allResults'], (data) => {
  if (data.allResults && data.allResults.length >= 100) {
    console.log('[AI] 📊 Found historical data, training AI...');
    setTimeout(() => {
      aiPredictor.train(data.allResults);
    }, 3000); // Wait 3 seconds for page to load
  }
});
