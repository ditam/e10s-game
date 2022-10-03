
const TYPING_DELAY = 20;
const MSG_LIMIT = 3;

function addMessage(text, sender, immediate) {
  const msg = $('<div></div>').addClass('msg').addClass(sender);
  msg.text(text[0]);
  msgLogArea.append(msg);

  if (sender === 'system') {
    immediate = true;
  }

  if (immediate) {
    msg.text(text);
  } else {
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
