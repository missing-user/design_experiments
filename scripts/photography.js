window.addEventListener("load", () => {
  // set up our WebGL context and append the canvas to our wrapper
  const curtains = new Curtains({
    container: "canvas",
    pixelRatio: Math.min(1.5, window.devicePixelRatio) // limit pixel ratio for performance
  });
  let curtainsBBox = curtains.getBoundingRect();
  let gallery

  function limit(input, min, max) {
    return Math.min(Math.max(input, min), max)
  }

  curtains.onRender(() => {
    chromaDelta = curtains.lerp(chromaDelta, 0, .04);
    velocity.x = curtains.lerp(velocity.x, 0, 0.02)
    velocity.y = curtains.lerp(velocity.y, 0, 0.02)
  }).onScroll(() => {
    // get scroll deltas to apply the effect on scroll
    const delta = curtains.getScrollDeltas();
    chromaDelta = curtains.lerp(chromaDelta, limit(delta.y, -10, 10) / 10, 0.05);
  }).onError(() => {
    // we will add a class to the document body to display original images
    document.body.classList.add("no-curtains", "planes-loaded");
  }).onContextLost(() => {
    // on context lost, try to restore the context
    curtains.restoreContext();
  }).onAfterResize(() => {
    curtainsBBox = curtains.getBoundingRect();
  });

  // we will keep track of all our planes in an array
  const planes = [];
  let chromaDelta = 0;
  let planeElements = document.getElementsByClassName("plane");

  //fragment shader
  const fs = `
      precision mediump float;
  
      varying vec3 vVertexPosition;
      varying vec2 vTextureCoord;

      uniform float uScrollDelta;
      uniform sampler2D planeTexture;
  
      uniform vec2 uResolution;
      uniform vec2 uMouse;
      uniform vec2 uVelocity;
      
      
      float circle(vec2 vUv, vec2 disc_center, float disc_radius, float border_size) {
        vec2 uv = vUv;
        uv -= disc_center/2.;
        uv *= uResolution;
        float dist = sqrt(dot(uv, uv));
        return smoothstep(disc_radius+border_size, disc_radius-border_size, dist);
      }

      vec2 warpedCoordinates(float warpAmmount, float c){
        return vTextureCoord + warpAmmount*(vec2( 0.02, .05 ) * uScrollDelta + c * (uVelocity * .05));
      }

      void main() {						
          float c = circle(vTextureCoord, uMouse+1., .1, .25);
          
        	float c1 = texture2D( planeTexture, warpedCoordinates(1., c)).r;
        	float c2 = texture2D( planeTexture, vTextureCoord).g;
          float c3 = texture2D( planeTexture, warpedCoordinates(-1., c)).b;
          // for a red and blue version make green and blue offset the same

        	gl_FragColor = vec4( c1, c2, c3, 1.);
          //gl_FragColor = sample;
        }
  `;
  // all planes will have the same parameters

  const mouse = new Vec2();
  const lastMouse = mouse.clone();
  const velocity = new Vec2();

  const params = {
    fragmentShader: fs,
    uniforms: {
      delta: {
        name: "uScrollDelta",
        type: "1f",
        value: 1,
      },
      uMouse: {
        name: "uMouse",
        type: "2f",
        value: mouse,
      },
      resolution: {
        name: "uResolution",
        type: "2f",
        value: [curtainsBBox.width, curtainsBBox.height],
      },
      uVelocity: {
        name: "uVelocity",
        type: "2f",
        value: velocity,
      },
    }
  };

  // add our planes and handle them
  for (let i = 0; i < planeElements.length; i++) {
    planes.push(new Plane(curtains, planeElements[i], params));
    handlePlanes(i);
  }

  // handle all the planes
  function handlePlanes(index) {
    const plane = planes[index];

    // check if our plane is defined and use it
    plane.onReady(() => {
      // once everything is ready, display everything
      if (index === planes.length - 1) {
        document.body.classList.add("planes-loaded");
      }
      plane.uniforms.resolution.value = [plane.getBoundingRect().width / plane.getBoundingRect().height, 1]
    }).onRender(() => {
      // update the uniform
      plane.uniforms.delta.value = chromaDelta;
      plane.uniforms.uMouse.value = plane.mouseToPlaneCoords(mouse)
      plane.uniforms.uVelocity.value = velocity
    })

    //enter gallery view when clicked
    plane.htmlElement.addEventListener("click", (e) => {
      e.stopPropagation();
      enterGallery(plane.htmlElement)
    });
  }

  function enterGallery(htmlElement) {
    if (gallery)
      console.log('gallery already oopen');
    else
      gallery = new GLSLgallery(curtains, htmlElement.getAttribute('gallery-images'))
  }


  document.getElementsByClassName('closeButton')[0].addEventListener("click", () => {
    console.log('gallery clsing:', gallery);
    if (gallery) {
      gallery.close()
      gallery = undefined
    }
  });

  // mouse/touch move
  function onMouseMove(e) {
    // velocity is our mouse position minus our mouse last position
    lastMouse.copy(mouse);

    // touch event
    if (e.targetTouches)
      mouse.set(e.targetTouches[0].clientX, e.targetTouches[0].clientY);
    else
      mouse.set(e.clientX, e.clientY);


    let targetVelocity = [(mouse.x - lastMouse.x) / 16, (mouse.y - lastMouse.y) / 16];

    velocity.x = curtains.lerp(velocity.x, targetVelocity[0], 0.1)
    velocity.y = curtains.lerp(velocity.y, targetVelocity[1], 0.1)
  }

  window.addEventListener("mousemove", onMouseMove);
  window.addEventListener("touchmove", onMouseMove);
});


class GLSLgallery {
  // Gallery either takes a list of img elements to load the data from or
  // a string containing all the image paths
  constructor(curtains, asyncImgElements) {
    this.curtains = curtains
    this.htmlElement = document.getElementById('galleryImage')
    document.body.classList.add('is-fullscreen')

    for (const plane of this.curtains.planes) {
      plane.visible = false
    }

    //append image sources passed as img elements to the gallery
    if (typeof asyncImgElements === 'string')
      this._loadFromString(asyncImgElements)

    this.bbox = this.curtains.getBoundingRect();
    this.state = {
      activeTextureIndex: 1,
      nextTextureIndex: 2, // does not care for now
      maxTextures: this.htmlElement.querySelectorAll('img').length - 1,
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

            vActiveTextureCoord = .5+(vActiveTextureCoord-.5)*uScaleActive;
            
            vNextTextureCoord = .5+(vNextTextureCoord-.5)*uScaleNext;

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

    //create the plane (automatically loads containing img element sources)
    this.plane = new Plane(curtains, this.htmlElement, params);
    if (Symbol.iterator in Object(asyncImgElements) && ! typeof asyncImgElements === 'string')
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
        this.state.transitionTime = Math.min(1, (Date.now() - this.state.transitionStart) / 250)
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

      }

      // update our transition timer uniform
      this.plane.uniforms.transitionTimer.value = this.state.transitionTime;
    }).onAfterResize(() => {
      this.bbox = this.curtains.getBoundingRect();
      this._calcContainSize()
      this.plane.scale.x = this.state.newScale.x //imediately set, no animation
      this.curtains.needRender();
    });

    this.boundKeyHandler = this.keyHandler.bind(this)
    document.addEventListener('keydown', this.boundKeyHandler);
  }

  _loadFromString(dataString) {
    function htmlToElement(html) {
      var template = document.createElement('template');
      template.innerHTML = html;
      return template.content.firstChild;
    }

    const imagePaths = dataString.split(' ')
    console.log('loading from string', imagePaths);
    for (const path of imagePaths) {
      const htmlNode = htmlToElement(`<img src="${path}#" crossorigin="anonymous" />`)
      this.htmlElement.appendChild(htmlNode)
    }
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
        this.state.transitionTime = 0;
        //reset the transition scaling
        this.plane.uniforms.scaleActive.value = [1, 1]
        this.plane.uniforms.scaleNext.value = [1, 1]

      }, 320); // add a bit of margin to the timer
    }
  }

  close() {
    this.curtains.enableDrawing();
    this.plane.remove()
    document.body.classList.remove('is-fullscreen')
    document.removeEventListener('keydown', this.boundKeyHandler)
    this.htmlElement.removeEventListener('click', this.boundClickHandler)
    //remove all children except for the displacement texture and close button
    while (this.htmlElement.childElementCount > 2) {
      this.htmlElement.removeChild(this.htmlElement.lastChild)
    }

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

  //takes a list of img elements and loads them into fullscreen gallery
  loadImages(asyncImgElements) {
    this.state.maxTextures--; //don't double count the displacement texture
    const imagesToLoad = asyncImgElements.length;
    console.log('loading from img elements', asyncImgElements);

    // load the images
    this.plane.loadImages(asyncImgElements);

    this.plane.onLoading(() => {
      this.state.maxTextures++;
      if (this.state.maxTextures === imagesToLoad) {
        this.setIndex(1)
      }
    });
  }
}