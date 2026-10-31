'use client'
import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { buildHistoricalArchitecture } from './historicalBuildings'
import { createHistoricalStreetLife } from './historicalStreetLife'

/** Lightweight desktop WebGL prototype; no persistent game state. */
export default function HistoricalThreeScene({ year, onShopChange }) {
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
    const disposeArchitecture = buildHistoricalArchitecture(world, year)
    const streetLife = createHistoricalStreetLife(world, year)
    // A small interior prototype, separate from the persistently simulated world.
    const shop = new THREE.Group()
    world.add(shop)
    const plaster = new THREE.MeshStandardMaterial({color:0xbfb098, side:THREE.DoubleSide})
    const wood = new THREE.MeshStandardMaterial({color:0x694d36})
    const goodsMat = new THREE.MeshStandardMaterial({color:0xb77d50})
    function shopBox(x,y,z,w,h,d,mat=wood) {
      const obj=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat)
      obj.position.set(x,y,z);obj.castShadow=true;shop.add(obj)
    }
    shopBox(0,-.12,0,12,.2,11,plaster)
    shopBox(0,3,-5.5,12,6,.2,plaster)
    shopBox(-6,3,0,.2,6,11,plaster)
    shopBox(6,3,0,.2,6,11,plaster)
    shopBox(0,6,0,12,.2,11,wood)
    shopBox(-3,1,-3.5,4,2,1.2,wood)
    shopBox(3,1,-3.5,4,2,1.2,wood)
    shopBox(0,.7,-1.3,3,1.4,1,wood)
    for(let i=0;i<8;i++){
      const jar = new THREE.Mesh(new THREE.CylinderGeometry(.23,.38,.8,12),goodsMat)
      jar.position.set(i<4?-4.5+i*.85:1.5+(i-4)*.85,2.5,-3.5)
      shop.add(jar)
    }
    const merchant=new THREE.Group()
    const body=new THREE.Mesh(new THREE.CylinderGeometry(.45,.55,1.4,12),new THREE.MeshStandardMaterial({color:0x52676a}))
    body.position.y=1.05;merchant.add(body)
    const face=new THREE.Mesh(new THREE.SphereGeometry(.3,12,10),new THREE.MeshStandardMaterial({color:0xbc9273}))
    face.position.y=2.06;merchant.add(face)
    merchant.position.set(0,0,-3)
    shop.add(merchant)
    shop.visible=false
    let inside=false
    const shopEntry={x:0,z:8}
    const entranceMarker = new THREE.Mesh(new THREE.TorusGeometry(.75,.13,8,24),new THREE.MeshBasicMaterial({color:0xf3d18b}))
    entranceMarker.position.set(0,2.5,8);world.add(entranceMarker)
    const switchShop=()=>{
      inside=!inside
      shop.visible=inside
      entranceMarker.visible=!inside
      if(inside){camera.position.set(0,1.75,3.6);yaw=0}
      else{camera.position.set(0,1.75,11);yaw=0}
      onShopChange?.(inside)
    }
    const keys=new Set()
    const onDown=(e)=>{if(['INPUT','SELECT','TEXTAREA'].includes(e.target?.tagName))return;
      const k=e.key.toLowerCase();if(k==='e' && !e.repeat){e.preventDefault();if(inside || Math.hypot(camera.position.x-shopEntry.x,camera.position.z-shopEntry.z)<4)switchShop();return}if(['w','a','s','d','arrowleft','arrowright','arrowup','arrowdown'].includes(k)){e.preventDefault();keys.add(k)}}
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
      if(move.lengthSq()>0){
        move.normalize().multiplyScalar(dt*6)
        const nextX=camera.position.x+move.x
        const nextZ=camera.position.z+move.z
        if(inside){
          if(Math.abs(nextX)<5.5)camera.position.x=nextX
          if(nextZ>-4.6 && nextZ<4.7)camera.position.z=nextZ
        } else {
          if(streetLife.isWalkable(nextX,camera.position.z))camera.position.x=nextX
          if(streetLife.isWalkable(camera.position.x,nextZ))camera.position.z=nextZ
        }
      }
      if(!inside)streetLife.update(dt)
      renderer.render(world,camera)
    };animate()
    return ()=>{
      disposed=true;cancelAnimationFrame(frame);resize.disconnect()
      window.removeEventListener('keydown',onDown);window.removeEventListener('keyup',onUp);window.removeEventListener('blur',onBlur)
      onShopChange?.(false)
      world.remove(entranceMarker)
      entranceMarker.geometry.dispose();entranceMarker.material.dispose()
      world.remove(shop)
      shop.traverse(obj=>{if(obj.isMesh){obj.geometry.dispose();obj.material.dispose()}})
      streetLife.dispose()
      disposeArchitecture()
      world.traverse(object=>{if(object.isMesh){object.geometry.dispose();const materials=Array.isArray(object.material)?object.material:[object.material];materials.forEach(m=>m.dispose())}})
      renderer.dispose();renderer.domElement.remove()
    }
  },[year, onShopChange])
  return <div ref={mountRef} style={{height:'100%',width:'100%',background:'#8b8065'}} aria-label="Dreidimensionale historische Demonstrationsszene"/>
}
