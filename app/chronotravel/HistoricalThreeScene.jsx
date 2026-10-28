'use client'
import { useEffect, useRef } from 'react'
import * as THREE from 'three'

/** Lightweight desktop WebGL prototype; no persistent game state. */
export default function HistoricalThreeScene({ year }) {
  const mountRef = useRef(null)
  useEffect(() => {
    const host = mountRef.current
    if (!host) return
    let renderer
    try { renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' }) }
    catch { host.textContent = 'WebGL ist in diesem Browser nicht verfügbar.'; return }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFSoftShadowMap
    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.setSize(host.clientWidth, host.clientHeight)
    host.appendChild(renderer.domElement)
    const world = new THREE.Scene()
    world.background = new THREE.Color(year === 1700 ? 0xb9c9d1 : year === 1200 ? 0xd9b99f : 0xe2c79e)
    world.fog = new THREE.Fog(world.background, 60, 145)
    const camera = new THREE.PerspectiveCamera(70, host.clientWidth / host.clientHeight, 0.1, 250)
    camera.position.set(0, 1.75, 27)
    let yaw = 0
    const ambient = new THREE.HemisphereLight(0xfff1d9, 0x524638, 2.1)
    world.add(ambient)
    const sunlight = new THREE.DirectionalLight(0xffe4aa, 3)
    sunlight.position.set(-25, 45, 18); sunlight.castShadow = true
    sunlight.shadow.mapSize.set(1024,1024)
    sunlight.shadow.camera.left=-65; sunlight.shadow.camera.right=65
    sunlight.shadow.camera.top=65; sunlight.shadow.camera.bottom=-65
    world.add(sunlight)
    const stone = new THREE.MeshStandardMaterial({ color: 0xd1b995, roughness: 0.95 })
    const darker = new THREE.MeshStandardMaterial({ color: 0x8d785e, roughness: 0.95 })
    const groundMat = new THREE.MeshStandardMaterial({color:year===1700?0xb7a68c:0xc3ad89,roughness:1})
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(200,200),groundMat)
    floor.rotation.x=-Math.PI/2;floor.receiveShadow=true;world.add(floor)
    const path = new THREE.Mesh(new THREE.PlaneGeometry(13,105),new THREE.MeshStandardMaterial({color:0xd4c09b,roughness:1}))
    path.rotation.x=-Math.PI/2;path.position.set(0,0.018,-18);world.add(path)
    function block(x,y,z,w,h,d,material=stone) {
      const obj = new THREE.Mesh(new THREE.BoxGeometry(w,h,d),material)
      obj.position.set(x,y,z);obj.castShadow=true;obj.receiveShadow=true;world.add(obj);return obj
    }
    // Obelisk-inspired landmark; approximate placeholder, not an archaeological reconstruction.
    block(0,0.5,-22,3,1,3,darker)
    block(0,1.45,-22,2.1,1,2.1,stone)
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.65,1.1,13,4),new THREE.MeshStandardMaterial({color:0xab8a70,roughness:0.8}))
    shaft.rotation.y=Math.PI/4;shaft.position.set(0,8.5,-22);shaft.castShadow=true;world.add(shaft)
    const tip=new THREE.Mesh(new THREE.ConeGeometry(0.85,2.2,4),stone)
    tip.rotation.y=Math.PI/4;tip.position.set(0,16,-22);world.add(tip)
    // The architectural masses vary by era, but are deliberately not claims of precise historic positions.
    for (const side of [-1,1]) {
      for (let i=0;i<8;i++) {
        const z=17-i*10
        const width=year===550?8:year===1200?7:6
        const height=year===550?10:year===1200?7:5
        const x=side*(16+(i%2)*2)
        block(x,height/2,z,width,height,8,i%3===0?darker:stone)
        if(year===550) {
          for(let c=0;c<3;c++) {
            const column = new THREE.Mesh(new THREE.CylinderGeometry(0.35,0.4,7,10),stone)
            column.position.set(x-width/2+1.8+c*2.2,4,z+4.3);column.castShadow=true;world.add(column)
          }
        } else if(year===1700) {
          const roof=new THREE.Mesh(new THREE.ConeGeometry(5.8,2.5,4),darker)
          roof.position.set(x,height+1,z);roof.rotation.y=Math.PI/4;world.add(roof)
        } else {
          block(x,height+1,z,width+0.8,2,8.8,darker)
        }
      }
    }
    const keys=new Set()
    const onDown=(e)=>{if(['INPUT','SELECT','TEXTAREA'].includes(e.target?.tagName))return;
      const k=e.key.toLowerCase();if(['w','a','s','d','arrowleft','arrowright','arrowup','arrowdown'].includes(k)){e.preventDefault();keys.add(k)}}
    const onUp=e=>keys.delete(e.key.toLowerCase())
    const onBlur=()=>keys.clear()
    window.addEventListener('keydown',onDown);window.addEventListener('keyup',onUp);window.addEventListener('blur',onBlur)
    const resize=new ResizeObserver(()=>{
      if(!host.clientWidth||!host.clientHeight)return
      camera.aspect=host.clientWidth/host.clientHeight;camera.updateProjectionMatrix()
      renderer.setSize(host.clientWidth,host.clientHeight)
    });resize.observe(host)
    const clock=new THREE.Clock()
    let frame=0, disposed=false
    const animate=()=>{
      if(disposed)return
      frame=requestAnimationFrame(animate)
      const dt=Math.min(clock.getDelta(),0.05)
      if(keys.has('arrowleft'))yaw+=dt*1.35
      if(keys.has('arrowright'))yaw-=dt*1.35
      camera.rotation.set(0,yaw,0,'YXZ')
      const forward=new THREE.Vector3(-Math.sin(yaw),0,-Math.cos(yaw))
      const right=new THREE.Vector3(Math.cos(yaw),0,-Math.sin(yaw))
      const move=new THREE.Vector3()
      if(keys.has('w')||keys.has('arrowup'))move.add(forward)
      if(keys.has('s')||keys.has('arrowdown'))move.sub(forward)
      if(keys.has('d'))move.add(right)
      if(keys.has('a'))move.sub(right)
      if(move.lengthSq()>0){move.normalize().multiplyScalar(dt*6);camera.position.add(move)
        camera.position.x=THREE.MathUtils.clamp(camera.position.x,-11,11)
        camera.position.z=THREE.MathUtils.clamp(camera.position.z,-46,36)}
      renderer.render(world,camera)
    };animate()
    return ()=>{
      disposed=true;cancelAnimationFrame(frame);resize.disconnect()
      window.removeEventListener('keydown',onDown);window.removeEventListener('keyup',onUp);window.removeEventListener('blur',onBlur)
      world.traverse(object=>{if(object.isMesh){object.geometry.dispose();const materials=Array.isArray(object.material)?object.material:[object.material];materials.forEach(m=>m.dispose())}})
      renderer.dispose();renderer.domElement.remove()
    }
  },[year])
  return <div ref={mountRef} style={{height:'100%',width:'100%',background:'#8b8065'}} aria-label="Dreidimensionale historische Demonstrationsszene"/>
}
