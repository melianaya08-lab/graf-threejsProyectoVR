import * as THREE from 'three';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';

let isGamePlaying = false;

window.addEventListener('iniciarJuego', () => {
    isGamePlaying = true;
    clock.start();
});

let scene, camera, renderer, clock, mixer;
let player, floor, actions = {}, currentAction;

let gameSpeed = 35;

let obstacles = [];
let alienModel;

let currentLane = 1;
const lanes = [-4, 0, 4];

let targetX = 0;
let targetRotation = Math.PI;

let alienAnimClip;

// LOGICA DEL JUEGO
let distancia = 0;
let vida = 100;
let isGameOver = false;

// DECORACIONES
let decorations = [];

// HTML
const textoDistancia = document.getElementById('texto-distancia');
const barraVida = document.getElementById('barra-vida');
const pantallaGameOver = document.getElementById('game-over');
const puntajeFinal = document.getElementById('puntaje-final');

init();
animate();

function init() {

    scene = new THREE.Scene();

    scene.background = new THREE.Color(0xcccccc);

    scene.fog = new THREE.Fog(0xcccccc, 15, 60);

    camera = new THREE.PerspectiveCamera(
        75,
        window.innerWidth / window.innerHeight,
        0.1,
        1000
    );

    camera.position.set(0, 6, 12);

    camera.lookAt(0, 2, 0);

    renderer = new THREE.WebGLRenderer({
        antialias: true
    });

    renderer.setSize(window.innerWidth, window.innerHeight);

    renderer.shadowMap.enabled = true;

    document.getElementById('container')
    .appendChild(renderer.domElement);

    clock = new THREE.Clock();

    // LUCES
    const light = new THREE.DirectionalLight(0xffffff, 1.5);

    light.position.set(5, 10, 5);

    light.castShadow = true;

    scene.add(light);

    scene.add(new THREE.AmbientLight(0xffffff, 0.6));

    // SUELO
    const textureLoader = new THREE.TextureLoader();

    const floorMat = new THREE.MeshStandardMaterial({
        map: textureLoader.load('textures/suelo.jpg')
    });

    floorMat.map.wrapS = THREE.RepeatWrapping;
    floorMat.map.wrapT = THREE.RepeatWrapping;

    floorMat.map.repeat.set(1, 10);

    floor = new THREE.Mesh(
        new THREE.PlaneGeometry(20, 200),
        floorMat
    );

    floor.rotation.x = -Math.PI / 2;

    floor.receiveShadow = true;

    scene.add(floor);

    // HDR
    new RGBELoader()
    .setPath('textures/')
    .load('ambiente.hdr', (texture) => {

        texture.mapping =
        THREE.EquirectangularReflectionMapping;

        scene.background = texture;

        scene.environment = texture;
    });

    const loader = new FBXLoader();

    loader.setPath('assets/');

    // PLAYER
    loader.load('Running.fbx', (fbx) => {

        console.log("PLAYER CARGADO");

        player = fbx;

        player.scale.set(0.015, 0.015, 0.015);

        player.rotation.y = Math.PI;

        player.traverse(c => {

            if (c.isMesh) {
                c.castShadow = true;
            }
        });

        scene.add(player);

        targetX = lanes[currentLane];

        targetRotation = Math.PI;

        mixer = new THREE.AnimationMixer(player);

        loadAnim(loader, 'Running.fbx', 'correr', true);

        loadAnim(loader, 'BigJump.fbx', 'saltar', false);

        loadAnim(loader, 'Martelo 2.fbx', 'patada', false);
    });

    // ALIEN
    loader.load('AlienAttack.fbx', (fbx) => {

        alienModel = fbx;

        alienModel.scale.set(0.04, 0.04, 0.04);

        if (fbx.animations && fbx.animations.length > 0) {

            alienAnimClip = fbx.animations[0];
        }

        alienModel.traverse(c => {

            if (c.isMesh) {

                c.castShadow = true;

                c.geometry.computeVertexNormals();

                c.frustumCulled = true;
            }
        });

        console.log("Alien cargado correctamente");

        // SOLO 1 ALIEN
        for(let i = 0; i < 1; i++) {

            spawnObstacle();
        }

        // MENOS DECORACIONES
        for(let i = 0; i < 5; i++) {

            spawnDecoration();
        }

    }, undefined, (error) => {

        console.error("Error cargando Alien:", error);
    });

    window.addEventListener('keydown', onKeyDown);
}

function spawnObstacle() {

    if (!alienModel) return;

    const newAlien = SkeletonUtils.clone(alienModel);

    newAlien.position.x =
    lanes[Math.floor(Math.random() * 3)];

    newAlien.position.z =
    -Math.random() * 80 - 30;

    newAlien.rotation.y = 0;

    let alienMixer = null;

    if (alienAnimClip) {

        alienMixer =
        new THREE.AnimationMixer(newAlien);

        const action =
        alienMixer.clipAction(alienAnimClip);

        action.play();
    }

    newAlien.userData = {
        kicked: false,
        crashed: false,
        mixer: alienMixer
    };

    scene.add(newAlien);

    obstacles.push(newAlien);
}

function onKeyDown(event) {

    if (!player) return;

    switch (event.code) {

        case 'KeyA':

            if (currentLane > 0) {

                currentLane--;

                movePlayer();
            }

            break;

        case 'KeyD':

            if (currentLane < 2) {

                currentLane++;

                movePlayer();
            }

            break;

        case 'Space':

            fadeToAction('saltar', 0.1);

            break;

        case 'KeyK':

            fadeToAction('patada', 0.1);

            break;
    }
}

function movePlayer() {

    targetX = lanes[currentLane];

    targetRotation = Math.PI;
}

function recibirDano() {

    // 2 GOLPES = GAME OVER
    vida -= 50;

    if (vida < 0) {

        vida = 0;
    }

    barraVida.style.width = vida + '%';

    barraVida.style.backgroundColor = 'white';

    setTimeout(() => {

        barraVida.style.backgroundColor = '#ff3333';

    }, 150);

    if (vida <= 0) {

        isGameOver = true;

        pantallaGameOver.style.display = 'flex';

        puntajeFinal.innerText =
        `Metros recorridos: ${Math.floor(distancia)}`;
    }
}

function spawnDecoration() {

    const size = Math.random() * 0.4 + 0.2;

    const geometry =
    new THREE.DodecahedronGeometry(size);

    const material =
    new THREE.MeshStandardMaterial({

        color: 0x555555,
        roughness: 0.9,
        metalness: 0.1
    });

    const rock =
    new THREE.Mesh(geometry, material);

    rock.position.x =
    (Math.random() - 0.5) * 18;

    rock.position.y = size / 2;

    rock.position.z =
    -Math.random() * 150 - 20;

    rock.rotation.set(
        Math.random() * Math.PI,
        Math.random() * Math.PI,
        0
    );

    rock.castShadow = true;

    rock.receiveShadow = true;

    scene.add(rock);

    decorations.push(rock);
}

function animate() {

    requestAnimationFrame(animate);

    if (!isGamePlaying || isGameOver) {

        renderer.render(scene, camera);

        return;
    }

    const delta = clock.getDelta();

    // DISTANCIA
    distancia += (gameSpeed * delta) * 0.2;

    textoDistancia.innerText =
    `Metros: ${Math.floor(distancia)}`;

    if (mixer) mixer.update(delta);

    if (player) {

        player.position.x +=
        (targetX - player.position.x) * 10 * delta;

        player.rotation.y +=
        (targetRotation - player.rotation.y) * 10 * delta;
    }

    if (floor && floor.material.map) {

        floor.material.map.offset.y +=
        (gameSpeed * delta) / 10;
    }

    // DECORACIONES
    decorations.forEach((dec) => {

        dec.position.z += gameSpeed * delta;

        if (dec.position.z > 2) {

            dec.position.x =
            (Math.random() - 0.5) * 18;

            dec.position.z =
            -Math.random() * 80 - 50;

            dec.rotation.set(
                Math.random() * Math.PI,
                Math.random() * Math.PI,
                0
            );
        }
    });

    // ALIENS
    obstacles.forEach((obs) => {

        if (obs.userData.mixer) {

            obs.userData.mixer.update(delta);
        }

        if (!obs.userData.kicked) {

            obs.position.z +=
            (gameSpeed + 5) * delta;

            const dist =
            obs.position.distanceTo(player.position);

            if (dist < 2.5) {

                if (currentAction === actions['patada']) {

                    obs.userData.kicked = true;

                } else if (
                    currentAction !== actions['saltar']
                ) {

                    if (!obs.userData.crashed) {

                        obs.userData.crashed = true;

                        recibirDano();
                    }
                }
            }

        } else {

            obs.position.z -= 60 * delta;

            obs.position.y += 40 * delta;
        }

        if (obs.position.z > 2 || obs.position.y > 60) {

            obs.position.set(

                lanes[Math.floor(Math.random() * 3)],
                0,
                -Math.random() * 80 - 50
            );

            obs.userData.kicked = false;

            obs.userData.crashed = false;
        }
    });

    renderer.render(scene, camera);
}

function loadAnim(loader, file, name, loop) {

    loader.load(file, (anim) => {

        const action =
        mixer.clipAction(anim.animations[0]);

        if (!loop) {

            action.setLoop(THREE.LoopOnce);

            action.clampWhenFinished = true;
        }

        actions[name] = action;

        if (name === 'correr') {

            action.play();

            currentAction = action;
        }
    });
}

function fadeToAction(name, duration) {

    if (
        !actions[name] ||
        currentAction === actions[name]
    ) return;

    const prev = currentAction;

    currentAction = actions[name];

    if (prev) {

        prev.fadeOut(duration);
    }

    currentAction
    .reset()
    .fadeIn(duration)
    .play();

    if (name !== 'correr') {

        const restore = () => {

            mixer.removeEventListener(
                'finished',
                restore
            );

            fadeToAction('correr', 0.2);
        };

        mixer.addEventListener(
            'finished',
            restore
        );
    }
}