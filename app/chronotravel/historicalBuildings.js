import * as THREE from 'three'

/** Schematic architecture, NOT an evidence-validated historical reconstruction. */
export function buildHistoricalArchitecture(world, year) {
  const stone = new THREE.MeshStandardMaterial({ color: 0xcab48d, roughness: 0.93 })
  const darkStone = new THREE.MeshStandardMaterial({ color: 0x89755b, roughness: 0.94 })
  const plaster = new THREE.MeshStandardMaterial({ color: 0xd4c6a7, roughness: 0.97 })
  const timber = new THREE.MeshStandardMaterial({ color: 0x624c3b, roughness: 0.96 })
  const roof = new THREE.MeshStandardMaterial({ color: 0x735d54, roughness: 0.95 })
  const allMaterials = [stone, darkStone, plaster, timber, roof]
  const root = new THREE.Group()
  world.add(root)
  function box(x,y,z,w,h,d,material=stone) {
    const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),material)
    mesh.position.set(x,y,z);mesh.castShadow=true;mesh.receiveShadow=true;root.add(mesh)
    return mesh
  }
  function column(x,z,height=5) {
    const mesh=new THREE.Mesh(new THREE.CylinderGeometry(.28,.38,height,10),stone)
    mesh.position.set(x,height/2,z);mesh.castShadow=true;root.add(mesh)
  }
  function arcade(x,z,length=9,height=6) {
    box(x,height-.3,z,length,.6,2.2,darkStone)
    for(let i=0;i<5;i++)column(x-length/2+.6+i*(length-1.2)/4,z+1.15,height-.6)
    box(x,.4,z,length,.8,3,stone)
  }
  function grandstand(side,z,damaged=false) {
    const x=side*18
    for(let tier=0;tier<(damaged?3:6);tier++) {
      const stepsWidth=damaged?6.5:9
      box(x+side*tier*.58,.3+tier*.7,z,stepsWidth,.65,8.5, tier%2?darkStone:stone)
    }
    if(!damaged)arcade(x+side*2,z-3.5,8,6)
    else {
      box(x+side*3,1.6,z-2,4.5,3,2.5,darkStone)
      box(x-side*2,.7,z+2,2,1.4,2.2,stone)
    }
  }
  function imperialLoge() {
    box(0,4,-65,17,8,9,stone)
    arcade(0,-60,14,7)
    box(0,8.8,-65,18,1.6,10,darkStone)
    box(0,1.4,-58,16,2.8,5,stone)
  }
  function cityHouse(x,z,style='byzantine') {
    const h=style==='ottoman'?4.8:5.8
    const w=style==='ottoman'?6.1:5.4
    box(x,h/2,z,w,h,6,plaster)
    box(x,h*.58,z+3.07,w*.76,h*.18,.28,timber)
    for (let i of [-1,1]) box(x+i*1.65,h*.56,z+3.25,.65,1.2,.22,darkStone)
    if(style==='ottoman'){
      const roofMesh=new THREE.Mesh(new THREE.ConeGeometry(5.2,2,4),roof)
      roofMesh.rotation.y=Math.PI/4;roofMesh.position.set(x,h+1,z);roofMesh.castShadow=true;root.add(roofMesh)
      box(x,h*.74,z+3.1,w+1,.25,.6,timber)
    } else {
      box(x,h+.3,z,w+.7,.6,6.8,darkStone)
    }
  }
  function wallSegment(x,z) {
    box(x,3,z,8,6,2,darkStone)
    box(x,6.5,z,8,1,2.5,stone)
    for(let i=-3;i<=3;i+=2)box(x+i,7.4,z,.8,1,.9,stone)
  }
  for(const side of [-1,1]) {
    for(let i=0;i<7;i++) {
      const z=16-i*10
      if(year===550)grandstand(side,z)
      else if(year===1200){
        if(i<3)grandstand(side,z,true)
        else if(i===3)wallSegment(side*18,z)
        else cityHouse(side*17,z,'byzantine')
      } else {
        if(i===2)wallSegment(side*19,z)
        else cityHouse(side*(16+i%2*2),z,'ottoman')
      }
    }
  }
  if(year===550)imperialLoge()
  if(year===1200) {
    wallSegment(-12,-65)
    cityHouse(16,-60,'byzantine')
  }
  if(year===1700) {
    // Open square: modest peripheral buildings rather than a functioning racetrack.
    cityHouse(-12,-61,'ottoman')
    cityHouse(14,-59,'ottoman')
  }
  return () => {
    world.remove(root)
    root.traverse(object=>{if(object.isMesh)object.geometry.dispose()})
    allMaterials.forEach(material=>material.dispose())
  }
}
