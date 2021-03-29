if (window.matchMedia("(min-width: 768px)").matches) {
  let mousePosX = 0,
    mousePosY = 0,
    mouseCircle = document.getElementById("mouse-circle");

  let lastMove = 0
  document.onmousemove = (e) => {
    mousePosX = e.pageX;
    mousePosY = e.pageY;
    if (getActivityTime() < 0) {
      revisedMousePosX = mousePosX
      revisedMousePosY = mousePosY

    }
    lastMove = Date.now()
  };

  let delay = 6,
    revisedMousePosX = 0,
    revisedMousePosY = 0;

  function getActivityTime() {
    return (lastMove - Date.now()) * 2e-3 + 5
  }

  function delayMouseFollow() {
    requestAnimationFrame(delayMouseFollow);

    revisedMousePosX += (mousePosX - revisedMousePosX) / delay;
    revisedMousePosY += (mousePosY - revisedMousePosY) / delay;

    mouseCircle.style.top = revisedMousePosY + "px";
    mouseCircle.style.left = revisedMousePosX + "px";

    mouseCircle.style.opacity = Math.min(1, Math.max(0, getActivityTime()))
  }
  delayMouseFollow();

}