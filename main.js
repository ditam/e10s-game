
const WIDTH = 800;
const HEIGHT = 500;

let ctx;

let xPosition = 0;

function drawFrame(timestamp) {
  ctx.clearRect(0, 0, WIDTH, HEIGHT);

  ctx.beginPath();
  ctx.moveTo(225, 300);
  ctx.lineTo(325, 450);
  ctx.lineTo(625,  50);
  ctx.stroke();

  xPosition = (timestamp/3) % WIDTH;
  ctx.fillRect(xPosition, HEIGHT/2-10, 20, 20);

  requestAnimationFrame(drawFrame);
}

$(document).ready(function() {
  console.log('Hello Canvas!');

  const canvas = document.getElementById('main-canvas');
  $(canvas).attr('height', HEIGHT);
  $(canvas).attr('width', WIDTH);

  ctx = canvas.getContext('2d');

  ctx.fillStyle = '#00FF00';
  ctx.strokeStyle = 'green';
  ctx.lineWidth = 5;

  drawFrame();
});
