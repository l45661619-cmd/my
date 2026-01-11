import * as THREE from 'three';
import * as CANNON from 'cannon-es';

let objects = [], keys = {}, isBuildMode = false;
let selectedObject = null, selectedType = 'cube';
let camYaw = 0, camPitch = 0;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth/window.innerHeight, 0.1, 1000000);
camera.position.set(100, 100, 100);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(0x020205);
document.body.appendChild(renderer.domElement);

const world = new CANNON.World();
world.gravity.set(0, -30, 0);

// --- СЕТКА И ПОЛ ---
const grid = new THREE.GridHelper(2000, 100, 0x444444, 0x222222);
scene.add(grid);

const groundBody = new CANNON.Body({ mass: 0, shape: new CANNON.Box(new CANNON.Vec3(1000, 1, 1000)) });
groundBody.position.set(0, -1, 0);
world.addBody(groundBody);

// --- КОСМОС И ЭФФЕКТЫ ---
const starGeo = new THREE.BufferGeometry();
const starVerex = [];
for(let i=0; i<10000; i++) starVerex.push((Math.random()-0.5)*10000, (Math.random()-0.5)*10000, (Math.random()-0.5)*10000);
starGeo.setAttribute('position', new THREE.Float32BufferAttribute(starVerex, 3));
scene.add(new THREE.Points(starGeo, new THREE.PointsMaterial({color: 0xffffff, size: 2})));

const nebulaGeo = new THREE.BufferGeometry();
const nebulaVerex = [], nebulaColors = [];
for(let i=0; i<2000; i++) {
    nebulaVerex.push((Math.random()-0.5)*1000, 20 + (Math.random()*100), (Math.random()-0.5)*1000);
    nebulaColors.push(0.3, 0.1, 0.6);
}
nebulaGeo.setAttribute('position', new THREE.Float32BufferAttribute(nebulaVerex, 3));
nebulaGeo.setAttribute('color', new THREE.Float32BufferAttribute(nebulaColors, 3));
scene.add(new THREE.Points(nebulaGeo, new THREE.PointsMaterial({size: 4, vertexColors: true, transparent: true, opacity: 0.3})));

// --- ЧЕРНАЯ ДЫРА ---
const bhPos = new THREE.Vector3(0, 80, 0);
const bhMesh = new THREE.Mesh(new THREE.SphereGeometry(15, 32, 32), new THREE.MeshBasicMaterial({color: 0x000000}));
bhMesh.position.copy(bhPos);
scene.add(bhMesh);
const bhRing = new THREE.Mesh(new THREE.TorusGeometry(25, 1, 16, 100), new THREE.MeshBasicMaterial({color: 0xff4400, transparent: true, opacity: 0.7}));
bhRing.position.copy(bhPos); bhRing.rotation.x = Math.PI/2;
scene.add(bhRing);

scene.add(new THREE.AmbientLight(0xffffff, 1.2));

// --- ЛОГИКА СТРОИТЕЛЬСТВА ---
function spawn(data = null) {
    let type = data ? data.type : selectedType;
    let color = data ? data.color : document.getElementById('color-picker').value;
    let pos = data ? data.pos : {x: 0, y: 5, z: 0};
    let scale = data ? data.scale : {x: 1, y: 1, z: 1};

    if (!data) {
        const raycaster = new THREE.Raycaster();
        raycaster.setFromCamera(new THREE.Vector2(0,0), camera);
        const intersectPos = new THREE.Vector3();
        // Примагничивание к сетке пола (y=0)
        if (raycaster.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0,1,0), 0), intersectPos)) {
            pos = { x: Math.round(intersectPos.x/10)*10, y: 5, z: Math.round(intersectPos.z/10)*10 };
        }
    }

    const geo = type === 'cube' ? new THREE.BoxGeometry(10,10,10) : new THREE.SphereGeometry(6);
    const shape = type === 'cube' ? new CANNON.Box(new CANNON.Vec3(5,5,5)) : new CANNON.Sphere(6);
    const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({color}));
    mesh.scale.set(scale.x, scale.y, scale.z);
    
    const body = new CANNON.Body({mass: 5, shape});
    body.position.set(pos.x, pos.y, pos.z);
    
    scene.add(mesh); world.addBody(body);
    const obj = {mesh, body, type};
    objects.push(obj);
    select(obj);
}

function select(obj) {
    if(selectedObject) selectedObject.mesh.material.emissive?.set(0x000000);
    selectedObject = obj;
    if(obj) {
        obj.mesh.material.emissive?.set(0x220000);
        document.getElementById('scale-x').value = obj.mesh.scale.x;
        document.getElementById('scale-y').value = obj.mesh.scale.y;
        document.getElementById('scale-z').value = obj.mesh.scale.z;
    }
}

// --- УПРАВЛЕНИЕ ---
window.addEventListener('keydown', (e) => {
    if(e.key.toLowerCase()==='q') {
        isBuildMode = !isBuildMode;
        document.getElementById('side-panel').classList.toggle('open', isBuildMode);
        document.getElementById('crosshair').style.display = isBuildMode ? 'block' : 'none';
    }
    keys[e.code] = true;
});
window.addEventListener('keyup', (e) => keys[e.code] = false);

window.addEventListener('mousedown', (e) => {
    if(!isBuildMode || e.button !== 0) return;
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(new THREE.Vector2(0,0), camera);
    const hits = raycaster.intersectObjects(objects.map(o=>o.mesh));
    hits.length > 0 ? select(objects.find(o=>o.mesh===hits[0].object)) : spawn();
});

window.addEventListener('mousemove', (e) => {
    if(e.buttons === 2) {
        camYaw -= e.movementX * 0.003;
        camPitch = Math.max(-1.5, Math.min(1.5, camPitch - e.movementY * 0.003));
    }
});

// --- ЦИКЛ ---
function animate() {
    requestAnimationFrame(animate);
    const move = new THREE.Vector3();
    if(keys['KeyW']) move.z -= 1; if(keys['KeyS']) move.z += 1;
    if(keys['KeyA']) move.x -= 1; if(keys['KeyD']) move.x += 1;
    camera.position.addScaledVector(move.applyQuaternion(camera.quaternion), 5);
    camera.quaternion.setFromEuler(new THREE.Euler(camPitch, camYaw, 0, 'YXZ'));
    
    document.getElementById('coords').innerText = `X:${Math.round(camera.position.x)} Y:${Math.round(camera.position.y)} Z:${Math.round(camera.position.z)}`;

    if(selectedObject && isBuildMode) {
        selectedObject.mesh.scale.set(parseFloat(document.getElementById('scale-x').value), parseFloat(document.getElementById('scale-y').value), parseFloat(document.getElementById('scale-z').value));
        selectedObject.body.position.set(parseFloat(document.getElementById('move-x').value), parseFloat(document.getElementById('move-y').value), parseFloat(document.getElementById('move-z').value));
    }

    bhRing.rotation.z += 0.02;
    objects.forEach((obj, i) => {
        const d = obj.body.position.distanceTo(new CANNON.Vec3(bhPos.x, bhPos.y, bhPos.z));
        if(d < 150) {
            const f = new CANNON.Vec3(bhPos.x-obj.body.position.x, bhPos.y-obj.body.position.y, bhPos.z-obj.body.position.z);
            f.normalize();
            obj.body.applyForce(f.scale(700/d), obj.body.position);
            if(d < 15) { scene.remove(obj.mesh); world.removeBody(obj.body); objects.splice(i,1); }
        }
        obj.mesh.position.copy(obj.body.position);
        obj.mesh.quaternion.copy(obj.body.quaternion);
    });

    world.step(1/60);
    renderer.render(scene, camera);
}

// Кнопки
document.getElementById('save-btn').onclick = () => {
    const data = objects.map(o => ({type: o.type, color: "#"+o.mesh.material.color.getHexString(), pos: o.body.position, scale: o.mesh.scale}));
    const blob = new Blob([JSON.stringify(data)], {type: 'application/json'});
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'space.json'; a.click();
};
document.getElementById('load-file').onchange = (e) => {
    const reader = new FileReader();
    reader.onload = (ev) => { JSON.parse(ev.target.result).forEach(item => spawn(item)); };
    reader.readAsText(e.target.files[0]);
};
document.getElementById('t-move').onclick = () => { document.getElementById('pane-move').style.display='block'; document.getElementById('pane-scale').style.display='none'; };
document.getElementById('t-scale').onclick = () => { document.getElementById('pane-move').style.display='none'; document.getElementById('pane-scale').style.display='block'; };
document.getElementById('btn-cube').onclick = () => { selectedType='cube'; document.getElementById('btn-cube').classList.add('active'); document.getElementById('btn-sphere').classList.remove('active'); };
document.getElementById('btn-sphere').onclick = () => { selectedType='sphere'; document.getElementById('btn-sphere').classList.add('active'); document.getElementById('btn-cube').classList.remove('active'); };
document.getElementById('delete-btn').onclick = () => { if(selectedObject) { scene.remove(selectedObject.mesh); world.removeBody(selectedObject.body); objects = objects.filter(o=>o!==selectedObject); selectedObject=null; } };
document.getElementById('clear-all').onclick = () => { objects.forEach(o=>{scene.remove(o.mesh); world.removeBody(o.body);}); objects=[]; };

animate();
