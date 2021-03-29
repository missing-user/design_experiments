import EffectShell from "./EffectShell.js";

// START HERE
let images = document.querySelectorAll('img')
let canvasContainer = document.querySelector('.canvas__container');
let effectShell = new EffectShell(canvasContainer, images);

effectShell.setTextureIndex(1);
effectShell.onResize();