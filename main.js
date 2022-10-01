
const WIDTH = 800;
const MAX_WIDTH = 1200;
const HEIGHT = 500;
const MAX_HEIGHT = 800;
const MAP_SCROLL_PADDING = 100;

const PLAYER_SIZE = 20;
const PLAYER_SPEED = 10;

let ctx;
let debugLog;

let shipSpeed = 0.7; // fraction of c

const player = {
  x: 300,
  y: 300
};

const playerInViewport = {
  x: 300,
  y: 300
};

const viewport = {
  x: 0,
  y: 0
};

const mapObjects = [
  {
    type: 'corner-mark',
    x: WIDTH-6,
    y: HEIGHT-6
  }
];

for (let i=0; i<25; i++) {
  for (let j=0; j<20; j++) {
    mapObjects.push({
      type: 'gridmark',
      x: i*50-2,
      y: j*50-2
    });
  }
}

function getTimeDilationFactor(speed) {
  console.assert(speed >= 0 && speed < 1, 'Invalid speed: ' + speed);
  return 1 / Math.sqrt(1-speed*speed);
}

function drawFrame(timestamp) {
  debugLog.text(JSON.stringify(player) + ', v: ' + JSON.stringify(viewport));
  ctx.clearRect(0, 0, WIDTH, HEIGHT);

  // move player according to current pressed keys
  if (keysPressed.up) {
    player.y = Math.max(0, player.y - PLAYER_SPEED);
    playerInViewport.y = player.y - viewport.y;
    if (playerInViewport.y <= MAP_SCROLL_PADDING) { // TODO: use padding+speed in bounds checks?
      viewport.y = Math.max(0, viewport.y - PLAYER_SPEED);
      playerInViewport.y = player.y - viewport.y;
    }
  }
  if (keysPressed.right) {
    player.x = Math.min(MAX_WIDTH - PLAYER_SIZE, player.x + PLAYER_SPEED);
    playerInViewport.x = player.x - viewport.x;
    if (playerInViewport.x >= WIDTH - MAP_SCROLL_PADDING) {
      viewport.x = Math.min(MAX_WIDTH - WIDTH, viewport.x + PLAYER_SPEED);
      playerInViewport.x = player.x - viewport.x;
    }
  }
  if (keysPressed.down) {
    player.y = Math.min(MAX_HEIGHT - PLAYER_SIZE, player.y + PLAYER_SPEED);
    playerInViewport.y = player.y - viewport.y;
    if (playerInViewport.y >= HEIGHT- MAP_SCROLL_PADDING) {
      viewport.y = Math.min(MAX_HEIGHT - HEIGHT, viewport.y + PLAYER_SPEED);
      playerInViewport.y = player.y - viewport.y;
    }
  }
  if (keysPressed.left) {
    player.x = Math.max(0, player.x - PLAYER_SPEED);
    playerInViewport.x = player.x - viewport.x;
    if (playerInViewport.x <= MAP_SCROLL_PADDING) {
      viewport.x = Math.max(0, viewport.x - PLAYER_SPEED);
      playerInViewport.x = player.x - viewport.x;
    }
  }

  // draw objects
  ctx.save();
  mapObjects.forEach(o => {
    ctx.fillStyle = o.type === 'gridmark' ? 'gray' : 'red';
    const size = o.type === 'corner-mark' ? 12 : 5;
    ctx.fillRect(o.x - viewport.x, o.y - viewport.y, size, size);
  });
  ctx.restore();

  // draw player
  ctx.fillRect(playerInViewport.x, playerInViewport.y, 20, 20);

  requestAnimationFrame(drawFrame);
}

const keysPressed = {
  up:    false,
  right: false,
  down:  false,
  left:  false
};

$(document).ready(function() {
  debugLog = $('#debug-log');

  const canvas = document.getElementById('main-canvas');
  $(canvas).attr('height', HEIGHT);
  $(canvas).attr('width', WIDTH);

  ctx = canvas.getContext('2d');

  ctx.fillStyle = '#008800';
  ctx.strokeStyle = 'green';
  ctx.lineWidth = 5;

  // keypress event listeners
  // TODO: extend to WASD
  document.addEventListener('keydown', event => {
    switch(event.keyCode) {
      case 38:
        keysPressed.up = true;
        break;
      case 39:
        keysPressed.right = true;
        break;
      case 40:
        keysPressed.down = true;
        break;
      case 37:
        keysPressed.left = true;
        break;
    }
  });

  document.addEventListener('keyup', event => {
    switch(event.keyCode) {
      case 38:
        keysPressed.up = false;
        break;
      case 39:
        keysPressed.right = false;
        break;
      case 40:
        keysPressed.down = false;
        break;
      case 37:
        keysPressed.left = false;
        break;
    }
  });

  // start animation loop
  drawFrame();
});
