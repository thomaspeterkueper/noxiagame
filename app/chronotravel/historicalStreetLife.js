import * as THREE from 'three'

/** Local visual-only historical population and route. No Core NPC or persistence side effects. */
export function createHistoricalStreetLife(world, year) {
  const root = new THREE.Group()
  world.add(root)
  const road = new THREE.MeshStandardMaterial({ color: 0xaca087, roughness: 1 })
  const door = new THREE.MeshStandardMaterial({ color: 0x574433, roughness: 0.9 })
  const cloth = [
    new THREE.MeshStandardMaterial({ color: 0x5b6970 }),
    new THREE.MeshStandardMaterial({ color: 0x9d6d51 }),
    new THREE.MeshStandardMaterial({ color: 0x647455 }),
    new THREE.MeshStandardMaterial({ color: 0xa9926e }),
  ]
  const skin = new THREE.MeshStandardMaterial({ color: 0xbd9479 })
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(9, 95), road)
  floor.rotation.x = -Math.PI / 2; floor.position.set(0, .025, -16); floor.receiveShadow = true; root.add(floor)

  // Clearly marked entrance prototypes adjacent to buildings, not interactive interiors yet.
  const entrances = year===550 ? [] : [-1,1].flatMap(side =>
    [16,6,-4,-14,-24,-34].filter((_,i)=>year===1700 || i>=3).map(z=>({x:side*13,z})))
  for(const e of entrances) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(1.5,2.6,.12), door)
    mesh.position.set(e.x,1.3,e.z)
    mesh.rotation.y = e.x<0 ? Math.PI/2 : -Math.PI/2
    root.add(mesh)
  }

  // A few unlabelled era-inspired figurines; NOT verified historical characters.
  const walkers = Array.from({length: 6}, (_,i)=>{
    const actor = new THREE.Group()
    const torso = new THREE.Mesh(new THREE.CylinderGeometry(.32,.45,1.2,8),cloth[i%cloth.length])
    torso.position.y=1.1;actor.add(torso)
    const head = new THREE.Mesh(new THREE.SphereGeometry(.24,10,8),skin)
    head.position.y=1.9;actor.add(head)
    const legMat = cloth[(i+1)%cloth.length]
    for(const dx of [-.15,.15]){
      const leg=new THREE.Mesh(new THREE.BoxGeometry(.2,.55,.23),legMat)
      leg.position.set(dx,.28,0);actor.add(leg)
    }
    const lane=i%2===0?-4.2:4.2
    actor.position.set(lane,0,20-i*11)
    root.add(actor)
    return {actor,lane,phase:i*9.7,speed:.55+(i%3)*.19}
  })
  let t=0
  function update(delta) {
    t+=Math.min(delta,.05)
    for(const w of walkers){
      const phase=(w.phase+t*w.speed)%85
      const z=23-phase
      w.actor.position.set(w.lane+Math.sin(t*.7+w.phase)*.3,0,z)
      w.actor.rotation.y=Math.PI
    }
  }
  function isWalkable(x,z) {
    if(x < -10.5 || x > 10.5 || z < -49 || z > 35)return false
    // Central obelisk pedestal: basic radial collision boundary.
    if(Math.abs(x)<2.7 && Math.abs(z+22)<2.7)return false
    return true
  }
  function dispose(){
    world.remove(root)
    root.traverse(object=>{
      if(object.isMesh) {
        object.geometry.dispose()
      }
    })
    ;[road,door,skin,...cloth].forEach(m=>m.dispose())
  }
  return {update,isWalkable,dispose,entrances}
}
