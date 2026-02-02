// injected.js - Runs in page context to intercept WebSocket
(function() {
  console.log('[SolPumpAI] Injected script loaded');

  // Shared message handler function
  function handleWebSocketMessage(event) {
    try {
      const messageText = event.data.toString();

      // Handle Socket.IO format: 42["eventName",{data}]
      if (messageText.startsWith('42["')) {
        // Extract event name and data from Socket.IO format
        const bracketEnd = messageText.indexOf('}', messageText.indexOf('{'));

        if (bracketEnd > 0) {
          try {
            // Find where the event name ends (between quotes after 42[")
            const eventEndQuote = messageText.indexOf('"', 4);
            if (eventEndQuote > 0) {
              const eventName = messageText.substring(4, eventEndQuote);

              // Extract JSON data starting after the comma
              const commaPos = messageText.indexOf(',', eventEndQuote);
              const closingBracket = messageText.lastIndexOf(']');

              if (commaPos > 0 && closingBracket > commaPos) {
                const dataStr = messageText.substring(commaPos + 1, closingBracket);

                // Only process crash-related events
                if (eventName.includes('crash')) {
                  try {
                    const data = JSON.parse(dataStr);

                    // Log crash events for debugging
                    if (eventName !== 'crash:heartbeat') {
                      // Extract all numeric fields for live multiplier detection
                      const numericFields = {};
                      for (const [key, value] of Object.entries(data)) {
                        if (typeof value === 'number' || (typeof value === 'string' && !isNaN(parseFloat(value)))) {
                          numericFields[key] = value;
                        }
                      }
                      console.log('[SolPumpAI] Crash event:', eventName, '| State:', data.state, '| Numeric fields:', JSON.stringify(numericFields));
                    }

                    // LIVE MULTIPLIER TRACKING: For crash:change events during gameplay
                    if (eventName === 'crash:change' && data.state && (data.state === 'in progress' || data.state === 'accepting bets' || data.state === 'starting onchain')) {
                      const potentialFields = ['currentMultiplier', 'liveMultiplier', 'multiplier', 'crashPoint', 'current', 'value', 'amount', 'coeff'];
                      for (const fieldName of potentialFields) {
                        if (data[fieldName] && typeof data[fieldName] === 'number' && data[fieldName] >= 1.0 && data[fieldName] <= 1000) {
                          const liveMultiplier = parseFloat(data[fieldName]);
                          console.log('[SolPumpAI] 📊 LIVE multiplier detected:', liveMultiplier, 'from field:', fieldName, 'state:', data.state);
                          window.postMessage({
                            type: 'GAME_STATE_UPDATE',
                            gameId: data.id,
                            liveMultiplier: liveMultiplier,
                            liveMultiplierField: fieldName,
                            state: data.state,
                            source: 'websocket_live'
                          }, '*');
                          break;
                        }
                      }
                    }

                    // Look for crash completion/result with multiplier
                    if (eventName === 'crash:result' || eventName === 'crash:completed' ||
                        eventName === 'crash:end' || eventName === 'crash:crash' ||
                        (eventName === 'crash:change' && (data.state === 'ended' || data.state === 'crashed' || data.state === 'completed'))) {

                      const multiplier = data.crashPoint || data.multiplier || data.bust || data.crash ||
                                       data.crashMultiplier || data.final_crash || data.finalCrash ||
                                       data.finalMultiplier || data.end_multiplier || data.result;

                      if (multiplier && !isNaN(multiplier) && multiplier >= 1.0 && multiplier <= 1000) {
                        console.log('[SolPumpAI] 🎯 Found crash multiplier:', multiplier, 'from', eventName);
                        window.postMessage({
                          type: 'CRASH_RESULT',
                          multiplier: parseFloat(multiplier),
                          gameId: data.id,
                          source: 'websocket_socketio'
                        }, '*');
                      }
                    }

                    // Bonus: Also extract crashPoint from crash:change events if it exists
                    if (eventName === 'crash:change' && data.crashPoint && !isNaN(data.crashPoint)) {
                      const multiplier = parseFloat(data.crashPoint);
                      if (multiplier >= 1.0 && multiplier <= 1000) {
                        console.log('[SolPumpAI] 🎯 Found crashPoint in', eventName, ':', multiplier);
                        window.postMessage({
                          type: 'CRASH_RESULT',
                          multiplier: multiplier,
                          gameId: data.id,
                          source: 'websocket_socketio_crashpoint'
                        }, '*');
                      }
                    }
                  } catch (parseErr) {
                    console.log('[SolPumpAI] Failed to parse Socket.IO JSON for', eventName, '- Data:', dataStr.substring(0, 100));
                  }
                }
              }
            }
          } catch (e) {
            console.log('[SolPumpAI] Error parsing Socket.IO message:', e.message);
          }
        }
        return; // Always return after attempting Socket.IO format
      }

      // Fallback: Try parsing as pure JSON for non-Socket.IO messages
      try {
        const data = JSON.parse(messageText);

        // Look for crash results in various possible formats
        if (data.type === 'crash' || data.event === 'crash_result' || data.result ||
            data.crash_point || data.multiplier || data.game_state === 'ended' ||
            data.crashPoint || data.crash || data.gameResult || data.outcome) {

          const multiplier = data.crashPoint || data.multiplier || data.result ||
                           data.crash || data.crash_point || data.gameResult ||
                           data.outcome || data.end_multiplier;

          if (multiplier && !isNaN(multiplier) && multiplier >= 1.0 && multiplier <= 1000) {
            console.log('[SolPumpAI] Found crash data (pure JSON):', { multiplier, eventType: data.type });
            window.postMessage({
              type: 'CRASH_RESULT',
              multiplier: parseFloat(multiplier),
              source: 'websocket_json'
            }, '*');
          }
        }
      } catch (jsonErr) {
        // Non-JSON message - just skip
      }

    } catch (e) {
      console.error('[SolPumpAI] Unexpected error in handleWebSocketMessage:', e.message);
    }
  }

  // Intercept WebSocket
  const OriginalWebSocket = window.WebSocket;

  window.WebSocket = function(...args) {
    const ws = new OriginalWebSocket(...args);

    console.log('[SolPumpAI] WebSocket connection:', args[0]);

    // Intercept onmessage property
    let messageHandler = null;
    Object.defineProperty(ws, 'onmessage', {
      get: function() {
        return messageHandler;
      },
      set: function(handler) {
        messageHandler = handler;
        const wrappedHandler = function(event) {
          console.log('[SolPumpAI] WebSocket message received (onmessage):', event.data.substring ? event.data.substring(0, 200) : event.data);
          handleWebSocketMessage(event);
          if (handler) return handler.apply(this, arguments);
        };
        const descriptor = Object.getOwnPropertyDescriptor(OriginalWebSocket.prototype, 'onmessage');
        if (descriptor && descriptor.set) {
          descriptor.set.call(ws, wrappedHandler);
        }
      }
    });

    // Intercept messages via addEventListener
    const originalAddEventListener = ws.addEventListener;
    ws.addEventListener = function(type, listener, ...rest) {
      if (type === 'message') {
        const wrappedListener = function(event) {
          console.log('[SolPumpAI] WebSocket message received (addEventListener):', event.data.substring ? event.data.substring(0, 200) : event.data);
          handleWebSocketMessage(event);
          return listener.apply(this, arguments);
        };
        return originalAddEventListener.call(this, type, wrappedListener, ...rest);
      }
      return originalAddEventListener.call(this, type, listener, ...rest);
    };

    return ws;
  };

  // Also intercept fetch for REST API calls
  const originalFetch = window.fetch;
  window.fetch = function(...args) {
    return originalFetch.apply(this, args).then(response => {
      const clonedResponse = response.clone();

      // Check if this looks like a game-related endpoint
      const url = typeof args[0] === 'string' ? args[0] : args[0].url;

      if (url.includes('crash') || url.includes('game') || url.includes('history')) {
        clonedResponse.json().then(data => {
          // Look for crash results
          if (data.history || data.results || data.games) {
            const results = data.history || data.results || data.games;
            if (Array.isArray(results)) {
              results.forEach(result => {
                const multiplier = result.crashPoint || result.multiplier || result.crash;
                if (multiplier) {
                  window.postMessage({
                    type: 'CRASH_RESULT',
                    multiplier: parseFloat(multiplier),
                    source: 'api'
                  }, '*');
                }
              });
            }
          }
        }).catch(() => {});
      }

      return response;
    });
  };

  console.log('[Solpump Analyzer] Interception active');
})();
