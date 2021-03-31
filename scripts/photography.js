window.addEventListener("load", () => {
  // set up our WebGL context and append the canvas to our wrapper
  const curtains = new Curtains({
    container: "canvas",
    pixelRatio: Math.min(1.5, window.devicePixelRatio) // limit pixel ratio for performance
  });
  let curtainsBBox = curtains.getBoundingRect();


  function limit(input, min, max) {
    return Math.min(Math.max(input, min), max)
  }


  curtains.onRender(() => {
    planesDeformations = curtains.lerp(planesDeformations, 0, 0.075);
    chromaDelta = curtains.lerp(chromaDelta, 0, .04);
    velocity.x = curtains.lerp(velocity.x, 0, 0.02)
    velocity.y = curtains.lerp(velocity.y, 0, 0.02)
  }).onScroll(() => {
    // get scroll deltas to apply the effect on scroll
    const delta = curtains.getScrollDeltas();
    if (Math.abs(delta.y) > Math.abs(planesDeformations)) {
      planesDeformations = curtains.lerp(planesDeformations, limit(delta.y, -20, 20), 0.1);
    }
    if (Math.abs(delta.y) > Math.abs(chromaDelta)) {
      chromaDelta = curtains.lerp(chromaDelta, limit(delta.y, -10, 10) / 10, 0.05);
    }
  }).onError(() => {
    // we will add a class to the document body to display original images
    document.body.classList.add("no-curtains", "planes-loaded");
  }).onContextLost(() => {
    // on context lost, try to restore the context
    curtains.restoreContext();
  }).onAfterResize(() => {
    curtainsBBox = curtains.getBoundingRect();
    gallery.resize()
  });

  // we will keep track of all our planes in an array
  const planes = [];
  let planesDeformations = 0, chromaDelta = 0;
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

      void main() {
          float c = circle(vTextureCoord, uMouse+1., .1, .25);
          
        	float c1 = texture2D( planeTexture, vTextureCoord - vec2( 0.02, .05 ) * uScrollDelta - c * (uVelocity * .05)).r;
        	float c2 = texture2D( planeTexture, vTextureCoord ).g;
          float c3 = texture2D( planeTexture, vTextureCoord + vec2( 0.02, .05 ) * uScrollDelta + c * (uVelocity * .05)).b;
	
          // red and blue version
          //float c1 = texture2D( planeTexture, vTextureCoord - vec2( 0.02, .05 )  * uScrollDelta + c * (uVelocity * .1)).r;
        	//float c2 = texture2D( planeTexture, vTextureCoord + vec2( 0.02, .05 ) * uScrollDelta + c * (uVelocity * .25)).g;
        	//float c3 = texture2D( planeTexture, vTextureCoord + vec2( 0.02, .05 ) * uScrollDelta + c * (uVelocity * .25)).b;
	

        	gl_FragColor = vec4( c1, c2, c3, 1.);
      }
  `;
  // all planes will have the same parameters

  const mouse = new Vec2();
  const lastMouse = mouse.clone();
  const velocity = new Vec2();

  const params = {
    fragmentShader: fs,
    widthSegments: 10,
    heightSegments: 4,
    fov: 45,
    drawCheckMargins: {
      top: 100,
      right: 0,
      bottom: 100,
      left: 0,
    },
    uniforms: {
      planeDeformation: {
        name: "uPlaneDeformation",
        type: "1f",
        value: 0,
      },
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
      plane.uniforms.planeDeformation.value = planesDeformations;
      plane.uniforms.delta.value = chromaDelta;
      plane.uniforms.uMouse.value = plane.mouseToPlaneCoords(mouse)
      plane.uniforms.uVelocity.value = velocity
    })

    //enter gallery view when clicked
    plane.htmlElement.addEventListener("click", (e) => {
      e.stopPropagation();
      gallery.enter(index)
    });
  }

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

    velocity.x = curtains.lerp(velocity.x, targetVelocity[0], 0.05)
    velocity.y = curtains.lerp(velocity.y, targetVelocity[1], 0.05)
  }

  window.addEventListener("mousemove", onMouseMove);
  window.addEventListener("touchmove", onMouseMove);

  let gallery = new GLSLgallery(curtains)
});

class GLSLgallery {
  constructor(curtains) {
    this.curtains = curtains
    this.planes = curtains.planes
    this.bbox = this.curtains.getBoundingRect();
    this.state = {
      fullscreen: false, //disable scrolling etc
      planeIndex: 0
    }

    const galleryRef = this
    window.addEventListener("click", () => {
      if (galleryRef.state.fullscreen)
        galleryRef.exit()
    });
    document.addEventListener('keydown', function (e) {
      if (galleryRef.state.fullscreen)
        switch (e.key) {
          case 'ArrowRight':
          case 'ArrowUp':
            galleryRef.setIndex(galleryRef.state.planeIndex + 1)
            break;
          case 'ArrowLeft':
          case 'ArrowDown':
            galleryRef.setIndex(galleryRef.state.planeIndex - 1)
            break;
        }
    });
  }

  makePlaneFullscreenSize(index) {
    const plane = this.planes[index]
    const newScale = new Vec2();
    const newTranslation = new Vec3();
    const planeBBox = plane.getBoundingRect();
    plane.setTransformOrigin(newTranslation);

    let scaleX = this.bbox.width / planeBBox.width
    let scaleY = this.bbox.height / planeBBox.height
    let minScale = Math.min(scaleY, scaleX)
    let translationX = -1 * planeBBox.left / this.curtains.pixelRatio
    let translationY = -1 * planeBBox.top / this.curtains.pixelRatio

    // plane scale
    newScale.set(minScale, minScale);
    plane.setScale(newScale);

    // plane translation
    newTranslation.set(translationX, translationY, 0);
    plane.setRelativeTranslation(newTranslation);
  }

  enter(index) {
    if (this.state.fullscreen)
      this.exit()
    console.log('entering fullscreen');
    this.state.fullscreen = true
    this.state.planeIndex = index

    this.makePlaneFullscreenSize(index)

    if (!document.body.classList.contains('is-fullscreen'))
      document.body.classList.toggle('is-fullscreen')

    for (const otherplane of this.planes) {
      if (otherplane.uuid != this.planes[index].uuid)
        otherplane.visible = false
    }
  }

  resize() {
    this.bbox = this.curtains.getBoundingRect();
    if (this.state.fullscreen)
      this.makePlaneFullscreenSize(this.state.planeIndex)
  }

  exit() {
    console.log('exiting fullscreen');
    for (const plane of this.planes) {
      if (this.planes[this.state.planeIndex].uuid == plane.uuid) {
        plane.setScale(new Vec2(1, 1));
        plane.setRelativeTranslation(new Vec3(0, 0, 0));
      }
      plane.visible = true
    }
    if (document.body.classList.contains('is-fullscreen'))
      document.body.classList.toggle('is-fullscreen')
  }

  setIndex(newIndex) {
    newIndex = newIndex % this.planes.length
    if (newIndex < 0)
      newIndex = this.planes.length - 1
    this.exit()
    this.enter(newIndex)
  }
}