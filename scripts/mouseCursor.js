if (window.matchMedia("(min-width: 768px)").matches) {
  let mousePosX = 0,
    mousePosY = 0,
    mouseCircle = document.getElementById("mouse-circle");

  document.onmousemove = (e) => {
    mousePosX = e.pageX;
    mousePosY = e.pageY;
  };

  let delay = 6,
    revisedMousePosX = 0,
    revisedMousePosY = 0;

  function delayMouseFollow() {
    requestAnimationFrame(delayMouseFollow);

    revisedMousePosX += (mousePosX - revisedMousePosX) / delay;
    revisedMousePosY += (mousePosY - revisedMousePosY) / delay;

    mouseCircle.style.top = revisedMousePosY + "px";
    mouseCircle.style.left = revisedMousePosX + "px";
  }
  delayMouseFollow();


  function makeMouseBig() {
    mouseCircle.style.transform = 'scale(2)'
  }
  function makeMouseSmall() {
    mouseCircle.style.transform = ''
  }

  for (const img of document.querySelectorAll('img')) {
    img.addEventListener("mouseenter", makeMouseBig);
    img.addEventListener("mouseout", makeMouseSmall);
  }
}