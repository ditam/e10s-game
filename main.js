
const WIDTH = 800;
const MAX_WIDTH = 1200;
const HEIGHT = 500;
const MAX_HEIGHT = 800;
const MAP_SCROLL_PADDING = 100;

const TILE_SIZE = 100;

const PLAYER_SIZE = 20;
const PLAYER_SPEED = 10;
// NB: the current collision detection might leave PLAYER_SPEED-1 sized gaps

let ctx;
let debugLog;

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
  },
];

(function addImageRefToTileTypes() {
  tileTypes.forEach(tile => {
    const image = $('<img>').attr('src', tile.bgURL);
    tile.image = image.get(0);
  });
})();


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

function drawFrame(timestamp) {
  ctx.clearRect(0, 0, WIDTH, HEIGHT);

  const tileCoordsBeforeMove = getTileCoords(player);
  debugLog.text(JSON.stringify(player) + ', v: ' + JSON.stringify(viewport) + ', tile: ' + JSON.stringify(tileCoordsBeforeMove));

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
