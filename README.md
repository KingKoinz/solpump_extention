# SolPumpAI Analyzer 🎠

AI-powered Chrome extension for analyzing game patterns on Solpump.io, powered by $SolPumpAI tokens

## Features

### 🤖 Pattern Detection
- Real-time monitoring of crash multipliers
- Statistical analysis of game outcomes
- Hot streak detection for 1.5x+ and 2.0x+ targets
- Trend analysis and volatility tracking

### 📊 Smart Recommendations
- AI-driven betting suggestions with confidence levels
- High/Medium/Low confidence scoring
- Probability calculations for 1.5x+ and 2.0x+ outcomes
- Pattern-based alerts

### 🔔 Notifications
- Desktop notifications for high-confidence opportunities
- Browser badge indicators showing current recommendation strength
- Real-time pattern alerts

### 📈 Analytics Dashboard
- Live statistics for last 10, 20, and 50 games
- Historical tracking of all crash results
- Volatility and trend analysis
- Visual confidence indicators

## Installation

1. **Download the Extension**
   - Clone or download this repository
   - Or create the files manually in a folder

2. **Install in Chrome**
   - Open Chrome and go to `chrome://extensions/`
   - Enable "Developer mode" (toggle in top right)
   - Click "Load unpacked"
   - Select the `solpump-analyzer` folder

3. **Grant Permissions**
   - The extension will request permission to access solpump.io
   - Allow notifications for alerts

## Usage

### Getting Started

1. Navigate to https://solpump.io
2. Click the extension icon in your toolbar
3. The extension will automatically start monitoring crash results

### Understanding the Interface

**Prediction Tab:**
- Shows current betting recommendation (BET or WAIT)
- Displays confidence level (HIGH, MEDIUM, LOW, NONE)
- Lists reasons for the recommendation
- Shows probability percentages for 1.5x+ and 2.0x+

**Statistics Tab:**
- Last 10 games: Quick snapshot of recent performance
- Last 50 games: Broader trend analysis with volatility
- All time: Total games tracked

**History Tab:**
- Recent crash results with timestamps
- Color-coded multipliers (green=high, orange=medium, red=low)
- Clear data option

### Confidence Levels Explained

- **🔥 HIGH (Red)**: Strong pattern detected, 60%+ probability for target
- **⚡ MEDIUM (Orange)**: Good opportunity, 40-60% probability
- **💡 LOW (Green)**: Weak signal, 30-40% probability
- **WAIT (Gray)**: No favorable pattern detected

## How It Works

### Pattern Detection Algorithm

The extension uses multiple analysis methods:

1. **Frequency Analysis**
   - Tracks hit rates for different multiplier thresholds
   - Calculates rolling averages over 10, 20, and 50 game windows

2. **Trend Detection**
   - Linear regression to identify upward/downward trends
   - Volatility measurement using standard deviation

3. **Streak Identification**
   - Detects consecutive high multipliers
   - Identifies "hot" and "cold" periods

4. **Scoring System**
   - Combines multiple signals into a confidence score
   - Weighs recent performance more heavily
   - Considers mean reversion after cold streaks

### Data Collection

- **WebSocket Interception**: Captures real-time game results
- **DOM Monitoring**: Fallback method for result detection
- **API Parsing**: Reads historical data from REST endpoints
- **Persistent Storage**: Keeps up to 10,000 historical results

## Important Disclaimers

⚠️ **This tool is for EDUCATIONAL and RESEARCH purposes only**

- Crash games use provably fair algorithms designed to be unpredictable
- Past results DO NOT guarantee future outcomes
- Pattern detection may provide insights but CANNOT predict random events
- The house always has an edge over time
- Never bet more than you can afford to lose

## Limitations

- Requires active Solpump.io tab to monitor
- Pattern detection is based on statistical analysis, not true prediction
- WebSocket format may change, breaking automatic detection
- Chrome must allow notifications for alerts to work

## Technical Details

### File Structure
```
solpump-analyzer/
├── manifest.json       # Extension configuration
├── content.js          # Main monitoring script
├── injected.js         # WebSocket interception
├── background.js       # Service worker for notifications
├── popup.html          # UI interface
├── popup.js            # UI logic
├── icon16.png          # Extension icons
├── icon48.png
└── icon128.png
```

### Data Storage
- Uses Chrome's `chrome.storage.local` API
- Stores up to 10,000 historical crash results
- Automatic cleanup of old data every 60 minutes

### Performance
- Lightweight: <100KB total size
- No external dependencies
- Runs entirely in browser
- Minimal CPU/memory usage

## Future Enhancements

Potential additions for future versions:

- [ ] TensorFlow.js neural network for ML-based predictions
- [ ] Export data to CSV for external analysis
- [ ] Customizable alert thresholds
- [ ] Auto-bet functionality (risky!)
- [ ] Multi-site support
- [ ] Advanced charting and visualization
- [ ] Bankroll management recommendations

## Troubleshooting

### Extension not detecting crashes
1. Ensure you're on solpump.io
2. Reload the page
3. Check browser console for errors (F12)
4. Reinstall extension if needed

### No notifications appearing
1. Check Chrome notification permissions
2. Enable notifications in extension settings
3. Check if "Do Not Disturb" is enabled

### Stats not updating
1. Refresh the popup
2. Ensure page is actively running games
3. Clear extension data and restart

## Development

To modify or enhance the extension:

1. Edit source files in the extension folder
2. Go to `chrome://extensions/`
3. Click the refresh icon on the extension card
4. Reload any active Solpump tabs

### Adding Features

The codebase is modular:
- Pattern detection: Modify `detectPatterns()` in content.js
- Prediction logic: Update `makePrediction()` in content.js  
- UI: Edit popup.html and popup.js
- Notifications: Customize background.js

## License

MIT License - Free to use, modify, and distribute

## Disclaimer

This software is provided "as is" without warranty. Use at your own risk. The developers are not responsible for any financial losses incurred while using this tool.

---

**Remember**: Gambling should be for entertainment only. If you or someone you know has a gambling problem, please seek help at:
- National Problem Gambling Helpline: 1-800-522-4700
- https://www.ncpgambling.org/
