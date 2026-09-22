import {
  SHACKLETON_BASE_ALPHA_FRAME,
  SHACKLETON_BASE_ALPHA_LOGISTICS,
  SHACKLETON_BASE_ALPHA_NODES,
  SHACKLETON_BASE_ALPHA_WAREHOUSE_ID,
  getShackletonStarterNode,
  getWarehouseFlows,
} from './shackletonBaseAlphaSeed'

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

assert(SHACKLETON_BASE_ALPHA_FRAME === 'moon_shackleton_enu_v1', 'Starter base must use the canonical Shackleton ENU frame')

const ids = new Set(SHACKLETON_BASE_ALPHA_NODES.map(node => node.id))
assert(ids.size === SHACKLETON_BASE_ALPHA_NODES.length, 'Starter node ids must be unique')

const requiredRoles = [
  'habitat',
  'life-support',
  'power-generation',
  'power-storage',
  'warehouse',
  'workshop',
  'rover-yard',
  'communications',
  'landing-cargo',
] as const

for (const role of requiredRoles) {
  assert(SHACKLETON_BASE_ALPHA_NODES.some(node => node.role === role), `Missing required Shackleton starter role: ${role}`)
}

const warehouse = getShackletonStarterNode(SHACKLETON_BASE_ALPHA_WAREHOUSE_ID)
assert(warehouse?.role === 'warehouse', 'Canonical warehouse id must resolve to the warehouse node')
assert(warehouse.catalogEntityId === 'warehouse', 'Shackleton warehouse must reuse the canonical warehouse gameplay entity')

for (const edge of SHACKLETON_BASE_ALPHA_LOGISTICS) {
  assert(ids.has(edge.from), `Unknown logistics edge source: ${edge.from}`)
  assert(ids.has(edge.to), `Unknown logistics edge destination: ${edge.to}`)
}

const warehouseFlows = getWarehouseFlows()
assert(warehouseFlows.length >= 5, 'Warehouse must be a real hub with multiple operational flows')
assert(warehouseFlows.some(edge => edge.flow === 'incoming-cargo'), 'Warehouse must receive incoming cargo')
assert(warehouseFlows.some(edge => edge.flow === 'maintenance-supply'), 'Warehouse must feed maintenance/workshop supply')
assert(warehouseFlows.some(edge => edge.flow === 'local-distribution'), 'Warehouse must feed local distribution')
assert(warehouseFlows.some(edge => edge.flow === 'surface-to-orbit'), 'Warehouse must connect back to the landing/cargo chain')

const landing = SHACKLETON_BASE_ALPHA_NODES.find(node => node.role === 'landing-cargo')
assert(landing, 'Landing/cargo node must exist')
assert(
  SHACKLETON_BASE_ALPHA_LOGISTICS.some(edge => edge.from === landing.id && edge.to === warehouse.id && edge.corridor === 'hardened-road'),
  'Landing/cargo must have a direct hardened freight corridor to the warehouse',
)

for (const node of SHACKLETON_BASE_ALPHA_NODES) {
  assert(Number.isFinite(node.xM) && Number.isFinite(node.yM), `Starter node ${node.id} must have finite ENU coordinates`)
  assert(Math.abs(node.xM) <= 300 && Math.abs(node.yM) <= 300, `Starter node ${node.id} must stay inside the current 600 m LOLA preview footprint`)
}

console.log('Shackleton Base Alpha seed invariants: OK')
