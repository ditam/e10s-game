
const WIDTH = 800;
const MAX_WIDTH = 1200;
const HEIGHT = 500;
const MAX_HEIGHT = 800;
const MAP_SCROLL_PADDING = 100;

const TILE_SIZE = 100;

const PLAYER_SIZE = 20;
const PLAYER_SPEED = 10;
// NB: the current collision detection might leave PLAYER_SPEED-1 sized gaps

let DEBUG = false;

let ctx;
let debugLog;
let dayCountArea, timeCountArea, nextPingArea;

let dayCount = 105; // days in year
let timeCount = 16 * 60 * 60 * 1000 + 187531; // ms in day
let lastPing = timeCount;

let shipSpeed = 0.7; // fraction of c

const player = {
  x: 150,
  y: 150
};

const playerInViewport = {
  x: player.x,
  y: player.y
};

const viewport = {
  x: 0,
  y: 0
};

const mapTiles = [
  [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  [1, 1, 2, 3, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 1, 2, 3, 3, 0, 0, 0, 0, 0, 0, 0],
  [0, 1, 0, 0, 3, 0, 0, 0, 0, 0, 0, 0],
  [0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
  [0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 1, 0, 0, 2, 0, 0],
  [0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 0, 0]
];

const mapWalls = [];

console.assert(mapTiles[0].length * TILE_SIZE >= MAX_WIDTH, 'Not enough map tile columns to cover MAX_WIDTH');
console.assert(mapTiles.length * TILE_SIZE >= MAX_HEIGHT, 'Not enough map tile rows to cover MAX_HEIGHT');

const tileTypes = [
  {
    bgURL: 'assets/tile0.png',
    forbidden: true,
  },
  {
    bgURL: 'assets/tile1.png',
  },
  {
    bgURL: 'assets/tile2.png',
  },
  {
    bgURL: 'assets/tile3.png',
    allowedDuringPing: true
  },
];

(function addImageRefToTileTypes() {
  tileTypes.forEach(tile => {
    const image = $('<img>').attr('src', tile.bgURL);
    tile.image = image.get(0);
  });
})();

(function addWalls() {
  mapTiles.forEach((row, rowIndex) => {
    row.forEach((t, colIndex) => {
      const tile = tileTypes[t];
      console.assert(typeof tile === 'object', 'Invalid tile type: ' + t + ' -> ' + tile);
      console.assert(tile.image, 'Missing tile image for tile type ' + t);

      // check tile changes only backwards (from above and left), the other directions are covered by later tiles
      if (rowIndex > 0) {
        const tAbove = mapTiles[rowIndex-1][colIndex];
        if (tAbove !== t && (t === 0 || tAbove === 0)) {
          mapWalls.push({
            x: colIndex * TILE_SIZE,
            y: rowIndex * TILE_SIZE,
            orientation: 'horizontal'
          });
        }
      }
      if (colIndex > 0) {
        const tToLeft = mapTiles[rowIndex][colIndex-1];
        if (tToLeft !== t && (t === 0 || tToLeft === 0)) {
          mapWalls.push({
            x: colIndex * TILE_SIZE,
            y: rowIndex * TILE_SIZE,
            orientation: 'vertical'
          });
        }
      }
    });
  });
})();


const mapObjects = [];

if (DEBUG) {
  for (let i=0; i<25; i++) {
    for (let j=0; j<20; j++) {
      mapObjects.push({
        type: 'gridmark',
        x: i*50-2,
        y: j*50-2
      });
    }
  }
}

function getTileCoords(position) {
  console.assert('x' in position && 'y' in position, 'Invalid position: ' + position);
  return {
    x: Math.floor(position.x / TILE_SIZE),
    y: Math.floor(position.y / TILE_SIZE)
  };
}

function canMoveTo(position) {
  // disallows moving to forbidden tiles
  const tileCoords = getTileCoords(position);

  // it is valid to check out of bounds (to allow for simple player size offsets going right/down),
  // but it is guaranteed to be forbidden
  if (
    tileCoords.x > mapTiles[0].length - 1 ||
    tileCoords.y > mapTiles.length - 1 ||
    tileCoords.x < 0 ||
    tileCoords.y < 0
  ) {
    return false;
  }

  const tileTypeIndex = mapTiles[tileCoords.y][tileCoords.x];
  const tileType = tileTypes[tileTypeIndex];

  console.assert(tileType, 'Unexpected out of bounds position: ' + JSON.stringify(position));

  return !tileType.forbidden;
}

function getTimeDilationFactor(speed) {
  console.assert(speed >= 0 && speed < 1, 'Invalid speed: ' + speed);
  return 1 / Math.sqrt(1-speed*speed);
}

function updateTimeDisplay() {
  let month = Math.floor(dayCount / 30);
  month = (month+'').padStart(2, '0');
  dayCountArea.text(`${month}-${dayCount-month*30} `);

  let hours = Math.floor(timeCount / (60*60*1000));
  let timeCountLeft = timeCount-hours*60*60*1000;
  let minutes = Math.floor(timeCountLeft / (60*1000));
  timeCountLeft = timeCountLeft-minutes*60*1000;
  let seconds = Math.floor(timeCountLeft / 1000);
  timeCountLeft = timeCountLeft-seconds*1000;
  let ms = timeCountLeft;

  hours = (hours+'').padStart(2, '0');
  minutes = (minutes+'').padStart(2, '0');
  seconds = (seconds+'').padStart(2, '0');
  ms = (ms+'').padStart(3, '0');

  timeCountArea.text(`${hours}:${minutes}:${seconds}.${ms}`);

  const timeSincePing = timeCount - lastPing;
  const timeToNextPing = 10*1000 - 1 - timeSincePing; // we cheat a MS to fix layout shift at exactly 10k - sue me
  let pingSeconds = Math.floor(timeToNextPing / 1000);
  timeCountLeft = timeToNextPing-pingSeconds*1000;
  let pingMs = timeCountLeft;

  //pingSeconds = (pingSeconds+'').padStart(2, '0'); // we don't need to ping this as ET ping time is always <10
  pingMs = (pingMs+'').padStart(3, '0');
  nextPingArea.text(`${pingSeconds}.${pingMs}`);
}

function movePlayer() {
  // move player according to current pressed keys
  if (keysPressed.up) {
    if (!canMoveTo({x: player.x, y: player.y - PLAYER_SPEED})) {
      return;
    }
    player.y = Math.max(0, player.y - PLAYER_SPEED);
    playerInViewport.y = player.y - viewport.y;
    if (playerInViewport.y <= MAP_SCROLL_PADDING) { // TODO: use padding+speed in bounds checks?
      viewport.y = Math.max(0, viewport.y - PLAYER_SPEED);
      playerInViewport.y = player.y - viewport.y;
    }
  }
  if (keysPressed.right) {
    if (!canMoveTo({x: player.x + PLAYER_SIZE + PLAYER_SPEED, y: player.y})) {
      return;
    }
    player.x = Math.min(MAX_WIDTH - PLAYER_SIZE, player.x + PLAYER_SPEED);
    playerInViewport.x = player.x - viewport.x;
    if (playerInViewport.x >= WIDTH - MAP_SCROLL_PADDING) {
      viewport.x = Math.min(MAX_WIDTH - WIDTH, viewport.x + PLAYER_SPEED);
      playerInViewport.x = player.x - viewport.x;
    }
  }
  if (keysPressed.down) {
    if (!canMoveTo({x: player.x, y: player.y + PLAYER_SIZE + PLAYER_SPEED})) {
      return;
    }
    player.y = Math.min(MAX_HEIGHT - PLAYER_SIZE, player.y + PLAYER_SPEED);
    playerInViewport.y = player.y - viewport.y;
    if (playerInViewport.y >= HEIGHT- MAP_SCROLL_PADDING) {
      viewport.y = Math.min(MAX_HEIGHT - HEIGHT, viewport.y + PLAYER_SPEED);
      playerInViewport.y = player.y - viewport.y;
    }
  }
  if (keysPressed.left) {
    if (!canMoveTo({x: player.x - PLAYER_SPEED, y: player.y})) {
      return;
    }
    player.x = Math.max(0, player.x - PLAYER_SPEED);
    playerInViewport.x = player.x - viewport.x;
    if (playerInViewport.x <= MAP_SCROLL_PADDING) {
      viewport.x = Math.max(0, viewport.x - PLAYER_SPEED);
      playerInViewport.x = player.x - viewport.x;
    }
  }
}

function processPing() {
  lastPing = timeCount;
  const playerTile = getTileCoords(player);
  const tileTypeIndex = mapTiles[playerTile.y][playerTile.x];
  const tileType = tileTypes[tileTypeIndex];
  // TODO: ping animation - bust with delay?
  if (!tileType.allowedDuringPing) {
    console.warn('Ping - Busted!');
    // TODO: game end logic
  } else {
    console.log('Ping OK');
  }
}

let lastDrawTime = 0;
function drawFrame(timestamp) {
  // update timers
  // TODO: apply time dilation
  const timeSinceLastDraw = timestamp-lastDrawTime;
  timeCount+=Math.round(timeSinceLastDraw);
  if (timeCount - lastPing > 10000) {
    processPing();
  }
  lastDrawTime = timestamp;
  updateTimeDisplay();

  // clear canvas
  ctx.clearRect(0, 0, WIDTH, HEIGHT);

  // print debug info to DOM
  const tileCoordsBeforeMove = getTileCoords(player);
  debugLog.text(
    JSON.stringify(player) + ', v: ' + JSON.stringify(viewport) +
    ', tile: ' + JSON.stringify(tileCoordsBeforeMove) +
    ', since ping: ' + (timeCount-lastPing)
  );

  // move player
  movePlayer();

  // draw tiles
  mapTiles.forEach((row, rowIndex) => {
    row.forEach((t, colIndex) => {
      const tile = tileTypes[t];
      console.assert(typeof tile === 'object', 'Invalid tile type: ' + t + ' -> ' + tile);
      console.assert(tile.image, 'Missing tile image for tile type ' + t);

      ctx.drawImage(tile.image, colIndex*TILE_SIZE - viewport.x, rowIndex*TILE_SIZE - viewport.y, TILE_SIZE, TILE_SIZE);
    });
  });

  // draw walls
  mapWalls.forEach(w => {
    ctx.beginPath();
    ctx.moveTo(w.x - viewport.x, w.y - viewport.y);
    const h = (w.orientation === 'horizontal');
    ctx.lineTo(w.x - viewport.x + (h? 100 : 0), w.y - viewport.y + (h? 0 : 100));
    ctx.stroke();
  });

  // draw objects
  ctx.save();
  mapObjects.forEach(o => {
    ctx.fillStyle = o.type === 'gridmark' ? 'gray' : 'red';
    const size = 2;
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

  dayCountArea = $('#day-value');
  timeCountArea = $('#time-value');
  nextPingArea = $('#next-ping-value');

  const canvas = document.getElementById('main-canvas');
  $(canvas).attr('height', HEIGHT);
  $(canvas).attr('width', WIDTH);

  ctx = canvas.getContext('2d');

  ctx.fillStyle = '#008800';
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 4;

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
  drawFrame(0);
});
