import * as THREE from 'three';
import * as CANNON from 'cannon-es';

const i18n = {
    ru: {
        viewMode: "ОБЫЧНЫЙ РЕЖИМ", editMode: "РЕЖИМ СТУДИИ", editModeKey: "Меню",
        moveKey: "Полет", rotateKey: "Камера", actionKey: "Выбор / Спавн", studioTitle: "СТУДИЯ",
        block: "КУБ", sphere: "ШАР", part: "СТЕНА (Статика)", moveTab: "ДВИГАТЬ",
        scaleTab: "РАЗМЕР", rotateTab: "ПОВОРОТ", posX: "Позиция X", posY: "Позиция Y",
        posZ: "Позиция Z", scaleX: "Ширина X", scaleY: "Высота Y", scaleZ: "Длина Z",
        rotY: "Поворот Y", deleteBtn: "УДАЛИТЬ"
    },
    en: {
        viewMode: "VIEW MODE", editMode: "STUDIO MODE", editModeKey: "Menu",
        moveKey: "Fly", rotateKey: "Camera", actionKey: "Select / Spawn", studioTitle: "STUDIO",
        block: "BLOCK", sphere: "SPHERE", part: "PART (Static)", moveTab: "MOVE",
        scaleTab: "SCALE", rotateTab: "ROTATE", posX: "Position X", posY: "Position Y",
        posZ: "Position Z", scaleX: "Scale X", scaleY: "Scale Y", scaleZ: "Scale Z",
        rotY: "Rotation Y", deleteBtn: "DELETE"
    }
};

let currentLang = 'ru';
let isBuildMode = false, selectedType = 'cube', selectedObject = null;
let objects = [], keys = {}, camYaw = 0, camPitch = 0;

// --- ИНИЦИАЛИЗАЦИЯ СЦЕНЫ ---
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth/window.innerHeight, 0.1, 50000);
camera.position.set(100, 100, 100);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(0x050505);
document.body.appendChild(renderer.domElement);

const world = new CANNON.World();
world.gravity.set(0, -40, 0);

// Свет
scene.add(new THREE.AmbientLight(0xffffff, 1.2));
const sun = new THREE.DirectionalLight(0xffffff, 1);
sun.position.set(100, 200, 100);
scene.add(sun);

// Сетка пола
const grid = new THREE.GridHelper(2000, 50, 0x444444, 0x222222);
scene.add(grid);
const groundBody = new CANNON.Body({ mass: 0, shape: new CANNON.Box(new CANNON.Vec3(1000, 5, 1000)) });
groundBody.position.set(0, -5, 0);
world.addBody(groundBody);

// --- ЧЕРНАЯ ДЫРА ---
const bhPos = new THREE.Vector3(0, 40, 0);
const bhRadius = 6;

// Тело дыры (черная сфера)
const bhMesh = new THREE.Mesh(
    new THREE.SphereGeometry(bhRadius, 32, 32),
    new THREE.MeshBasicMaterial({ color: 0x000000 })
);
bhMesh.position.copy(bhPos);
scene.add(bhMesh);

// Огненное кольцо
const ringMesh = new THREE.Mesh(
    new THREE.TorusGeometry(10, 0.3, 16, 100),
    new THREE.MeshBasicMaterial({ color: 0xff4400, transparent: true, opacity: 0.8 })
);
ringMesh.position.copy(bhPos);
ringMesh.rotation.x = Math.PI / 2;
scene.add(ringMesh);

// --- ФУНКЦИИ ИНТЕРФЕЙСА ---
function updateUI() {
    const data = i18n[currentLang];
    document.querySelectorAll('[data-key]').forEach(el => {
        const key = el.getAttribute('data-key');
        if(data[key]) el.innerText = data[key];
    });
    document.getElementById('mode-indicator').innerText = isBuildMode ? data.editMode : data.viewMode;
}

document.getElementById('btn-ru').onclick = () => { currentLang = 'ru'; updateUI(); };
document.getElementById('btn-en').onclick = () => { currentLang = 'en'; updateUI(); };

window.setTab = (t) => {
    ['move', 'scale', 'rotate'].forEach(tab => document.getElementById('pane-'+tab).style.display = 'none');
    document.getElementById('pane-'+t).style.display = 'block';
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.getElementById('t-'+t).classList.add('active');
};

document.getElementById('t-move').onclick = () => window.setTab('move');
document.getElementById('t-scale').onclick = () => window.setTab('scale');
document.getElementById('t-rotate').onclick = () => window.setTab('rotate');
document.getElementById('btn-cube').onclick = () => setBuildType('cube');
document.getElementById('btn-sphere').onclick = () => setBuildType('sphere');
document.getElementById('btn-wall').onclick = () => setBuildType('wall');

function setBuildType(t) {
    selectedType = t;
    document.querySelectorAll('.obj-btn').forEach(b => b.classList.remove('active'));
    document.getElementById('btn-'+t).classList.add('active');
}

document.getElementById('delete-btn').onclick = () => {
    if(!selectedObject) return;
    scene.remove(selectedObject.mesh); world.removeBody(selectedObject.body);
    objects = objects.filter(o => o !== selectedObject);
    selectedObject = null;
};

// --- СПАВН ОБЪЕКТОВ ---
function spawn() {
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const pos = new THREE.Vector3();
    raycaster.ray.intersectPlane(plane, pos);

    const color = document.getElementById('color-picker').value;
    let geo, shape, mass = selectedType === 'wall' ? 0 : 5;
    
    if(selectedType === 'cube' || selectedType === 'wall') {
        geo = new THREE.BoxGeometry(10, 10, 10);
        shape = new CANNON.Box(new CANNON.Vec3(5, 5, 5));
    } else {
        geo = new THREE.SphereGeometry(6);
        shape = new CANNON.Sphere(6);
    }

    const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({color}));
    const body = new CANNON.Body({ mass, shape });
    body.position.set(pos.x, 10, pos.z);

    scene.add(mesh); world.addBody(body);
    objects.push({mesh, body, type: selectedType});
}

function select(obj) {
    if(selectedObject) selectedObject.mesh.material.emissive.set(0x000000);
    selectedObject = obj;
    if(obj) obj.mesh.material.emissive.set(0x440000);
}

// --- УПРАВЛЕНИЕ ---
window.addEventListener('mousedown', (e) => {
    if(!isBuildMode) return;
    if(e.button === 0) {
        const raycaster = new THREE.Raycaster();
        raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
        const hits = raycaster.intersectObjects(objects.map(o => o.mesh));
        if(hits.length > 0) select(objects.find(o => o.mesh === hits[0].object));
        else spawn();
    }
});

window.addEventListener('mousemove', (e) => {
    if(e.buttons === 2) {
        camYaw -= e.movementX * 0.003;
        camPitch = Math.max(-1.5, Math.min(1.5, camPitch - e.movementY * 0.003));
    }
});

window.addEventListener('keydown', (e) => {
    if(e.key.toLowerCase() === 'q') {
        isBuildMode = !isBuildMode;
        document.getElementById('side-panel').classList.toggle('open', isBuildMode);
        document.getElementById('crosshair').style.display = isBuildMode ? 'block' : 'none';
        updateUI();
    }
    keys[e.code] = true;
});
window.addEventListener('keyup', (e) => keys[e.code] = false);
window.addEventListener('contextmenu', e => e.preventDefault());

// --- ГЛАВНЫЙ ЦИКЛ (ANIMATE) ---
function animate() {
    requestAnimationFrame(animate);
    
    // Движение камеры
    const move = new THREE.Vector3();
    if(keys['KeyW']) move.z -= 1; if(keys['KeyS']) move.z += 1;
    if(keys['KeyA']) move.x -= 1; if(keys['KeyD']) move.x += 1;
    camera.position.addScaledVector(move.applyQuaternion(camera.quaternion), 4);
    camera.quaternion.setFromEuler(new THREE.Euler(camPitch, camYaw, 0, 'YXZ'));
    
    document.getElementById('coords').innerText = `${Math.round(camera.position.x)}, ${Math.round(camera.position.y)}, ${Math.round(camera.position.z)}`;

    // Эффект черной дыры
    ringMesh.rotation.z += 0.05;
    
    for (let i = objects.length - 1; i >= 0; i--) {
        const obj = objects[i];
        
        // Вектор от объекта к дыре
        const diff = new CANNON.Vec3(bhPos.x - obj.body.position.x, bhPos.y - obj.body.position.y, bhPos.z - obj.body.position.z);
        const dist = diff.length();

        if (dist < 80 && obj.body.mass > 0) {
            diff.normalize();
            // Сила притяжения (чем ближе, тем сильнее)
            const force = diff.scale(400 / (dist * 0.2));
            obj.body.applyForce(force, obj.body.position);

            // Если засосало внутрь
            if (dist < bhRadius + 2) {
                scene.remove(obj.mesh);
                world.removeBody(obj.body);
                objects.splice(i, 1);
                continue;
            }
        }

        // Синхронизация физики и графики
        obj.mesh.position.copy(obj.body.position);
        obj.mesh.quaternion.copy(obj.body.quaternion);
    }

    world.step(1/60);
    renderer.render(scene, camera);
}

updateUI();
animate();

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});
