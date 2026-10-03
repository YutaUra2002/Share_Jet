import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { PLYLoader } from "three/addons/loaders/PLYLoader.js";

const CONDITIONS={c000:{label:"No swirl",C:"0.00"},c025:{label:"Weak swirl",C:"0.25"},c050:{label:"Strong swirl",C:"0.50"}};
const BANDS=[{id:"b1",color:0xc6c6c6},{id:"b3",color:0xffff7f},{id:"b5",color:0x00aa7f}];

const container=document.getElementById("viewer");
const drawer=document.getElementById("drawer");
const backdrop=document.getElementById("backdrop");
const menuButton=document.getElementById("menu-button");
const conditionLabel=document.getElementById("condition-label");
const loading=document.getElementById("loading");
const loadingText=document.getElementById("loading-text");
const resetButton=document.getElementById("reset-view");

const renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:"high-performance"});
renderer.setPixelRatio(Math.min(window.devicePixelRatio,1.5));
renderer.setSize(window.innerWidth,window.innerHeight);
renderer.outputColorSpace=THREE.SRGBColorSpace;
container.appendChild(renderer.domElement);

const scene=new THREE.Scene();
scene.background=new THREE.Color(0xf5f5f5);
const camera=new THREE.PerspectiveCamera(42,window.innerWidth/window.innerHeight,0.001,100000);
camera.up.set(0,0,1);

scene.add(new THREE.HemisphereLight(0xffffff,0x777777,2.1));
const light1=new THREE.DirectionalLight(0xffffff,2.3);light1.position.set(1,-1,2);scene.add(light1);
const light2=new THREE.DirectionalLight(0xffffff,1.2);light2.position.set(-1,1,-0.5);scene.add(light2);

const controls=new OrbitControls(camera,renderer.domElement);
controls.enableDamping=true;controls.dampingFactor=0.07;controls.rotateSpeed=0.65;controls.zoomSpeed=0.8;controls.panSpeed=0.65;controls.screenSpacePanning=true;
controls.touches.ONE=THREE.TOUCH.ROTATE;controls.touches.TWO=THREE.TOUCH.DOLLY_PAN;

let currentGroup=new THREE.Group();scene.add(currentGroup);
let domainCenter=new THREE.Vector3();let domainDiagonal=1;let initialCameraPosition=new THREE.Vector3();

async function loadBounds(){
  const response=await fetch("./bounds.json");
  if(!response.ok)throw new Error("Could not load bounds.json");
  const b=await response.json();
  const min=new THREE.Vector3(b.xmin,b.ymin,b.zmin),max=new THREE.Vector3(b.xmax,b.ymax,b.zmax);
  const box=new THREE.Box3(min,max);box.getCenter(domainCenter);
  const size=new THREE.Vector3();box.getSize(size);domainDiagonal=size.length();
  const edgesGeometry=new THREE.EdgesGeometry(new THREE.BoxGeometry(size.x,size.y,size.z));
  const outline=new THREE.LineSegments(edgesGeometry,new THREE.LineBasicMaterial({color:0x111111}));
  outline.position.copy(domainCenter);scene.add(outline);
  const direction=new THREE.Vector3(1.15,-1.30,0.70).normalize();
  initialCameraPosition.copy(domainCenter).addScaledVector(direction,domainDiagonal*1.05);
  camera.position.copy(initialCameraPosition);controls.target.copy(domainCenter);
  controls.minDistance=domainDiagonal*0.18;controls.maxDistance=domainDiagonal*2.2;
  controls.cursor.copy(domainCenter);controls.maxTargetRadius=domainDiagonal*0.32;
  controls.update();controls.saveState();
}

function createMaterial(color){return new THREE.MeshStandardMaterial({color,roughness:0.68,metalness:0.0,side:THREE.DoubleSide});}
function clearCurrentMeshes(){
  scene.remove(currentGroup);
  currentGroup.traverse(object=>{if(object.geometry)object.geometry.dispose();if(object.material){if(Array.isArray(object.material))object.material.forEach(m=>m.dispose());else object.material.dispose();}});
  currentGroup=new THREE.Group();scene.add(currentGroup);
}

const plyLoader=new PLYLoader();let loadSerial=0;
async function loadCondition(condition){
  const mySerial=++loadSerial;loading.classList.remove("hidden");loadingText.textContent=`Loading ${CONDITIONS[condition].label}...`;clearCurrentMeshes();
  try{
    const geometries=await Promise.all(BANDS.map(band=>plyLoader.loadAsync(`./meshes/${condition}_${band.id}.ply`)));
    if(mySerial!==loadSerial){geometries.forEach(g=>g.dispose());return;}
    geometries.forEach((geometry,index)=>{geometry.computeVertexNormals();const band=BANDS[index];const mesh=new THREE.Mesh(geometry,createMaterial(band.color));mesh.name=`${condition}_${band.id}`;currentGroup.add(mesh);});
    conditionLabel.textContent=`${CONDITIONS[condition].label} · C = ${CONDITIONS[condition].C}`;
    document.querySelectorAll(".case-button").forEach(button=>button.classList.toggle("active",button.dataset.case===condition));
  }catch(error){console.error(error);loadingText.textContent="Failed to load 3D data.";return;}
  loading.classList.add("hidden");
}

function openMenu(){drawer.classList.add("open");backdrop.classList.add("open");menuButton.setAttribute("aria-expanded","true");}
function closeMenu(){drawer.classList.remove("open");backdrop.classList.remove("open");menuButton.setAttribute("aria-expanded","false");}
menuButton.addEventListener("click",()=>drawer.classList.contains("open")?closeMenu():openMenu());
backdrop.addEventListener("click",closeMenu);
document.querySelectorAll(".case-button").forEach(button=>button.addEventListener("click",async()=>{closeMenu();await loadCondition(button.dataset.case);}));
resetButton.addEventListener("click",()=>{camera.position.copy(initialCameraPosition);controls.target.copy(domainCenter);controls.cursor.copy(domainCenter);controls.update();});
window.addEventListener("resize",()=>{camera.aspect=window.innerWidth/window.innerHeight;camera.updateProjectionMatrix();renderer.setSize(window.innerWidth,window.innerHeight);});
function animate(){controls.update();renderer.render(scene,camera);}renderer.setAnimationLoop(animate);
async function main(){await loadBounds();await loadCondition("c000");}
main().catch(error=>{console.error(error);loadingText.textContent="Initialization failed.";});
