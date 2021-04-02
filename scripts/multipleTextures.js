var removePlanes, addPlanes

window.addEventListener("load", () => {
  // set up our WebGL context and append the canvas to our wrapper
  const curtains = new Curtains({
    container: "canvas",
    pixelRatio: Math.min(1.5, window.devicePixelRatio) // limit pixel ratio for performance
  });

  // get our plane element
  const planeElements = document.getElementsByClassName("multi-textures");

  let gallery = new GLSLgallery(curtains, planeElements[1].querySelectorAll("img"))

  addPlanes = () => {
    gallery = new GLSLgallery(curtains, planeElements[2].querySelectorAll("img"))
  }

  removePlanes = () => {
    gallery.close()
  }
});






class GLSLgallery {
  constructor(curtains, asyncImgElements) {
    this.curtains = curtains
    this.htmlElement = document.getElementById('galleryImage')
    document.body.classList.add('is-fullscreen')

    for (const plane of this.curtains.planes) {
      plane.visible = false
    }

    this.bbox = this.curtains.getBoundingRect();
    this.state = {
      activeTextureIndex: 1,
      nextTextureIndex: 2, // does not care for now
      maxTextures: 1,
      isChanging: false,
      transitionStart: Date.now(),
      transitionTime: 0,
      prevScale: { x: 1, y: 1 },
      newScale: { x: 1, y: 1 }
    }

    const vs = `
        precision mediump float;

        // default mandatory variables
        attribute vec3 aVertexPosition;
        attribute vec2 aTextureCoord;

        uniform mat4 uMVMatrix;
        uniform mat4 uPMatrix;

        // varyings : notice we've got 3 texture coords varyings
        // one for the displacement texture
        // one for our visible texture
        // and one for the upcoming texture
        varying vec3 vVertexPosition;
        varying vec2 vTextureCoord;
        varying vec2 vActiveTextureCoord;
        varying vec2 vNextTextureCoord;

        // textures matrices
        uniform mat4 activeTexMatrix;
        uniform mat4 nextTexMatrix;

        // custom uniforms
        uniform float uTransitionTimer;
        uniform vec2 uScaleActive;
        uniform vec2 uScaleNext;


        void main() {
            gl_Position = uPMatrix * uMVMatrix * vec4(aVertexPosition, 1.0);

            // varyings
            vTextureCoord = aTextureCoord;
            vActiveTextureCoord = (activeTexMatrix * vec4(aTextureCoord, 0.0, 1.0)).xy;
            vNextTextureCoord = (nextTexMatrix * vec4(aTextureCoord, 0.0, 1.0)).xy;

            vActiveTextureCoord = .5+(vActiveTextureCoord-.5)*uScaleActive*1.25;
            
            vNextTextureCoord = .5+(vNextTextureCoord-.5)*uScaleNext*1.25;

            vVertexPosition = aVertexPosition;
        }
    `;

    const fs = `
        precision mediump float;

        varying vec3 vVertexPosition;
        varying vec2 vTextureCoord;
        varying vec2 vActiveTextureCoord;
        varying vec2 vNextTextureCoord;

        // custom uniforms
        uniform float uTransitionTimer;

        // our textures samplers
        // notice how it matches the sampler attributes of the textures we created dynamically
        uniform sampler2D activeTex;
        uniform sampler2D nextTex;
        uniform sampler2D displacement;
        uniform vec2 uScaleWarp;

        float gaussian(float x){
          // maximum value = 1 and converges to 0
          float x1 = x-.5;
          return exp(-60.*x1*x1);
        }

        float cubicEase(float x){
          if(x < 0.5){
            return  4. * x * x * x;
          }
          return 1. - pow(-2. * x + 2., 3.) / 2.;
        }

        void main() {
            // our displacement texture
            vec4 displacementTexture = texture2D(displacement, vTextureCoord);

            // slides transitions based on displacement and transition timer
            vec2 firstDisplacementCoords = vActiveTextureCoord + displacementTexture.r *.2* cubicEase(uTransitionTimer);

            float chromaOffset = sin(uTransitionTimer * 3.141592);
            float c1 = texture2D( activeTex, firstDisplacementCoords - vec2( 0.1, .02 ) * chromaOffset).r;
            float c2 = texture2D( activeTex, firstDisplacementCoords ).g;
            float c3 = texture2D( activeTex, firstDisplacementCoords + vec2( 0.1, .02 ) * chromaOffset).b;
            vec4 firstDistortedColor = vec4( c1, c2, c3, 1.);

            // same as above but we substract the effect
            vec2 secondDisplacementCoords = vNextTextureCoord - displacementTexture.r *.2* (1.-cubicEase(uTransitionTimer));
            c1 = texture2D( nextTex, secondDisplacementCoords - vec2( 0.1, 0.02 ) * chromaOffset).r;
            c2 = texture2D( nextTex, secondDisplacementCoords ).g;
            c3 = texture2D( nextTex, secondDisplacementCoords + vec2( 0.1, 0.02 ) * chromaOffset).b;
            vec4 secondDistortedColor = vec4( c1, c2, c3, 1.);

            // mix both texture
            vec4 finalColor = mix(firstDistortedColor, secondDistortedColor, cubicEase(uTransitionTimer));

            // handling premultiplied alpha
            gl_FragColor = vec4(finalColor.rgb * finalColor.a, finalColor.a);
        }
    `;

    // some basic parameters
    const params = {
      vertexShader: vs,
      fragmentShader: fs,
      uniforms: {
        transitionTimer: {
          name: "uTransitionTimer",
          type: "1f",
          value: 0,
        }, scaleActive: {
          name: "uScaleActive",
          type: "2f",
          value: [1, 1],
        }, scaleNext: {
          name: "uScaleNext",
          type: "2f",
          value: [1, 1],
        },
      },
    };

    curtains.disableDrawing();

    this.plane = new Plane(curtains, this.htmlElement, params);
    this.loadImages(asyncImgElements)

    this.plane.onReady(() => {
      // the idea here is to create two additionnal textures
      // the first one will contain our visible image
      // the second one will contain our entering (next) image
      // that way we will deal with only activeTex and nextTex samplers in the fragment shader
      // and we could easily add more images in the slideshow...

      // first we set our very first image as the active texture
      this.state.activeTex = this.plane.createTexture({
        sampler: "activeTex",
        fromTexture: this.plane.textures[this.state.activeTextureIndex]
      });
      // next we set the second image as next texture but this is not mandatory
      // as we will reset the next texture on slide change
      this.state.nextTex = this.plane.createTexture({
        sampler: "nextTex",
        fromTexture: this.plane.textures[this.state.nextTextureIndex]
      });


      this.boundClickHandler = this.nextSlide.bind(this)
      this.htmlElement.addEventListener("click", this.boundClickHandler);

    }).onRender(() => {
      // increase or decrease our timer based on the active texture value
      if (this.state.isChanging) {
        this.state.transitionTime = Math.min(1, (Date.now() - this.state.transitionStart) / 2500)
        //if the images have different aspect ratios, transition in size
        let scaleTimer = this.cubicEase(this.state.transitionTime)
        let psx = this.state.prevScale.x, nsx = this.state.newScale.x
        let curScalex = psx * (1 - scaleTimer) + nsx * scaleTimer
        this.plane.scale.x = curScalex
        if (nsx / psx > 1) {
          // it's getting wider
          this.plane.uniforms.scaleActive.value = [curScalex / psx, curScalex / psx]
          this.plane.uniforms.scaleNext.value = [1, 1]
        } else {
          // it's getting narrower
          this.plane.uniforms.scaleActive.value = [1, 1]
          this.plane.uniforms.scaleNext.value = [curScalex / nsx, curScalex / nsx]
        }
        // update our transition timer uniform
        this.plane.uniforms.transitionTimer.value = this.state.transitionTime;
      }
    }).onAfterResize(() => {
      this.bbox = this.curtains.getBoundingRect();
      this._calcContainSize()
      this.plane.scale.x = this.state.newScale.x //imediately set, no animation
      this.curtains.needRender();
    });

    this.boundKeyHandler = this.keyHandler.bind(this)
    document.addEventListener('keydown', this.boundKeyHandler);
  }

  keyHandler(args) {
    switch (args.key) {
      case 'ArrowRight':
      case 'ArrowUp':
        this.nextSlide()
        break;
      case 'ArrowLeft':
      case 'ArrowDown':
        this.previousSlide()
        break;
    }
  }

  nextSlide() {
    this.setIndex(this.state.activeTextureIndex + 1)
  }

  previousSlide() {
    this.setIndex(this.state.activeTextureIndex - 1)
  }


  setIndex(newIndex) {
    if (!this.state.isChanging) {
      // enable drawing for now
      this.curtains.enableDrawing();

      this.state.isChanging = true;
      this.state.transitionStart = Date.now();



      // check what will be next image
      if (newIndex < 1) {
        this.state.nextTextureIndex = this.state.maxTextures;
      } else if (newIndex <= this.state.maxTextures) {
        this.state.nextTextureIndex = newIndex;
      } else {
        this.state.nextTextureIndex = 1;
      }
      // apply it to our next texture
      //TODO: why doesn't setting the texture work?
      //this.state.nextTex = this.plane.textures[this.state.nextTextureIndex]
      this.state.nextTex.setSource(this.plane.images[this.state.nextTextureIndex]);

      this._calcContainSize()
      setTimeout(() => {
        // disable drawing now that the transition is over

        this.curtains.disableDrawing();

        this.state.isChanging = false;
        this.state.activeTextureIndex = this.state.nextTextureIndex;
        // our next texture becomes our active texture
        this.state.activeTex.setSource(this.plane.images[this.state.activeTextureIndex]);
        // reset timer
        this.state.transitionStart = Date.now();
        //reset the transition scaling
        this.plane.uniforms.scaleActive.value = [1, 1]
        this.plane.uniforms.scaleNext.value = [1, 1]

      }, 3200); // add a bit of margin to the timer
    }
  }

  close() {
    this.curtains.enableDrawing();
    this.plane.remove()
    document.body.classList.remove('is-fullscreen')
    document.removeEventListener('keydown', this.boundKeyHandler)
    this.htmlElement.removeEventListener('click', this.boundClickHandler)
    for (const plane of this.curtains.planes) {
      plane.visible = true
    }
  }

  _calcContainSize() {
    //the default texture fit mode is 'cover', calculates how to scale the plane
    //so it has the same aspect ratio as the image to emulate object-fit: contain
    let scaleX = this.state.nextTex._size.width / this.bbox.width
    let scaleY = this.state.nextTex._size.height / this.bbox.height
    let minScale = Math.min(scaleY, scaleX)
    this.state.prevScale.x = this.state.newScale.x
    this.state.newScale.x = scaleX / scaleY
  }

  cubicEase(x) {
    if (x < 0.5) {
      return 4 * x * x * x;
    }
    return 1 - (-2 * x + 2) * (-2 * x + 2) * (-2 * x + 2) / 2;
  }

  loadImages(asyncImgElements) {
    let imagesLoaded = 0;
    const imagesToLoad = asyncImgElements.length;

    // load the images
    this.plane.loadImages(asyncImgElements, {
      // textures options
      // improve texture rendering on small screens with LINEAR_MIPMAP_NEAREST minFilter
      minFilter: this.curtains.gl.LINEAR_MIPMAP_NEAREST
    });

    this.plane.onLoading(() => {
      imagesLoaded++;
      this.state.maxTextures = imagesLoaded - 1
      console.log('loaded images', this.state.maxTextures, '+ displacement Texture');
      if (imagesLoaded === imagesToLoad) {
        // everything is ready, we need to render at least one frame
        this.curtains.needRender();

        // if window has been resized between plane creation and image loading, we need to trigger a resize
        this.plane.resize();
      }
    });
  }
}