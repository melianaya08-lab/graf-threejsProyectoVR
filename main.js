import * as THREE from 'three';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import { VRButton } from 'three/addons/webxr/VRButton.js';

let isGamePlaying = false;

window.addEventListener('iniciarJuego', async () => {

    isGamePlaying = true;

    clock.start();

    try {

        if (musicaFondo && !musicaFondo.isPlaying) {
            await musicaFondo.play();
        }

    } catch(error) {

        console.log("Audio bloqueado:", error);

    }

});

let scene, camera, renderer, clock, mixer;
let player, floor, actions = {}, currentAction;

let gameSpeed = 35;

let obstacles = [];
let decorations = [];

let alienModel;
let alienAnimClip;

let playerGroup;

let currentLane = 1;

const lanes = [-4, 0, 4];

let targetX = 0;

let isKicking = false;

let isJumping = false;
let jumpVelocity = 0;

const gravity = -55;
const jumpHeight = 18;

let controllerLeft, controllerRight;
let canMoveVR = true;

let distancia = 0;
let vida = 100;
let isGameOver = false;

let listener;
let musicaFondo;
let sonidoPatada;

let hudGroup;
let hudCanvas;
let hudContext;
let hudTexture;

const posGlobalObstaculo = new THREE.Vector3();
const posGlobalJugador = new THREE.Vector3();

const textoDistancia = document.getElementById('texto-distancia');
const barraVida = document.getElementById('barra-vida');
const pantallaGameOver = document.getElementById('game-over');
const puntajeFinal = document.getElementById('puntaje-final');

init();

function init() {

    clock = new THREE.Clock(false);

    scene = new THREE.Scene();

    scene.background = new THREE.Color(0xcccccc);

    scene.fog = new THREE.Fog(0xcccccc, 15, 60);

    camera = new THREE.PerspectiveCamera(
        75,
        window.innerWidth / window.innerHeight,
        0.1,
        1000
    );

    renderer = new THREE.WebGLRenderer({
        antialias: true
    });

    renderer.setSize(window.innerWidth, window.innerHeight);

    renderer.shadowMap.enabled = true;

    renderer.xr.enabled = true;

    document.body.appendChild(
        VRButton.createButton(renderer, {
            optionalFeatures: [
                'local-floor',
                'bounded-floor',
                'dom-overlay'
            ],
            domOverlay: {
                root: document.getElementById('container')
            }
        })
    );

    document.getElementById('container')
        .appendChild(renderer.domElement);

    playerGroup = new THREE.Group();


    playerGroup.position.set(0, -2, 12);

    scene.add(playerGroup);

    camera.position.set(0, 5, 0.2);

    playerGroup.add(camera);

    //recorrido y barra de vida
    // =======================
    // HUD VR
    // =======================

    hudCanvas = document.createElement('canvas');
    hudCanvas.width = 512;
    hudCanvas.height = 256;

    hudContext = hudCanvas.getContext('2d');

    hudTexture = new THREE.CanvasTexture(hudCanvas);

    const hudMaterial = new THREE.MeshBasicMaterial({
        map: hudTexture,
        transparent: true
    });

    const hudGeometry = new THREE.PlaneGeometry(2, 1);

    const hudMesh = new THREE.Mesh(hudGeometry, hudMaterial);

    hudGroup = new THREE.Group();

    hudMesh.position.set(0, 1.5, -3);
    //hudMesh.position.set(0, 0, -2);

    hudGroup.add(hudMesh);

    camera.add(hudGroup);

    // LUCES

    const light = new THREE.DirectionalLight(
        0xffffff,
        1.5
    );

    light.position.set(5, 10, 5);

    light.castShadow = true;

    scene.add(light);

    scene.add(
        new THREE.AmbientLight(0xffffff, 0.6)
    );

    // SUELO

    const textureLoader = new THREE.TextureLoader();

    const floorMat = new THREE.MeshStandardMaterial({

        map: textureLoader.load(
            'textures/suelo_obscuro.jpg'
        )

    });

    floorMat.map.wrapS =
    floorMat.map.wrapT =
        THREE.RepeatWrapping;

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

    // LOADER

    const loader = new FBXLoader();

    loader.setPath('./assets/');

    // AUDIO

    listener = new THREE.AudioListener();

    camera.add(listener);

    musicaFondo = new THREE.Audio(listener);

    window.musicaFondo = musicaFondo;

    const audioLoader = new THREE.AudioLoader();

    audioLoader.load('assets/audio.mp3', (buffer) => {

        musicaFondo.setBuffer(buffer);

        musicaFondo.setLoop(true);

        musicaFondo.setVolume(0.8);

    });

    sonidoPatada = new THREE.Audio(listener);

    audioLoader.load('assets/patada.mp3', (buffer) => {

        sonidoPatada.setBuffer(buffer);

        sonidoPatada.setVolume(0.6);

    });

    // PLAYER

    loader.load('Running.fbx', (fbx) => {

        player = fbx;

        player.scale.set(
            0.015,
            0.015,
            0.015
        );

        player.position.set(
            -0.04,
            0,
            0.87
        );

        player.rotation.y = Math.PI;

        player.traverse(c => {

            if (c.isMesh)
                c.castShadow = true;

        });

        playerGroup.add(player);

        targetX = lanes[currentLane];

        mixer = new THREE.AnimationMixer(player);

        loadAnim(loader, 'Running.fbx', 'correr', true);

        loadAnim(loader, 'BigJump.fbx', 'saltar', false);

        loadAnim(loader, 'Martelo2.fbx', 'patada', false);

    });

    // ALIEN

    loader.load('AlienAttack.fbx', (fbx) => {

        alienModel = fbx;

        alienModel.scale.set(
            0.025,
            0.025,
            0.025
        );

        if (
            fbx.animations &&
            fbx.animations.length > 0
        ) {

            alienAnimClip = fbx.animations[0];

        }

        alienModel.traverse(c => {

            if (c.isMesh) {

                c.castShadow = true;

                c.geometry.computeVertexNormals();

                c.frustumCulled = false;

            }

        });

        spawnObstacle();

        setTimeout(() => {

            if (isGamePlaying && !isGameOver)
                spawnObstacle();

        }, 2000);

        setTimeout(() => {

            if (isGamePlaying && !isGameOver)
                spawnObstacle();

        }, 4000);

        for(let i = 0; i < 2; i++) {

            spawnDecoration();

        }

    });

    window.addEventListener('keydown', onKeyDown);

    // CONTROLES VR

    controllerLeft = renderer.xr.getController(0);

    scene.add(controllerLeft);

    controllerRight = renderer.xr.getController(1);

    scene.add(controllerRight);

    renderer.xr.setReferenceSpaceType('local-floor');

    controllerRight.addEventListener(
        'selectstart',
        () => {

            fadeToAction('patada', 0.1);

        }
    );

    controllerLeft.addEventListener(
        'selectstart',
        () => {

            fadeToAction('saltar', 0.1);

        }
    );

    renderer.setAnimationLoop(animate);

}

function spawnObstacle() {

    if (!alienModel) return;

    const newAlien =
        SkeletonUtils.clone(alienModel);

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
        mixer: alienMixer,
        crashed: false

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

}

function recibirDano() {

    vida -= 25;

    barraVida.style.width = vida + '%';

    barraVida.style.backgroundColor = 'white';

    setTimeout(() => {

        barraVida.style.backgroundColor = '#ff3333';

    }, 150);

    if (vida <= 0) {

        isGameOver = true;

        // Salir de VR automáticamente
        const session = renderer.xr.getSession();

        if (session) {

            session.end();

        }

        pantallaGameOver.style.display = 'flex';

        puntajeFinal.innerText =
            `Metros recorridos: ${Math.floor(distancia)}`;

        if (musicaFondo && musicaFondo.isPlaying) {

            musicaFondo.stop();

        }
    }

}

function spawnDecoration() {

    const size = 0.6;

    const geometry =
        new THREE.DodecahedronGeometry(size);

    const material =
        new THREE.MeshStandardMaterial({

            color: 0x555555,
            roughness: 0.9,
            metalness: 0.1

        });

    const rock = new THREE.Mesh(
        geometry,
        material
    );

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

function actualizarHUDVR() {

    if (!hudContext) return;

    // Fondo transparente
    hudContext.clearRect(0, 0, 512, 256);

    // Fondo negro semi transparente
    hudContext.fillStyle = "rgba(0,0,0,0.6)";
    hudContext.fillRect(20, 20, 470, 120);

    // Texto
    hudContext.fillStyle = "white";
    hudContext.font = "40px Arial";

    hudContext.fillText(
        "Metros: " + Math.floor(distancia),
        40,
        80
    );

    // Barra vida
    hudContext.fillStyle = "gray";
    hudContext.fillRect(40, 120, 300, 30);

    hudContext.fillStyle = "red";
    hudContext.fillRect(40, 120, vida * 3, 30);

    hudTexture.needsUpdate = true;
}

function handleVRInput() {

    const session =
        renderer.xr.getSession();

    if (!session) return;

    for (const source of session.inputSources) {

        if (!source.gamepad) continue;

        const axes = source.gamepad.axes;

        const stickX = axes[2] || axes[0];

        if (Math.abs(stickX) > 0.5) {

            if (
                stickX < -0.5 &&
                currentLane > 0
            ) {

                currentLane--;

                movePlayer();

                canMoveVR = false;

                setTimeout(() => {

                    canMoveVR = true;

                }, 300);

            }

            else if (
                stickX > 0.5 &&
                currentLane < 2
            ) {

                currentLane++;

                movePlayer();

                canMoveVR = false;

                setTimeout(() => {

                    canMoveVR = true;

                }, 300);

            }

        }

    }

}

function animate() {

    if (!isGamePlaying || isGameOver) {

        renderer.render(scene, camera);

        return;

    }

    if (
        renderer.xr.isPresenting &&
        canMoveVR
    ) {

        handleVRInput();

    }

    const delta = clock.getDelta();

    distancia +=
        (gameSpeed * delta) * 0.2;

    textoDistancia.innerText =
        `Metros: ${Math.floor(distancia)}`;

        actualizarHUDVR();

    if (mixer)
        mixer.update(delta);

    // MOVIMIENTO

    if (player) {

        playerGroup.position.x +=
            (targetX - playerGroup.position.x)
            * 10 * delta;

        // SALTO

        if (isJumping) {

            playerGroup.position.y +=
                jumpVelocity * delta;

            jumpVelocity +=
                gravity * delta;

            if (
                playerGroup.position.y <= 0
            ) {

                playerGroup.position.y = 0;

                isJumping = false;

                jumpVelocity = 0;

            }

        }

    }

    // SUELO

    if (
        floor &&
        floor.material.map
    ) {

        floor.material.map.offset.y +=
            (gameSpeed * delta) / 10;

    }

    // DECORACIONES

    decorations.forEach((dec) => {

        dec.position.z +=
            gameSpeed * delta;

        if (
            dec.position.z >
            playerGroup.position.z + 5
        ) {

            dec.position.x =
                (Math.random() - 0.5) * 18;

            dec.position.z =
                playerGroup.position.z - 100;

            dec.rotation.set(
                Math.random() * Math.PI,
                Math.random() * Math.PI,
                0
            );

        }

    });

    // OBSTÁCULOS

    obstacles.forEach((obs) => {

        if (obs.userData.mixer)
            obs.userData.mixer.update(delta);

        if (!obs.userData.kicked) {

            obs.position.z +=
                (gameSpeed + 5) * delta;

            obs.getWorldPosition(
                posGlobalObstaculo
            );

            player.getWorldPosition(
                posGlobalJugador
            );

            const distX = Math.abs(
                posGlobalObstaculo.x -
                posGlobalJugador.x
            );

            const distY = Math.abs(
                posGlobalObstaculo.y -
                posGlobalJugador.y
            );

            const distZ = Math.abs(
                posGlobalObstaculo.z -
                posGlobalJugador.z
            );

            if (

                distX < 1.5 &&
                distY < 2.5 &&
                distZ < 1.8

            ) {

                if (isKicking) {

                    obs.userData.kicked = true;

                }

                else if (!isJumping) {

                    if (!obs.userData.crashed) {

                        obs.userData.crashed = true;

                        recibirDano();

                    }

                }

            }

        }

        else {

            obs.position.z -= 60 * delta;

            obs.position.y += 40 * delta;

        }

        if (
            obs.position.z >
            playerGroup.position.z + 5 ||

            obs.position.y > 60
        ) {

            obs.position.set(

                lanes[Math.floor(Math.random() * 3)],

                0,

                playerGroup.position.z - 80

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

    if (prev)
        prev.fadeOut(duration);

    currentAction
        .reset()
        .fadeIn(duration)
        .play();

    // PATADA

    if (name === 'patada') {

        isKicking = true;

        if (sonidoPatada) {

            if (sonidoPatada.isPlaying)
                sonidoPatada.stop();

            sonidoPatada.play();

        }

    }

    // SALTO

    if (
        name === 'saltar' &&
        !isJumping
    ) {

        isJumping = true;

        jumpVelocity = jumpHeight;

    }

    if (name !== 'correr') {

        const restore = () => {

            mixer.removeEventListener(
                'finished',
                restore
            );

            if (name === 'patada') {

                isKicking = false;

            }

            fadeToAction('correr', 0.2);

        };

        mixer.addEventListener(
            'finished',
            restore
        );

    }

}