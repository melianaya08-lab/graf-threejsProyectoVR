import * as THREE from 'three';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import { VRButton } from 'three/addons/webxr/VRButton.js';

let scene, camera, renderer, clock, mixer;

let player;
let floor;

let actions = {};
let currentAction;

let obstacles = [];
let decorations = [];

let alienModel;
let alienAnimClip;

let playerGroup;

let gameSpeed = 35;

let currentLane = 1;
const lanes = [-4, 0, 4];

let targetX = 0;

let isKicking = false;

let controllerLeft;
let controllerRight;
let canMoveVR = true;

let distancia = 0;
let vida = 100;

let isGameOver = false;
let isGamePlaying = false;

let listener;
let musicaFondo;
let sonidoPatada;

let hudCanvas;
let hudContext;
let hudTexture;
let hudMesh;
let hudGroup;

const posGlobalObstaculo = new THREE.Vector3();
const posGlobalJugador = new THREE.Vector3();

const pantallaGameOver = document.getElementById('game-over');
const puntajeFinal = document.getElementById('puntaje-final');

window.addEventListener('iniciarJuego', () => {

    isGamePlaying = true;

    clock.start();

    if (musicaFondo && !musicaFondo.isPlaying) {
        musicaFondo.play();
    }

});

init();

function init() {

    clock = new THREE.Clock();

    scene = new THREE.Scene();

    scene.background = new THREE.Color(0x000000);

    scene.fog = new THREE.Fog(0x000000, 15, 80);

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
        VRButton.createButton(renderer)
    );

    document.getElementById('container')
        .appendChild(renderer.domElement);

    playerGroup = new THREE.Group();

    playerGroup.position.set(0, 0, 12);

    scene.add(playerGroup);

    // CAMARA
    camera.position.set(0, 1.6, 0);

    playerGroup.add(camera);

    // HUD VR
    hudCanvas = document.createElement('canvas');

    hudCanvas.width = 1024;
    hudCanvas.height = 512;

    hudContext = hudCanvas.getContext('2d');

    hudTexture = new THREE.CanvasTexture(hudCanvas);

    const hudMaterial = new THREE.MeshBasicMaterial({
        map: hudTexture,
        transparent: true
    });

    const hudGeometry = new THREE.PlaneGeometry(1.2, 0.6);

    hudMesh = new THREE.Mesh(
        hudGeometry,
        hudMaterial
    );

    hudGroup = new THREE.Group();

    hudMesh.position.set(0, 2.5, -5);

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
        new THREE.AmbientLight(
            0xffffff,
            0.6
        )
    );

    // SUELO
    const textureLoader = new THREE.TextureLoader();

    const floorMat =
        new THREE.MeshStandardMaterial({

        map: textureLoader.load(
            'textures/suelo_obscuro.jpg'
        )

    });

    floorMat.map.wrapS =
        THREE.RepeatWrapping;

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

            scene.environment = texture;

        });

    // AUDIO
    listener = new THREE.AudioListener();

    camera.add(listener);

    musicaFondo = new THREE.Audio(listener);

    sonidoPatada = new THREE.Audio(listener);

    const audioLoader = new THREE.AudioLoader();

    audioLoader.load(
        'assets/audio.mp3',
        (buffer) => {

            musicaFondo.setBuffer(buffer);

            musicaFondo.setLoop(true);

            musicaFondo.setVolume(0.5);

        }
    );

    audioLoader.load(
        'assets/patada.mp3',
        (buffer) => {

            sonidoPatada.setBuffer(buffer);

            sonidoPatada.setVolume(1);

        }
    );

    window.musicaFondo = musicaFondo;

    const loader = new FBXLoader();

    loader.setPath('./assets/');

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

        player.traverse((c) => {

            if (c.isMesh) {

                c.castShadow = true;

            }

        });

        playerGroup.add(player);

        mixer = new THREE.AnimationMixer(player);

        loadAnim(
            loader,
            'Running.fbx',
            'correr',
            true
        );

        loadAnim(
            loader,
            'BigJump.fbx',
            'saltar',
            false
        );

        loadAnim(
            loader,
            'Martelo2.fbx',
            'patada',
            false
        );

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

            alienAnimClip =
                fbx.animations[0];

        }

        alienModel.traverse((c) => {

            if (c.isMesh) {

                c.castShadow = true;

                c.geometry.computeVertexNormals();

                c.frustumCulled = false;

            }

        });

        spawnObstacle();

        setTimeout(() => {

            if (!isGameOver)
                spawnObstacle();

        }, 2000);

        setTimeout(() => {

            if (!isGameOver)
                spawnObstacle();

        }, 4000);

        for (let i = 0; i < 2; i++) {

            spawnDecoration();

        }

    });

    // TECLADO
    window.addEventListener(
        'keydown',
        onKeyDown
    );

    // CONTROLES VR
    controllerLeft =
        renderer.xr.getController(0);

    scene.add(controllerLeft);

    controllerRight =
        renderer.xr.getController(1);

    scene.add(controllerRight);

    controllerLeft.addEventListener(
        'selectstart',
        () => {

            fadeToAction(
                'saltar',
                0.1
            );

        }
    );

    controllerRight.addEventListener(
        'selectstart',
        () => {

            fadeToAction(
                'patada',
                0.1
            );

        }
    );

    renderer.setAnimationLoop(animate);

}

function spawnObstacle() {

    if (!alienModel) return;

    const newAlien =
        SkeletonUtils.clone(alienModel);

    newAlien.position.x =
        lanes[
            Math.floor(
                Math.random() * 3
            )
        ];

    newAlien.position.z =
        -Math.random() * 80 - 30;

    let alienMixer = null;

    if (alienAnimClip) {

        alienMixer =
            new THREE.AnimationMixer(
                newAlien
            );

        const action =
            alienMixer.clipAction(
                alienAnimClip
            );

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

function spawnDecoration() {

    const geometry =
        new THREE.DodecahedronGeometry(
            0.6
        );

    const material =
        new THREE.MeshStandardMaterial({

        color: 0x555555

    });

    const rock = new THREE.Mesh(
        geometry,
        material
    );

    rock.position.x =
        (Math.random() - 0.5) * 18;

    rock.position.y = 0.3;

    rock.position.z =
        -Math.random() * 150 - 20;

    scene.add(rock);

    decorations.push(rock);

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

            fadeToAction(
                'saltar',
                0.1
            );

            break;

        case 'KeyK':

            fadeToAction(
                'patada',
                0.1
            );

            break;

    }

}

function movePlayer() {

    targetX = lanes[currentLane];

}

function recibirDano() {

    vida -= 25;

    if (vida <= 0) {

        isGameOver = true;

        pantallaGameOver.style.display =
            'flex';

        puntajeFinal.innerText =
            `Metros recorridos: ${Math.floor(distancia)}`;

        if (
            musicaFondo &&
            musicaFondo.isPlaying
        ) {

            musicaFondo.stop();

        }

        if (renderer.xr.isPresenting) {

            renderer.xr
                .getSession()
                .end();

        }

    }

}

function handleVRInput() {

    const session =
        renderer.xr.getSession();

    if (!session) return;

    for (const source of session.inputSources) {

        if (!source.gamepad) continue;

        const axes =
            source.gamepad.axes;

        const stickX =
            axes[2] || axes[0];

        if (
            Math.abs(stickX) > 0.5 &&
            canMoveVR
        ) {

            if (
                stickX < -0.5 &&
                currentLane > 0
            ) {

                currentLane--;

                movePlayer();

            }

            else if (
                stickX > 0.5 &&
                currentLane < 2
            ) {

                currentLane++;

                movePlayer();

            }

            canMoveVR = false;

            setTimeout(() => {

                canMoveVR = true;

            }, 300);

        }

    }

}

function updateHUD() {

    hudContext.clearRect(
        0,
        0,
        hudCanvas.width,
        hudCanvas.height
    );

    hudContext.fillStyle =
        'rgba(0,0,0,0.5)';

    hudContext.fillRect(
        0,
        0,
        hudCanvas.width,
        hudCanvas.height
    );

    hudContext.fillStyle = 'white';

    hudContext.font =
        'bold 60px Arial';

    hudContext.fillText(
        `Metros: ${Math.floor(distancia)}`,
        50,
        100
    );

    hudContext.fillStyle = 'red';

    hudContext.fillRect(
        50,
        180,
        vida * 8,
        50
    );

    hudTexture.needsUpdate = true;

}

function animate() {

    if (!isGamePlaying) {

        renderer.render(scene, camera);

        return;

    }

    const delta = clock.getDelta();

    if (mixer) mixer.update(delta);

    if (
        renderer.xr.isPresenting &&
        canMoveVR
    ) {

        handleVRInput();

    }

    distancia +=
        (gameSpeed * delta) * 0.2;

    updateHUD();

    playerGroup.position.x +=
        (targetX - playerGroup.position.x)
        * 10 * delta;

    if (
        floor &&
        floor.material.map
    ) {

        floor.material.map.offset.y +=
            (gameSpeed * delta) / 10;

    }

    decorations.forEach((dec) => {

        dec.position.z +=
            gameSpeed * delta;

        if (
            dec.position.z >
            playerGroup.position.z + 5
        ) {

            dec.position.z =
                playerGroup.position.z - 100;

        }

    });

    obstacles.forEach((obs) => {

        if (obs.userData.mixer) {

            obs.userData.mixer.update(delta);

        }

        if (!obs.userData.kicked) {

            obs.position.z +=
                (gameSpeed + 5) * delta;

            obs.getWorldPosition(
                posGlobalObstaculo
            );

            player.getWorldPosition(
                posGlobalJugador
            );

            const dist =
                posGlobalObstaculo.distanceTo(
                    posGlobalJugador
                );

            if (dist < 2) {

                if (isKicking) {

                    obs.userData.kicked = true;

                }

                else if (
                    currentAction !==
                    actions['saltar']
                ) {

                    if (
                        !obs.userData.crashed
                    ) {

                        obs.userData.crashed = true;

                        recibirDano();

                    }

                }

            }

        }

        else {

            obs.position.z -=
                60 * delta;

            obs.position.y +=
                40 * delta;

        }

        if (
            obs.position.z >
            playerGroup.position.z + 5
        ) {

            obs.position.set(

                lanes[
                    Math.floor(
                        Math.random() * 3
                    )
                ],

                0,

                playerGroup.position.z - 80

            );

            obs.userData.kicked = false;

            obs.userData.crashed = false;

        }

    });

    renderer.render(scene, camera);

}

function loadAnim(
    loader,
    file,
    name,
    loop
) {

    loader.load(file, (anim) => {

        const action =
            mixer.clipAction(
                anim.animations[0]
            );

        if (!loop) {

            action.setLoop(
                THREE.LoopOnce
            );

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

    if (name === 'patada') {

        isKicking = true;

        if (sonidoPatada) {

            if (sonidoPatada.isPlaying) {

                sonidoPatada.stop();

            }

            sonidoPatada.play();

        }

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

            fadeToAction(
                'correr',
                0.2
            );

        };

        mixer.addEventListener(
            'finished',
            restore
        );

    }

}

window.addEventListener('resize', () => {

    camera.aspect =
        window.innerWidth /
        window.innerHeight;

    camera.updateProjectionMatrix();

    renderer.setSize(
        window.innerWidth,
        window.innerHeight
    );

});