// physics dependencies
Physijs.scripts.worker = 'physijs_worker.js';
Physijs.scripts.ammo = 'js/ammo.js';

// loaders
let modelLoader;
let textureLoader;

// world
let brickMaterial;
let ground;
let light;

// main object
let vehicle;

// keyboard
let ioInput;

// 3D helpers
let renderer;
let scene;
let camera;

function bindInputEvents(input) {
  document.addEventListener('keydown', function(ev) {
    switch (ev.keyCode) {
      case 37: // left
        input.direction = 1;
        break;

      case 38: // forward
        input.power = true;
        break;

      case 39: // right
        input.direction = -1;
        break;

      case 40: // back
        input.power = false;
        break;
    }
  });

  document.addEventListener('keyup', function(ev) {
    switch (ev.keyCode) {
      case 37: // left
        input.direction = null;
        break;

      case 38: // forward
        input.power = null;
        break;

      case 39: // right
        input.direction = null;
        break;

      case 40: // back
        input.power = null;
        break;
    }
  });
}

function initScene() {
  // Init renderer
  renderer = new THREE.WebGLRenderer();
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMapSoft = true;
  renderer.setClearColor(0xffffff, 1);

  // add 3d renderer to dom
  document.getElementById('viewport').appendChild(renderer.domElement);
  
  // add time view to dom
  const timeDom = document.createElement('DIV');
  timeDom.id = 'time';
  timeDom.style = "position: fixed; top: 100px; left: 100px";
  document.getElementById('viewport').appendChild(timeDom);

  // add distance to dom
  const distanceNode = document.createElement('DIV');
  distanceNode.id = 'distance';
  distanceNode.style = "position: fixed; top: 130px; left: 100px";
  document.getElementById('viewport').appendChild(distanceNode);

  // Init scene
  scene = new Physijs.Scene();
  scene.setGravity(new THREE.Vector3(0, -30, 0));
  scene.background = new THREE.Color(0x440000);
  scene.addEventListener('update', function() {
    if (ioInput && vehicle) {
      if (ioInput.direction !== null) {
        ioInput.steering += ioInput.direction / 50;
        if (ioInput.steering < -0.6) ioInput.steering = -0.6;
        if (ioInput.steering > 0.6) ioInput.steering = 0.6;
      }
      vehicle.setSteering(ioInput.steering, 0);
      vehicle.setSteering(ioInput.steering, 1);

      if (ioInput.power === true) {
        vehicle.applyEngineForce(300);
      } else if (ioInput.power === false) {
        vehicle.setBrake(20, 2);
        vehicle.setBrake(20, 3);
      } else {
        vehicle.applyEngineForce(0);
      }
    }

    scene.simulate(undefined, 2);
  });

  // Init camera
  camera = new THREE.PerspectiveCamera(
    35,
    window.innerWidth / window.innerHeight,
    1,
    10000,
  );
  scene.add(camera);

  // Init light
  light = new THREE.DirectionalLight(0xffffff);
  light.position.set(40, 40, -20);
  light.target.position.copy(scene.position);
  scene.add(light);

  textureLoader = new THREE.TextureLoader();

  const groundTexture = textureLoader.load('images/road.jpeg');
  groundTexture.wrapS = THREE.RepeatWrapping;
  groundTexture.wrapT = THREE.RepeatWrapping;
  groundTexture.repeat.set(1, 40);

  // Init ground
  const groundGeometry = new THREE.PlaneGeometry(50, 50000);
  const groundMaterial = Physijs.createMaterial(
    new THREE.MeshLambertMaterial({
      map: groundTexture,
    }),
    0.8, // high friction
    0.4, // low restitution
  );
  groundMaterial.map.repeat.set(1, 500);

  // Add physijs ground
  ground = new Physijs.HeightfieldMesh(
    groundGeometry,
    groundMaterial,
    0, // mass
  );

  ground.rotation.x = -Math.PI / 2;
  ground.rotation.z = 0.8;

  scene.add(ground);

  // Init bricks
  brickMaterial = Physijs.createMaterial(
    new THREE.MeshLambertMaterial({
      map: textureLoader.load('images/brick.png'),
    }),
    0.4, // low friction
    0.6, // high restitution
  );

  brickMaterial.map.repeat.set(0.25, 0.25);
  for (i = 0; i < 5; i++) {
    brickCreator(brickMaterial);
  }

  // Init model
  modelLoader = new THREE.JSONLoader();

  modelLoader.load('models/mustang.js', function(car, materials) {
    modelLoader.load('models/mustang_wheel.js', function(
      wheel,
      wheelMaterials,
    ) {
      let mesh = new Physijs.BoxMesh(
        car,
        new THREE.MeshFaceMaterial(materials),
      );
      mesh.position.y = 2;
      mesh.castShadow = mesh.receiveShadow = true;

      vehicle = new Physijs.Vehicle(
        mesh,
        new Physijs.VehicleTuning(10.88, 1.83, 0.28, 500, 10.5, 6000),
      );
      vehicle.mesh.rotation.y = 3.9;

      scene.add(vehicle);

      let wheelMaterial = new THREE.MeshFaceMaterial(wheelMaterials);

      for (let i = 0; i < 4; i++) {
        vehicle.addWheel(
          wheel,
          wheelMaterial,
          new THREE.Vector3(i % 2 === 0 ? -1.6 : 1.6, -1, i < 2 ? 3.3 : -3.2),
          new THREE.Vector3(0, -1, 0),
          new THREE.Vector3(-1, 0, 0),
          0.5,
          0.7,
          i < 2 ? false : true,
        );
      }

      ioInput = {
        steering: 0,
        power: null,
        direction: null,
      };

      bindInputEvents(ioInput);
    });
  });

  setInterval(updateGameObjects, 1000);
  requestAnimationFrame(render);
  scene.simulate();
}

function updatePlayMeta() {
  // update game time
  const time = performance.now() / 1000;
  document.getElementById('time').innerHTML = 'Time: ' + time.toFixed(3);

  const distance = -1*vehicle.mesh.position.x;
  document.getElementById('distance').innerHTML = 'Distance: ' + distance.toFixed(3);
}

function updateGameObjects() {
  const randomBricks = Math.floor(Math.random() * 3) + 1;
  for (let i = 0; i < randomBricks; i++) {
    brickCreator(brickMaterial);
  }

}

function brickCreator(brickMaterial) {
  if (!vehicle) return;

  const { x, y, z } = vehicle.mesh.position;

  let size = Math.random() * 2 + 1.5;
  let brick = new Physijs.BoxMesh(
    new THREE.BoxGeometry(size, size, size),
    brickMaterial,
  );
  brick.castShadow = brick.receiveShadow = true;
  brick.position.set(
    x + Math.random() * 25 - 50,
    y + 5,
    z + Math.random() * 25 - 50,
  );
  scene.add(brick);
}

function render() {
  requestAnimationFrame(render);
  if (vehicle) {
    const { x, y, z } = vehicle.mesh.position;

    camera.position.set(x + 50, y + 20, z + 50);
    camera.lookAt(vehicle.mesh.position);
  }
  
  updatePlayMeta();
  renderer.render(scene, camera);
}

window.onload = initScene;
