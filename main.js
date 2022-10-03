
const WIDTH = 800; // match to sweep .visible CSS rule or change from class-based to js-based sweep target position
const MAX_WIDTH = 1200;
const HEIGHT = 500;
const MAX_HEIGHT = 800;
const MAP_SCROLL_PADDING = 100;

const TILE_SIZE = 100;

const PLAYER_SIZE = 56;
const PLAYER_SPEED = 4;
// NB: the current collision detection might leave PLAYER_SPEED-1 sized gaps

const SWEEP_DURATION = 2500; // should match CSS until we can add it dynamically
const SWEEP_WIDTH = 150;

let DEBUG = false;

let ctx;
let debugLog;
let dayCountArea, timeCountArea, nextPingArea;
let pingSweep;

let dayCount = 105; // days in year
let timeCount = 16 * 60 * 60 * 1000 + 187000; // ms in day
let lastPing = timeCount;

let shipSpeed = 0.7; // fraction of c

const playerImage = $('<img>').attr('src', 'assets/player.png').get(0);
let playerAngle = 0; // radians, starting from x axis clockwise

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
  [0, 1, 2, 3, 3, 4, 4, 5, 0, 0, 0, 0],
  [0, 1, 0, 0, 3, 4, 4, 5, 0, 0, 0, 0],
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
    blocker: true,
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
  {
    // passable glass
    transparent: true,
  },
  {
    // non-passable glass
    transparent: true,
    blocker: true,
  },
];

const mapObjects = [
  {
    x: 600,
    y: 300,
    assetURL: 'assets/window0.png',
  },
];

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

(function addImageRefToTileTypesAndObjects() {
  tileTypes.forEach(tile => {
    if (tile.transparent) {
      return;
    }
    const image = $('<img>').attr('src', tile.bgURL);
    // FIXME: use dictionary for collecting image elements - no need for duplicates
    tile.image = image.get(0);
  });
  mapObjects.forEach(o => {
    if (o.type === 'gridmark') {
      return;
    }
    console.assert(o.assetURL, 'Malformed map object: ', o);
    const image = $('<img>').attr('src', o.assetURL);
    o.image = image.get(0);
  });
})();

(function addWalls() {
  mapTiles.forEach((row, rowIndex) => {
    row.forEach((t, colIndex) => {
      const tile = tileTypes[t];
      console.assert(typeof tile === 'object', 'Invalid tile type: ' + t + ' -> ' + tile);

      // check tile changes only backwards (from above and left), the other directions are covered by later tiles
      if (rowIndex > 0) {
        const tAbove = mapTiles[rowIndex-1][colIndex];
        const tileAbove = tileTypes[tAbove];
        if (tAbove !== t && (tile.blocker || tileAbove.blocker)) {
          mapWalls.push({
            x: colIndex * TILE_SIZE,
            y: rowIndex * TILE_SIZE,
            orientation: 'horizontal'
          });
        }
      }
      if (colIndex > 0) {
        const tToLeft = mapTiles[rowIndex][colIndex-1];
        const tileToLeft = tileTypes[tToLeft];
        if (tToLeft !== t && (tile.blocker || tileToLeft.blocker)) {
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

const startField = [];

function getRandomItem(array) {
  return array[Math.floor(Math.random() * array.length)];
}

(function generateStarField() {
  for (let i=0;i<300;i++) {
    startField.push({
      x: Math.floor(Math.random()*WIDTH),
      y: Math.floor(Math.random()*HEIGHT),
      color: getRandomItem(['#605050', '#406080', '#f0e090', '#f5eec0', '#ffffff']),
      size: Math.floor(Math.random()*4) +1,
    });
  }
})();

function getTileCoords(position) {
  console.assert('x' in position && 'y' in position, 'Invalid position: ' + position);
  return {
    x: Math.floor(position.x / TILE_SIZE),
    y: Math.floor(position.y / TILE_SIZE)
  };
}

function canMoveTo(position) {
  // disallows moving to forbidden/blocker tiles
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

  return !tileType.blocker;
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
    if (!canMoveTo({x: player.x + PLAYER_SIZE/2 + PLAYER_SPEED, y: player.y})) {
      return;
    }
    player.x = Math.min(MAX_WIDTH - PLAYER_SIZE/2, player.x + PLAYER_SPEED);
    playerInViewport.x = player.x - viewport.x;
    if (playerInViewport.x >= WIDTH - MAP_SCROLL_PADDING) {
      viewport.x = Math.min(MAX_WIDTH - WIDTH, viewport.x + PLAYER_SPEED);
      playerInViewport.x = player.x - viewport.x;
    }
  }
  if (keysPressed.down) {
    if (!canMoveTo({x: player.x, y: player.y + PLAYER_SIZE/2 + PLAYER_SPEED})) {
      return;
    }
    player.y = Math.min(MAX_HEIGHT - PLAYER_SIZE/2, player.y + PLAYER_SPEED);
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
  // set player orientation
  if (keysPressed.up && keysPressed.right) {
    playerAngle = 315 * Math.PI / 180;
  } else if (keysPressed.right && keysPressed.down) {
    playerAngle = 45 * Math.PI / 180;
  } else if (keysPressed.down && keysPressed.left) {
    playerAngle = 135 * Math.PI / 180;
  } else if (keysPressed.left && keysPressed.up) {
    playerAngle = 225 * Math.PI / 180;
  } else if (keysPressed.up) {
    playerAngle = 270 * Math.PI / 180;
  } else if (keysPressed.right) {
    playerAngle = 0 * Math.PI / 180;
  } else if (keysPressed.down) {
    playerAngle = 90 * Math.PI / 180;
  } else if (keysPressed.left) {
    playerAngle = 180 * Math.PI / 180;
  }
}

function startPing() {
  // NB: hit detection is in drawFrame
  lastPing = timeCount;
  sweepPassedPlayer = false;

  pingSweep.addClass('transition-on visible');
  setTimeout(() => {
    pingSweep.removeClass('transition-on visible triggered');
  }, SWEEP_DURATION + 500);
}

let lastDrawTime = 0;
let sweepPassedPlayer = false;
function drawFrame(timestamp) {
  // update timers
  // TODO: apply time dilation
  const timeSinceLastDraw = timestamp-lastDrawTime;
  timeCount+=Math.round(timeSinceLastDraw);
  if (timeCount - lastPing > 10000) {
    startPing();
  }
  lastDrawTime = timestamp;
  updateTimeDisplay();

  // sweep hit scanning
  if (timeCount - lastPing < SWEEP_DURATION) {
    // a sweep is in progress: we estimate the sweeper position (not exact, as it is controlled by a css transition)
    // we do a position check the first time we find the sweep further right than the player
    const sweepEstimate = (timeCount - lastPing)/SWEEP_DURATION * (WIDTH+SWEEP_WIDTH);
    if (!sweepPassedPlayer && sweepEstimate > player.x - viewport.x) { // NB: for now, we sweep only the viewport
      sweepPassedPlayer = true;
      const playerTile = getTileCoords(player);
      const tileTypeIndex = mapTiles[playerTile.y][playerTile.x];
      const tileType = tileTypes[tileTypeIndex];
      if (!tileType.allowedDuringPing) {
        console.warn('Ping - Busted!');
        pingSweep.addClass('triggered')
        // TODO: game end logic
      } else {
        console.log('Ping OK');
      }
    }
  }

  // clear canvas -- not needed since starfield backdrop
  // ctx.clearRect(0, 0, WIDTH, HEIGHT);

  // draw star field
  // TODO: use separate canvas - only draw once (either layer or draw from canvas image source)
  ctx.save();
  ctx.fillStyle = '#252015';
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  startField.forEach((s) => {
    ctx.fillStyle = s.color;
    ctx.fillRect(s.x, s.y, s.size, s.size);
  });
  ctx.restore();

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
      if (tile.transparent) {
        return; // transparent tiles are simply not drawn
      }
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
    if (o.type === 'gridmark') {
      ctx.fillStyle = 'gray';
      const size = 2;
      ctx.fillRect(o.x - viewport.x, o.y - viewport.y, size, size);
    } else {
      // regular object
      console.assert(o.assetURL && o.image, 'Malformed map object in drawFrame:', o);
      ctx.drawImage(o.image, o.x - viewport.x, o.y - viewport.y, o.w || 100, o.h || 100);
    }
  });
  ctx.restore();

  // draw player
  ctx.save();
  ctx.translate(playerInViewport.x, playerInViewport.y)
  ctx.rotate(playerAngle);
  ctx.translate(-playerInViewport.x, -playerInViewport.y)
  ctx.drawImage(playerImage, playerInViewport.x-PLAYER_SIZE/2, playerInViewport.y-PLAYER_SIZE/2, PLAYER_SIZE, PLAYER_SIZE);
  ctx.restore();

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

  pingSweep = $('#sweep');
  // FIXME: add transition property dynamically (does not seem to work with .css()?)
  //        toggling it could allow to start sweep far off-screen depending on player position (ie. at the actual edge of the map)

  const canvas = document.getElementById('main-canvas');
  $(canvas).attr('height', HEIGHT);
  $(canvas).attr('width', WIDTH);

  // we set the size of the container explicitly to be able to clip the sweep
  $('#container').css({
    width: WIDTH,
    height: HEIGHT
  });

  ctx = canvas.getContext('2d');

  ctx.fillStyle = '#008800';
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 4;

  // keypress event listeners
  // TODO: extend to WASD
  document.addEventListener('keydown', event => {
    switch(event.code) {
      case 'KeyW':
      case 'ArrowUp':
        keysPressed.up = true;
        event.preventDefault();
        break;
      case 'KeyD':
      case 'ArrowRight':
        keysPressed.right = true;
        event.preventDefault();
        break;
      case 'KeyS':
      case 'ArrowDown':
        keysPressed.down = true;
        event.preventDefault();
        break;
      case 'KeyA':
      case 'ArrowLeft':
        keysPressed.left = true;
        event.preventDefault();
        break;
      case 'Space':
        event.preventDefault();
        break;
    }
  });

  document.addEventListener('keyup', event => {
    switch(event.code) {
      case 'KeyW':
      case 'ArrowUp':
        keysPressed.up = false;
        break;
      case 'KeyD':
      case 'ArrowRight':
        keysPressed.right = false;
        break;
      case 'KeyS':
      case 'ArrowDown':
        keysPressed.down = false;
        break;
      case 'KeyA':
      case 'ArrowLeft':
        keysPressed.left = false;
        break;
    }
  });

  // start first ping - later pings are started when 10 seconds have passed
  startPing();

  // start animation loop
  drawFrame(0);
});
