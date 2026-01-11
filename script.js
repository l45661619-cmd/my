import * as THREE from 'three';
import * as CANNON from 'cannon-es';

// --- ЛОКАЛИЗАЦИЯ ---
const i18n = {
    ru: {
        viewMode: "ОБЫЧНЫЙ РЕЖИМ", editMode: "РЕЖИМ СТУДИИ",
        editModeKey: "Меню", moveKey: "Полет", rotateKey: "Камера", actionKey: "Выбор / Спавн",
        studioTitle: "СТУДИЯ", block: "КУБ", sphere: "ШАР", part: "СТЕНА (Статика)",
        moveTab: "ДВИГАТЬ", scaleTab: "РАЗМЕР", rotateTab: "ПОВОРОТ",
        posX: "Позиция X", posY: "Позиция Y", posZ: "Позиция Z",
        scaleX: "Ширина X", scaleY: "Высота Y", scaleZ: "Длина Z", rotY: "Поворот Y",
        deleteBtn: "УДАЛИТЬ"
    },
    en: {
        viewMode: "VIEW MODE", editMode: "STUDIO MODE",
        editModeKey: "Menu", moveKey: "Fly", rotateKey: "Camera", actionKey: "Select / Spawn",
        studioTitle: "STUDIO", block: "BLOCK", sphere: "SPHERE", part: "PART (Static)",
        moveTab: "MOVE", scaleTab: "SCALE", rotateTab: "ROTATE",
        posX: "Position X", posY: "Position Y", posZ: "Position Z",
        scaleX: "Scale X", scaleY: "Scale Y", scaleZ: "Scale Z", rotY: "Rotation Y",
        deleteBtn: "DELETE"
    }
};

let currentLang = 'ru';
let isBuildMode = false, selectedType = 'cube', selectedObject = null;
let objects = [], keys = {}, camYaw = 0, camPitch = 0;

// Инициализация UI
function updateUI() {
    const data = i18n[currentLang];
    document.querySelectorAll('[data-key]').forEach(el => {
        const key = el.getAttribute('data-key');
        if(data[key]) el.innerText = data[key];
    });
    document.getElementById('mode-indicator').innerText = isBuildMode ? data.editMode : data.viewMode;
}

// Переключение языка
document.getElementById('btn-ru').onclick = () => { currentLang = 'ru'; updateLangBtns(); updateUI(); };
document.getElementById('btn-en').onclick = () => { currentLang = 'en'; updateLangBtns(); updateUI(); };

function updateLangBtns() {
    document.querySelectorAll('.lang-btn').forEach(b => b.classList.remove('active'));
    document.getElementById('btn-' + currentLang).classList.add('active');
}

// --- THREE.JS & PHYSICS ---
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth/window.innerHeight, 0.1, 50000);
camera.position.set(100, 100, 100);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(0x050505);
document.body.appendChild(renderer.domElement);

const world = new CANNON.World();
world.gravity.set(0, -40, 0);

// Пол и Сетка
const grid = new THREE.GridHelper(2000, 50, 0x444444, 0x222222);
scene.add(grid);
const groundBody = new CANNON.Body({ mass: 0, shape: new CANNON.Box(new CANNON.Vec3(1000, 5, 1000)) });
groundBody.position.set(0, -5, 0);
world.addBody(groundBody);

// Вкладки и инструменты
window.setTab = (t) => {
    ['move', 'scale', 'rotate'].forEach(tab => document.getElementById('pane-'+tab).style.display = 'none');
    document.getElementById('pane-'+t).style.display = 'block';
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.getElementById('t-'+t).classList.add('active');
};
// Прокидываем в глобальную область для onclick
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

function spawn() {
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const pos = new THREE.Vector3();
    raycaster.ray.intersectPlane(plane, pos);

    const color = document.getElementById('color-picker').value;
    let geo, shape, mass = selectedType === 'wall' ? 0 : 2;
    
    if(selectedType === 'cube' || selectedType === 'wall') {
        geo = new THREE.BoxGeometry(10, 10, 10);
        shape = new CANNON.Box(new CANNON.Vec3(5, 5, 5));
    } else {
        geo = new THREE.SphereGeometry(6);
        shape = new CANNON.Sphere(6);
    }

    const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({color, metalness: 0.1, roughness: 0.8}));
    const body = new CANNON.Body({ mass, shape });
    body.position.set(pos.x, 5.1, pos.z);

    scene.add(mesh); world.addBody(body);
    const obj = {mesh, body, type: selectedType};
    objects.push(obj);
    select(obj);
}

function select(obj) {
    if(selectedObject) selectedObject.mesh.material.emissive.set(0x000000);
    selectedObject = obj;
    if(obj) {
        obj.mesh.material.emissive.set(0x440000);
        document.getElementById('move-x').value = obj.body.position.x;
        document.getElementById('move-y').value = obj.body.position.y;
        document.getElementById('move-z').value = obj.body.position.z;
    }
}

// Управление
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
scene.add(new THREE.AmbientLight(0xffffff, 1.2));
const sun = new THREE.DirectionalLight(0xffffff, 1);
sun.position.set(100, 200, 100);
scene.add(sun);

function animate() {
    requestAnimationFrame(animate);
    const move = new THREE.Vector3();
    if(keys['KeyW']) move.z -= 1; if(keys['KeyS']) move.z += 1;
    if(keys['KeyA']) move.x -= 1; if(keys['KeyD']) move.x += 1;
    camera.position.addScaledVector(move.applyQuaternion(camera.quaternion), 4);
    camera.quaternion.setFromEuler(new THREE.Euler(camPitch, camYaw, 0, 'YXZ'));
    
    document.getElementById('coords').innerText = `${Math.round(camera.position.x)}, ${Math.round(camera.position.y)}, ${Math.round(camera.position.z)}`;

    if(selectedObject) {
        const mx = parseFloat(document.getElementById('move-x').value);
        const my = parseFloat(document.getElementById('move-y').value);
        const mz = parseFloat(document.getElementById('move-z').value);
        selectedObject.body.position.set(mx, my, mz);
        if(selectedObject.type !== 'wall') selectedObject.body.velocity.set(0,0,0);

        const sx = parseFloat(document.getElementById('scale-x').value);
        const sy = parseFloat(document.getElementById('scale-y').value);
        const sz = parseFloat(document.getElementById('scale-z').value);
        selectedObject.mesh.scale.set(sx, sy, sz);

        const ry = parseFloat(document.getElementById('rotate-y').value);
        selectedObject.body.quaternion.setFromEuler(0, ry, 0);
    }

    world.step(1/60);
    objects.forEach(o => {
        o.mesh.position.copy(o.body.position);
        o.mesh.quaternion.copy(o.body.quaternion);
    });
    renderer.render(scene, camera);
}
updateUI();
animate();

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});