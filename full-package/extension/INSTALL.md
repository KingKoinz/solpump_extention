# Quick Installation Guide

## Step 1: Get the Extension Files
You should have a folder called `solpump-analyzer` with these files:
- manifest.json
- content.js
- injected.js
- background.js
- popup.html
- popup.js
- icon16.png
- icon48.png
- icon128.png
- README.md

## Step 2: Install in Chrome

1. Open Google Chrome

2. Type `chrome://extensions/` in the address bar and press Enter

3. Enable "Developer mode"
   - Look for a toggle switch in the top-right corner
   - Turn it ON

4. Click "Load unpacked"
   - A file browser will open
   - Navigate to and select the `solpump-analyzer` folder
   - Click "Select Folder"

5. The extension should now appear in your list!

## Step 3: Test It

1. Navigate to https://solpump.io

2. Click the extension icon in your Chrome toolbar
   - If you don't see it, click the puzzle piece icon and pin it

3. Start playing crash games on Solpump

4. Watch the extension collect data and make predictions!

## Troubleshooting

**"Manifest file is missing or unreadable"**
- Make sure all files are in the same folder
- Check that manifest.json exists and is valid

**Extension icon is grayed out**
- You must be on solpump.io for it to work
- The extension only activates on that site

**No data showing up**
- Play a few crash games first
- The extension needs at least 10 games to start making predictions
- Refresh the popup to see updates

**Notifications not working**
- Check Chrome's notification settings
- Make sure notifications are allowed for the extension

## Getting Updates

When new features are added:
1. Download the updated files
2. Go to `chrome://extensions/`
3. Click the refresh icon on the extension card
4. Reload any open Solpump tabs

## Need Help?

Check the README.md file for:
- Detailed feature explanations
- How the algorithm works
- Advanced troubleshooting
- Development information

---

Enjoy using SolPumpAI Analyzer! 🎠📊
