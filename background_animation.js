let c = document.getElementById('backgroundCanvas')
let ctx = backgroundCanvas.getContext('2d')
var cH, cW
var randomMatrix
function setCanvasDimensions() {
  cW = window.innerWidth;
  cH = window.innerHeight;
  c.width = cW * window.devicePixelRatio;
  c.height = cH * window.devicePixelRatio;
  ctx.scale(window.devicePixelRatio, window.devicePixelRatio);

  ctx.fillStyle = '#00ff6a'
  ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--underline-color')

  randomMatrix = makeRandomMatrix()
}

function makeRandomMatrix() {
  let matrix = {}
  for (let xi = -cW / 2; xi < cW / 2; xi += spacing) {
    matrix[xi] = {}
    for (let yi = 0; yi < 1.8 * cH; yi += spacing)
      matrix[xi][yi] = Math.random() - 0.5
  }
  return matrix
}

let lastTime = null, time = 0
const minRandomness = 0.05
let spacing = 15, randomness = minRandomness
let smallStretch = 30, waveOffset = 0, smallOffset = 0
let xSpeed = 1, ySpeed = 1

function animate(timestamp) {
  let dt = (timestamp - lastTime) / 1000;
  lastTime = timestamp;
  ctx.clearRect(0, 0, c.width, c.height)
  //increase timesteps (according to xy speed)
  time += dt
  smallOffset += dt * xSpeed
  waveOffset += dt * ySpeed

  //decrease random effect after click
  randomness += (minRandomness - randomness) * dt * 8

  for (let xi = -cW / 2; xi < cW / 2; xi += spacing) {
    for (let yi = 0; yi < 1.8 * cH; yi += spacing) {
      let x = xi + randomness * spacing * randomMatrix[xi][yi] //random offset on click
      let dy = spacing * 2 * Math.cos(yi / spacing / 10 + waveOffset) //long waves
      dy += 5 * Math.cos(time
        + Math.sin(smallOffset + xi / smallStretch)
        + Math.cos(smallOffset + yi / smallStretch)) //high frequency variation
      dy *= (yi / cH + 1) //perspective scale
      let y = yi / 2 + cH / 3 + dy
      x *= (yi / cH + 1)
      let dotSize = (yi / cH + .1) * spacing / 3
      ctx.fillRect(x + cW / 2, y, dotSize, dotSize)

    }
  }
  requestAnimationFrame(animate)
}

//expects input values from -0.5 to 0.5
let prevY = 0, prevX = 0
function setHighFrequency(x, y) {
  //randomness = x
  xSpeed = x * 8
  ySpeed = y * 4
  waveOffset += (y - prevY) * 8
  smallOffset += (x - prevX) * 12
  prevX = x
  prevY = y
}
let tiltOverride = false
function mouseHandler(e) {
  if (!tiltOverride)
    setHighFrequency(0.5 - e.clientX / window.innerWidth, 0.5 - e.clientY / window.innerHeight)
}
window.onclick = () => { randomness = 5 }
window.onresize = setCanvasDimensions
window.onmousemove = mouseHandler

if ('DeviceOrientationEvent' in window) {
  window.addEventListener('deviceorientation', deviceOrientationHandler, false);
}

var initialTiltLR, initialTiltFB
function deviceOrientationHandler(e) {
  if (!initialTiltLR)
    initialTiltLR = e.gamma
  if (!initialTiltFB)
    initialTiltFB = e.beta
  tiltOverride = !!initialTiltLR
  var tiltLR = initialTiltLR - e.gamma;
  var tiltFB = initialTiltFB - e.beta;
  tiltFB = (tiltFB + 90) % 180 - 90
  tiltLR = (tiltLR + 90) % 180 - 90

  setHighFrequency(tiltLR / 90, tiltFB / 90)
}


requestAnimationFrame(animate)
setCanvasDimensions()