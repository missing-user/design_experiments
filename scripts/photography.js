window.addEventListener("load", () => {

  // set up our WebGL context and append the canvas to our wrapper
  const curtains = new Curtains({
    container: "canvas",
    pixelRatio: Math.min(1.5, window.devicePixelRatio) // limit pixel ratio for performance
  });

  curtains.onRender(() => {
    // update our planes deformation
    // increase/decrease the effect
    planesDeformations = curtains.lerp(planesDeformations, 0, 0.075);
    chromaDelta = curtains.lerp(chromaDelta, 0, .05);
  }).onScroll(() => {
    // get scroll deltas to apply the effect on scroll
    const delta = curtains.getScrollDeltas();

    // invert value for the effect
    delta.y = delta.y;

    // threshold
    if (delta.y > 40) {
      delta.y = 40;
    }
    else if (delta.y < -40) {
      delta.y = -40;
    }

    if (Math.abs(delta.y) > Math.abs(planesDeformations)) {
      planesDeformations = curtains.lerp(planesDeformations, delta.y, 0.05);
    }
    if (Math.abs(delta.y) > Math.abs(chromaDelta)) {
      chromaDelta = curtains.lerp(chromaDelta, delta.y, .05);
    }
  }).onError(() => {
    // we will add a class to the document body to display original images
    document.body.classList.add("no-curtains", "planes-loaded");
  }).onContextLost(() => {
    // on context lost, try to restore the context
    curtains.restoreContext();
  });

  // we will keep track of all our planes in an array
  const planes = [];
  let planesDeformations = 0, chromaDelta = 0;

  // get our planes elements
  let planeElements = document.getElementsByClassName("plane");

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
          vertexPosition.y += sin(((vertexPosition.x + 1.0) / 2.0) * 3.141592) * (sin(uPlaneDeformation / 90.0));
  
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
      uniform float uVelo;
      
      
      float circle(vec2 vUv, vec2 disc_center, float disc_radius, float border_size) {
        vec2 uv = vUv;
        uv -= disc_center;
        uv *= uResolution;
        float dist = sqrt(dot(uv, uv));
        return smoothstep(disc_radius+border_size, disc_radius-border_size, dist);
      }

      void main() {
          float c = circle(vTextureCoord, uMouse, 200.0, 200.);
        	float c1 = texture2D( planeTexture, vTextureCoord - vec2( .05 )  * delta + c * (uVelocity * .05)).r;
        	float c2 = texture2D( planeTexture, vTextureCoord + c * (uVelocity * .065)).g;
        	float c3 = texture2D( planeTexture, vTextureCoord + vec2( .05 ) * delta + c * (uVelocity * .08)).b;
	
        	gl_FragColor = vec4( c1, c2, c3, 1.);
      }
  `;
  // all planes will have the same parameters

  const mouse = new Vec2();
  const lastMouse = mouse.clone();
  const velocity = new Vec2();
  let curtainsBBox = curtains.getBoundingRect();

  const params = {
    vertexShader: vs,
    fragmentShader: fs,
    widthSegments: 10,
    heightSegments: 10,
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
      uVelo: {
        name: "uVelo",
        type: "1f",
        value: 0,
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
    }).onRender(() => {
      // update the uniform
      plane.uniforms.planeDeformation.value = planesDeformations;
      plane.uniforms.delta.value = chromaDelta / 20;
      plane.uniforms.uVelo.value = chromaDelta;
      plane.uniforms.uMouse.value = plane.mouseToPlaneCoords(mouse)
      plane.uniforms.uVelocity.value = velocity
      plane.uniforms.resolution.value = [1000, 1500]
    })
    /*plane.onResize(() => {
      curtainsBBox = curtains.getBoundingRect();
    });*/
  }

  // mouse/touch move
  function onMouseMove(e) {
    // velocity is our mouse position minus our mouse last position
    lastMouse.copy(mouse);

    // touch event
    if (e.targetTouches) {
      mouse.set(e.targetTouches[0].clientX, e.targetTouches[0].clientY);
    } else {
      mouse.set(e.clientX, e.clientY);
    }

    // divided by a frame duration (roughly)
    velocity.set((mouse.x - lastMouse.x) / 16, (mouse.y - lastMouse.y) / 16);
  }

  window.addEventListener("mousemove", onMouseMove);
  window.addEventListener("touchmove", onMouseMove, {
    passive: true
  });
});