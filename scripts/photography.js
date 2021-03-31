window.addEventListener("load", () => {
  let galleryState = {
    fullscreen: false, //disable scrolling etc
    planeIndex: 0,
    plane: undefined, //selected Plane
  }
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
      planesDeformations = curtains.lerp(planesDeformations, limit(delta.y, -40, 40), 0.15);
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
    if (galleryState.fullscreen)
      makePlaneFullscreenSize(galleryState.plane)
  });
  console.log(curtains);

  // we will keep track of all our planes in an array
  const planes = [];
  let planesDeformations = 0, chromaDelta = 0;
  let planeElements = document.getElementsByClassName("plane");

  //shaders
  const vs = `
      precision mediump float;
  
      // default mandatory variables
      attribute vec3 aVertexPosition;
      attribute vec2 aTextureCoord;
  
      uniform mat4 uMVMatrix;
      uniform mat4 uPMatrix;
  
      uniform mat4 planeTextureMatrix;
  
      // custom variables
      varying vec3 vVertexPosition;
      varying vec2 vTextureCoord;
  
      uniform float uPlaneDeformation;
      
  
      void main() {
          vec3 vertexPosition = aVertexPosition;
  
          // cool effect on scroll
          vertexPosition.y += sin(((.5*vertexPosition.x - .5) / 2.0) * 3.141592) * (sin(-uPlaneDeformation / 90.0));
          gl_Position = uPMatrix * uMVMatrix * vec4(vertexPosition, 1.0);
  
          // varyings
          vVertexPosition = vertexPosition;
          vTextureCoord = (planeTextureMatrix * vec4(aTextureCoord, 0.0, 1.0)).xy;
      }
  `;

  const fs = `
      precision mediump float;
  
      varying vec3 vVertexPosition;
      varying vec2 vTextureCoord;

      uniform float delta;
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
          float c = circle(vTextureCoord, uMouse+1., 120., 180.);
        	float c1 = texture2D( planeTexture, vTextureCoord - vec2( 0.02, .05 )  * delta + c * (uVelocity * .05)).r;
        	float c2 = texture2D( planeTexture, vTextureCoord + c * (uVelocity * .125)).g;
        	float c3 = texture2D( planeTexture, vTextureCoord + vec2( 0.02, .05 ) * delta + c * (uVelocity * .2)).b;
	
          // red and blue version
          //float c1 = texture2D( planeTexture, vTextureCoord - vec2( 0.02, .05 )  * delta + c * (uVelocity * .1)).r;
        	//float c2 = texture2D( planeTexture, vTextureCoord + vec2( 0.02, .05 ) * delta + c * (uVelocity * .25)).g;
        	//float c3 = texture2D( planeTexture, vTextureCoord + vec2( 0.02, .05 ) * delta + c * (uVelocity * .25)).b;
	

        	gl_FragColor = vec4( c1, c2, c3, 1.);
      }
  `;
  // all planes will have the same parameters

  const mouse = new Vec2();
  const lastMouse = mouse.clone();
  const velocity = new Vec2();

  const params = {
    vertexShader: vs,
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
        name: "delta",
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

  function makePlaneFullscreenSize(plane) {
    const newScale = new Vec2();
    const newTranslation = new Vec3();
    const planeBBox = plane.getBoundingRect();
    plane.setTransformOrigin(newTranslation);

    let scaleX = curtainsBBox.width / planeBBox.width
    let scaleY = curtainsBBox.height / planeBBox.height
    let minScale = Math.min(scaleY, scaleX)
    let translationX = -1 * planeBBox.left / curtains.pixelRatio
    let translationY = -1 * planeBBox.top / curtains.pixelRatio

    // plane scale
    newScale.set(minScale, minScale);
    plane.setScale(newScale);

    // plane translation
    newTranslation.set(translationX, translationY, 0);
    plane.setRelativeTranslation(newTranslation);
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
    }).onRender(() => {
      // update the uniform
      plane.uniforms.planeDeformation.value = planesDeformations;
      plane.uniforms.delta.value = chromaDelta;
      plane.uniforms.uMouse.value = plane.mouseToPlaneCoords(mouse)
      plane.uniforms.uVelocity.value = velocity
      plane.uniforms.resolution.value = [plane.getBoundingRect().width, plane.getBoundingRect().height]
    })

    //enter gallery view when clicked
    plane.htmlElement.addEventListener("click", (e) => {
      e.stopPropagation();
      enterGallery(plane, index)
    });
  }

  function enterGallery(plane, index) {
    if (galleryState.fullscreen)
      exitGallery()
    console.log('entering fullscreen', plane);
    galleryState.fullscreen = true
    galleryState.planeIndex = index
    galleryState.plane = plane

    makePlaneFullscreenSize(plane)

    if (!document.body.classList.contains('is-fullscreen'))
      document.body.classList.toggle('is-fullscreen')

    for (const otherplane of planes) {
      if (otherplane.uuid != plane.uuid)
        otherplane.visible = false
    }
  }

  function exitGallery() {
    console.log('exiting fullscreen');
    for (const plane of planes) {
      if (galleryState.plane.uuid == plane.uuid) {
        plane.setScale(new Vec2(1, 1));
        plane.setRelativeTranslation(new Vec3(0, 0, 0));
      }
      plane.visible = true
    }
    if (document.body.classList.contains('is-fullscreen'))
      document.body.classList.toggle('is-fullscreen')
  }

  function setGalleryIndex(newIndex) {
    newIndex = newIndex % planes.length
    if (newIndex < 0)
      newIndex = planes.length - 1
    exitGallery()
    enterGallery(planes[newIndex], newIndex)
  }

  // mouse/touch move
  function onMouseMove(e) {
    // velocity is our mouse position minus our mouse last position
    lastMouse.copy(mouse);

    // touch event
    if (!e.targetTouches)
      mouse.set(e.clientX, e.clientY);

    let targetVelocity = [(mouse.x - lastMouse.x) / 16, (mouse.y - lastMouse.y) / 16];

    velocity.x = curtains.lerp(velocity.x, targetVelocity[0], 0.05)
    velocity.y = curtains.lerp(velocity.y, targetVelocity[1], 0.05)
  }

  window.addEventListener("mousemove", onMouseMove);
  window.addEventListener("click", () => {
    if (galleryState.fullscreen)
      exitGallery()
  });
  document.addEventListener('keydown', function (e) {
    if (galleryState.fullscreen)
      switch (e.key) {
        case 'ArrowRight':
        case 'ArrowUp':

          setGalleryIndex(galleryState.planeIndex + 1)
          break;
        case 'ArrowLeft':
        case 'ArrowDown':
          setGalleryIndex(galleryState.planeIndex - 1)
          break;
      }
  });

});