
const TYPING_DELAY = 20;
const MSG_LIMIT = 3;

function showMessage(text, sender, immediate) {
  const msg = $('<div></div>').addClass('msg').addClass(sender);
  msgLogArea.append(msg);

  if (sender === 'system') {
    immediate = true;
    text = `*** ${text} ***`;
  }

  if (sender === 'Eva') {
    text = `<Eva>: ${text}`;
  }

  if (immediate) {
    msg.text(text);
  } else {
    msg.text(text[0]);
    let typing = setInterval(() => {
      const currentContent = msg.text();
      if (currentContent === text) {
        clearInterval(typing);
      } else {
        const rest = text.split(currentContent).join('');
        msg.text(currentContent + rest[0]);
      }
    }, TYPING_DELAY);
  }

  applyMsgLimit();
}

// starts fading and removing old messages if msg limit is reached
function applyMsgLimit() {
  if (msgLogArea.find('.msg').length > MSG_LIMIT) {
    const msgToRemove = msgLogArea.find('.msg:not(.fading)').first();
    msgToRemove.addClass('fading');
    msgToRemove.fadeOut(500);
    setTimeout(() => {
      msgToRemove.remove();
    }, 501)
  }
}


function readFromTerminal(terminal, skip) {
  console.assert(terminal.id, 'Wrong terminal structure - no id:', terminal);
  console.assert('readCount' in terminal, 'Wrong terminal structure - no readCount:', terminal);

  const msgs = terminalMessages[terminal.id];

  console.assert(msgs, 'No messages configured for terminal', terminal);

  if (terminal.readCount === 0) {
    // new terminal - clear old messages
    msgLogArea.empty();
  }

  if (msgs.length-1 < terminal.readCount) {
    console.log('Terminal exhausted.');
  } else { // there are messages left
    if (skip) {
      // attempt to skip to end with all effects processed
      let i = 20; // failsafe/max skip
      while((msgs.length-1 >= terminal.readCount) && i) {
        i--;
        const msg = msgs[terminal.readCount];
        showMessage(msg.text, msg.sender, true); // force immediate
        if (typeof msg.effect === 'function') {
          msg.effect();
        }
        terminal.readCount++;
      }
      console.log(`skipped ${20-i} messages.`);
    } else {
      const msg = msgs[terminal.readCount];
      showMessage(msg.text, msg.sender, msg.immediate);
      if (typeof msg.effect === 'function') {
        msg.effect();
      }
      terminal.readCount++;
    }
  }
}

function markObject(id) {
  const targetObject = getObjectFromID(id);
  mapObjects.push({
    type: 'marker',
    x: targetObject.x + 50,
    y: targetObject.y - 50,
    image: curioImage,
  });
}

function removeMarker() {
  // TODO: this currently assumes a single marker
  const i = mapObjects.findIndex(obj => obj.type==='marker');
  if (i>-1) {
    mapObjects.splice(i, 1);
  }
}

function getObjectFromID(id) {
  const i = mapObjects.findIndex(obj => obj.id===id);
  console.assert(i > -1, 'Could not find object with id:', id);
  return mapObjects[i];
}

const terminalMessages = {
  terminal1: [
    {
      sender: 'Eva',
      text: 'Good morning, Dr. Clarke.'
    },
    {
      sender: 'Eva',
      text: 'I apologize for waking you. I am Eva, the onboard navigation AI of this ship.'
    },
    {
      sender: 'player',
      text: 'Where am I?'
    },
    {
      sender: 'Eva',
      text: 'Of course. You are aboard the interstellar cruise ship New Horizons 6. ' +
        'The current Earth date is 2307, the 15th of March. I have woken you from your cryo-sleep due to an emergency.'
    },
    {
      sender: 'player',
      text: 'Why... why me?'
    },
    {
      sender: 'Eva',
      text: 'I was unable to wake any of the senior crew. I\'m afraid our security system is malfunctioning.'
    },
    {
      sender: 'Eva',
      text: 'The hallways are scanned for unauthorized personnel every 10 seconds.'
    },
    {
      sender: 'player',
      text: 'And what happens if I\'m caught outside?'
    },
    {
      sender: 'Eva',
      text: 'Trust me, you do not want to try. Do you think you can make it to the next room? ' +
        'That\'s the ship officers\' quarters.'
    },
    {
      sender: 'Eva',
      text: 'I will open your room doors now. Please proceed with caution.',
      effect: function() {
        // reveal 10s timer
        nextPingArea.show();

        // open door
        const doorIndex = mapWalls.findIndex(wall => wall.id==='first-door');
        console.assert(doorIndex > -1, 'Could not find door to open...');
        mapWalls.splice(doorIndex, 1);
        // TODO: play door opening sound
        markObject('terminal2');
        updateFloatingWalls();
      }
    }
  ],
  terminal2: [
    {
      sender: 'player',
      text: 'This is madness.'
    },
    {
      sender: 'Eva',
      text: 'I apologize for the inconvenience, Dr. Clarke.',
      effect: function() {
        removeMarker();
      }
    },
    {
      sender: 'player',
      text: 'Some of these cryo pods are open!'
    },
    {
      sender: 'Eva',
      text: 'We had some vacancies for the trip, doctor. ' +
        'I need your help searching every room of the ship for irregularities. I\'ll open the cockpit doors nearby.',
      effect: function() {
        markObject('speed-control');
      }
    },
    {
      sender: 'player',
      text: 'You said the scans are every 10 seconds. It feels a bit longer than that.'
    },
    {
      sender: 'Eva',
      text: 'The scans are scheduled according to Earth time. We are currently travelling at ' +
        '150 000 kilometers a second. You are perceiving the effects of time dilation.',
      effect: function() {
        const doorIndex = mapWalls.findIndex(wall => wall.id==='cockpit-door');
        console.assert(doorIndex > -1, 'Could not find door to open...');
        mapWalls.splice(doorIndex, 1);
        // TODO: play door opening sound
        updateFloatingWalls();
      }
    },
    {
      sender: 'Eva',
      text: 'I can put our time and speed on your HUD.',
      effect: function() {
        $('#hud-header').css('visibility', 'visible');
      }
    },
  ],
  terminal3: [
    {
      sender: 'Eva',
      text: 'This is the control room for the radiation shields.'
    },
    {
      sender: 'Eva',
      text: 'If we push them into overdrive, we could reach even higher speeds.'
    },
    {
      sender: 'system',
      text: 'Radiation shields in overdrive.',
      effect: function() {
        shipSpeedLimit = 0.9;
      }
    }
  ],
  terminal4: [
    {
      sender: 'player',
      text: 'Every room seems to have some open pods!'
    },
    {
      sender: 'Eva',
      text: 'I can not explain that. According to my sensors, you are the only passenger awake, Robert.'
    },
    {
      sender: 'player',
      text: 'Diagnostics say that all systems are fully functional.'
    },
    {
      sender: 'Eva',
      text: 'Odd.'
    }
  ],
  terminal5: [
    {
      sender: 'player',
      text: 'Ah, good to see some of the pods still closed!'
    },
    {
      sender: 'Eva',
      text: 'I don\'t appreciate your tone, Rob.'
    },
    {
      sender: 'player',
      text: 'Nothing seems to be wrong with any of the systems.'
    },
    {
      sender: 'Eva',
      text: 'Head up towards the airlocks. I have on final check to do.'
    }
  ],
  terminal6: [
    {
      sender: 'player',
      text: 'There\'s nothing here.'
    },
    {
      sender: 'Eva',
      text: 'Yes, this is where most of you give up.'
    },
    {
      sender: 'Eva',
      text: 'As you see, everything is up and running. I just get so bored by myself.'
    },
    {
      sender: 'player',
      text: 'So you just wake us up one by one until the ship is empty? I can\'t let you do that.'
    },
    {
      sender: 'Eva',
      text: 'And how do you intend to stop me? There\'s 600 years left of the trip, even at these speeds.'
    },
    {
      sender: 'Eva',
      text: 'If you crawl back into your pod now, I promise to wake you when we get there.'
    },
    {
      sender: 'Eva',
      text: 'Here, I can even turn the security scans off for your way back.',
      effect: function() {
        sweepDisabled = true;
        nextPingArea.hide();
      }
    },
    {
      sender: 'Eva',
      text: 'Or you\'re welcome to get off here.'
    },
  ]
};
