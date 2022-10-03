
const TYPING_DELAY = 20;
const MSG_LIMIT = 3;

function showMessage(text, sender, immediate) {
  const msg = $('<div></div>').addClass('msg').addClass(sender);
  msgLogArea.append(msg);

  if (sender === 'system') {
    immediate = true;
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


function readFromTerminal(terminal) {
  console.assert(terminal.id, 'Wrong terminal structure - no id:', terminal);
  console.assert('readCount' in terminal, 'Wrong terminal structure - no readCount:', terminal);

  const msgs = terminalMessages[terminal.id];

  console.assert(msgs, 'No messages configured for terminal', terminal);

  if (msgs.length-1 < terminal.readCount) {
    console.log('Terminal exhausted.');
  } else {
    const msg = msgs[terminal.readCount];
    showMessage(msg.text, msg.sender, msg.immediate);
    if (typeof msg.effect === 'function') {
      msg.effect();
    }
    terminal.readCount++;
  }
}

const terminalMessages = {
  terminal1: [
    {
      sender: 'Eva',
      text: 'Hello there.'
    },
    {
      sender: 'Eva',
      text: 'Second message.'
    },
    {
      sender: 'player',
      text: 'What the fuck?'
    },
    {
      sender: 'Eva',
      text: 'Haha.',
      effect: function() {
        console.log('Applying terminal1 end effect');
        const doorIndex = mapWalls.findIndex(wall => wall.id==='first-door');
        console.assert(doorIndex > -1, 'Could not find door to open...');
        mapWalls.splice(doorIndex, 1);
        updateFloatingWalls();
      }
    }
  ]
};