var perspectiveElements = document.getElementsByClassName('popart');
for (const pt of perspectiveElements) {
  pt.setAttribute('text-content', pt.textContent)
}

var tiltOffset = { x: 0, y: 0 }

function perspectiveShift(e) {
  if (e.touches)
    e = e.touches[0]

  for (const pt of perspectiveElements) {
    var rect = pt.getBoundingClientRect();
    var x = e.clientX - rect.left; //x position within the element.
    var y = e.clientY - rect.top;  //y position within the element.
    pt.style.setProperty('--perspectiveShiftX', .25 * Math.max(-.5, Math.min(.5, tiltOffset.x + x / rect.width - .5)) + "em");
    pt.style.setProperty('--perspectiveShiftY', .25 * Math.max(-.5, Math.min(.5, tiltOffset.y + y / rect.height - .5)) + "em");
  }
}

document.addEventListener("mousemove", perspectiveShift, { passive: true });
document.addEventListener("touchmove", perspectiveShift, { passive: true });
document.addEventListener("touchstart", perspectiveShift, { passive: true });

var logoHeader = document.getElementById("logoHeader");
window.onscroll = scaleTitle;

function scaleTitle() {
  if (document.documentElement.scrollTop > logoHeader.offsetTop + logoHeader.offsetHeight / 2 - 55)
    logoHeader.firstElementChild.classList.add('miniHeader')
  else
    logoHeader.firstElementChild.classList.remove('miniHeader')
}

//Tilt reactive on mobile
if ('DeviceOrientationEvent' in window) {
  window.addEventListener('deviceorientation', deviceOrientationHandler, false);
}

var initialTiltLR, initialTiltFB;
function deviceOrientationHandler(e) {
  if (!initialTiltLR)
    initialTiltLR = e.gamma
  if (!initialTiltFB)
    initialTiltFB = e.beta
  var tiltLR = initialTiltLR - e.gamma;
  var tiltFB = initialTiltFB - e.beta;
  tiltFB = (tiltFB + 90) % 180 - 90
  tiltLR = (tiltLR + 90) % 180 - 90

  tiltOffset.x = tiltLR / 20;
  tiltOffset.x = tiltFB / 20
}