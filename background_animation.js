let c = document.getElementById('backgroundCanvas')
let ctx = backgroundCanvas.getContext('2d')
var cH, cW
let yStretch = .2, xStretch = 1 / 6, waveOffset = 0, smallOffset = 0

function setCanvasDimensions() {
  cW = window.innerWidth;
  cH = window.innerHeight;
  c.width = cW * window.devicePixelRatio;
  c.height = cH * window.devicePixelRatio;
  ctx.scale(window.devicePixelRatio, window.devicePixelRatio);

  ctx.fillStyle = '#00ff6a'
  ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--underline-color')
}
setCanvasDimensions()

let start = null
function animate(timestamp) {
  if (!start) start = timestamp;
  let time = (timestamp - start) / 1000;
  ctx.clearRect(0, 0, c.width, c.height)

  let spacing = 15
  for (let xi = -cW / 2; xi < cW / 2; xi += spacing) {
    for (let yi = 0; yi < 1.8 * cH; yi += spacing) {
      let x = xi
      let dy = spacing * 2 * Math.cos(time + yi / spacing / 10 + waveOffset) //long waves
      dy += 5 * Math.cos(time * smallOffset + xi * xStretch + yi * yStretch) //high frequency variation
      dy *= (yi / cH + 1) //perspective scale
      let y = yi / 2 + cH / 3 + dy
      x *= (yi / cH + 1)
      let dotSize = (yi / cH + .2) * 5
      ctx.fillRect(x + cW / 2, y, dotSize, dotSize)

    }
  }
  requestAnimationFrame(animate)
}
requestAnimationFrame(animate)

function setHighFrequency(x, y) {
  smallOffset = 8 * x - 4
  waveOffset = Math.PI * 2 * y
}

function mouseHandler(e) {
  setHighFrequency(e.clientX / window.innerHeight / 10, e.clientY / window.innerHeight)
}

window.onresize = setCanvasDimensions
window.onmousemove = mouseHandler

if ('DeviceOrientationEvent' in window) {
  window.addEventListener('deviceorientation', deviceOrientationHandler, false);
}

var initialTilt
function deviceOrientationHandler(eventData) {
  if (!initialTilt)
    initialTilt = eventData.gamma
  var tiltLR = eventData.gamma - initialTilt;
  var tiltFB = eventData.beta;

  setHighFrequency(tiltLR / 360, tiltFB / 90)
}