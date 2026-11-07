'use client'
import { useEffect, useRef } from 'react'
import * as THREE from 'three'

/** Abstract architecture study, not a surveyed reconstruction or an archaeological claim. */
export default function HagiaSophiaScene({ year }) {
  const hostRef = useRef(null)
  useEffect(() => {
    const host=hostRef.current
    if(!host)return
    let renderer
    try {renderer=new THREE.WebGLRenderer({antialias:true})}
    catch {host.textContent='WebGL ist nicht verfügbar.';return}
    renderer.setPixelRatio(Math.min(devicePixelRatio,2))
    renderer.setSize(host.clientWidth,host.clientHeight)
    host.appendChild(renderer.domElement)
    const scene=new THREE.Scene()
    scene.background=new THREE.Color(0xb7cbd7)
    const camera=new THREE.PerspectiveCamera(65,host.clientWidth/Math.max(host.clientHeight,1),.1,250)
    camera.position.set(0,4,40)
    scene.add(new THREE.HemisphereLight(0xffffff,0x6a584d,2.2))
    const sun=new THREE.DirectionalLight(0xffe6bb,2.7);sun.position.set(14,35,20);scene.add(sun)
    const stone=new THREE.MeshStandardMaterial({color:0xc4b5a0,roughness:1})
    const brick=new THREE.MeshStandardMaterial({color:0x997b68,roughness:1})
    const domeMat=new THREE.MeshStandardMaterial({color:0x968c7c,roughness:.86})
    const minaretMat=new THREE.MeshStandardMaterial({color:0xcac0ad,roughness:.9})
    const materials=[stone,brick,domeMat,minaretMat]
    const objects=[]
    function add(geo,mat,x,y,z) {
      const mesh=new THREE.Mesh(geo,mat);mesh.position.set(x,y,z);scene.add(mesh);objects.push(mesh);return mesh
    }
    add(new THREE.PlaneGeometry(160,160),stone,0,-.05,0).rotation.x=-Math.PI/2
    add(new THREE.BoxGeometry(28,13,24),brick,0,6.5,-12)
    add(new THREE.BoxGeometry(31,2,27),stone,0,13,-12)
    // Drum + hemispherical dome and paired semidomes represent a simplified massing study.
    add(new THREE.CylinderGeometry(9,9,4,32),stone,0,15,-12)
    add(new THREE.SphereGeometry(9,32,18,0,Math.PI*2,0,Math.PI/2),domeMat,0,17,-12)
    for(const z of [-25,1]){
      add(new THREE.SphereGeometry(5.7,24,12,0,Math.PI*2,0,Math.PI/2),domeMat,0,11,z)
    }
    for(const x of [-16,16])for(const z of [-20,-4]) {
      add(new THREE.BoxGeometry(4,11,6),stone,x,5.5,z)
    }
    if(year===1700) {
      // Epoch-dependent minarets: schematic Ottoman markers, not exact locations.
      for(const [x,z] of [[-22,-30],[22,-30],[-22,7],[22,7]]) {
        add(new THREE.CylinderGeometry(.85,1.25,29,14),minaretMat,x,14.5,z)
        add(new THREE.CylinderGeometry(1.8,1.8,.7,14),stone,x,24,z)
        add(new THREE.ConeGeometry(1.3,7,14),domeMat,x,32.3,z)
      }
    }
    if(year===1200){
      // The year 1200 predates the Latin occupation (1204): still Byzantine.
      add(new THREE.BoxGeometry(9,3,4),stone,0,1.5,6)
    }
    const keys=new Set()
    let yaw=0
    function down(e){
      if(['INPUT','TEXTAREA','SELECT'].includes(e.target?.tagName))return
      const k=e.key.toLowerCase()
      if(['w','a','s','d','arrowleft','arrowright'].includes(k)){keys.add(k);e.preventDefault()}
    }
    function up(e){keys.delete(e.key.toLowerCase())}
    function blur(){keys.clear()}
    window.addEventListener('keydown',down);window.addEventListener('keyup',up);window.addEventListener('blur',blur)
    const resize=new ResizeObserver(()=>{
      const w=host.clientWidth,h=host.clientHeight
      if(!w||!h)return
      camera.aspect=w/h;camera.updateProjectionMatrix();renderer.setSize(w,h)
    })
    resize.observe(host)
    const clock=new THREE.Clock()
    let frame=0
    let alive=true
    function tick(){
      if(!alive)return
      frame=requestAnimationFrame(tick)
      const dt=Math.min(clock.getDelta(),.05)
      if(keys.has('arrowleft'))yaw+=dt*1.1
      if(keys.has('arrowright'))yaw-=dt*1.1
      camera.rotation.set(0,yaw,0,'YXZ')
      const dir=new THREE.Vector3(-Math.sin(yaw),0,-Math.cos(yaw))
      const side=new THREE.Vector3(Math.cos(yaw),0,-Math.sin(yaw))
      const move=new THREE.Vector3()
      if(keys.has('w'))move.add(dir)
      if(keys.has('s'))move.sub(dir)
      if(keys.has('d'))move.add(side)
      if(keys.has('a'))move.sub(side)
      if(move.lengthSq()){move.normalize().multiplyScalar(dt*7)
        camera.position.x=THREE.MathUtils.clamp(camera.position.x+move.x,-32,32)
        // Stay outside the solid architectural placeholder until an interior exists.
        const nz=camera.position.z+move.z
        if(!(Math.abs(camera.position.x)<19 && nz>-29 && nz<4))
          camera.position.z=THREE.MathUtils.clamp(nz,6,55)
      }
      renderer.render(scene,camera)
    }
    tick()
    return ()=>{
      alive=false;cancelAnimationFrame(frame);resize.disconnect()
      window.removeEventListener('keydown',down);window.removeEventListener('keyup',up);window.removeEventListener('blur',blur)
      objects.forEach(o=>o.geometry.dispose());materials.forEach(m=>m.dispose())
      renderer.dispose();renderer.domElement.remove()
    }
  },[year])
  return <div ref={hostRef} style={{width:'100%',height:'100%'}} aria-label="Schematisches 3D-Baumassenmodell Hagia Sophia" />
}
