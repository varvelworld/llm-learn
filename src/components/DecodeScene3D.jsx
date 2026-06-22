import { useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls, Text, Line, Html } from '@react-three/drei'

// 第 9 章 3D 模式(react-three-fiber 全场景):
// K/V 缓存、输出是 3D 平面网格;q_t / 分数 / 权重 是真正的圆柱滚轮(格子贴柱面、连续旋转)。
// 当前步转到正前方、与缓存行对齐;前后步绕竖轴卷向两侧。可用鼠标拖拽整体旋转观察。
const CELL = 0.5
const GAP = CELL * 0.08
const DELTA = (18 * Math.PI) / 180 // 每步角度
const RAD = CELL / DELTA // 鼓半径:让相邻步的列在柱面上连成一片
const WIN = 5 // 前后各渲染几步
const BG = [15, 17, 21]
const HOT = [255, 107, 107]
const COLD = [110, 168, 254]

const lerp = (a, b, t) => a + (b - a) * t
function heatColor(v, vmax) {
  const tt = Math.max(-1, Math.min(1, v / (vmax || 1)))
  const k = 0.12 + 0.78 * Math.abs(tt)
  const tgt = tt >= 0 ? HOT : COLD
  const r = Math.round(lerp(BG[0], tgt[0], k))
  const g = Math.round(lerp(BG[1], tgt[1], k))
  const b = Math.round(lerp(BG[2], tgt[2], k))
  return `rgb(${r},${g},${b})`
}
const maxAbs = (arr) => Math.max(1e-6, ...arr.map((v) => Math.abs(v)))

function Cell({ x, y, v, max, outline, opacity = 1, showVal, onOver }) {
  return (
    <group position={[x, y, 0]}>
      {outline && (
        <mesh position={[0, 0, -0.01]}>
          <planeGeometry args={[CELL, CELL]} />
          <meshBasicMaterial color="#6ea8fe" />
        </mesh>
      )}
      <mesh onPointerOver={onOver ? (e) => { e.stopPropagation(); onOver() } : undefined}>
        <planeGeometry args={[CELL - GAP, CELL - GAP]} />
        <meshBasicMaterial color={heatColor(v, max)} transparent opacity={opacity} />
      </mesh>
      {showVal && (
        <Text position={[0, 0, 0.02]} fontSize={CELL * 0.4} color="#fff" anchorX="center" anchorY="middle">
          {v.toFixed(1)}
        </Text>
      )}
    </group>
  )
}

// 2D 平面网格(K / V / 输出)
function FlatGrid({ data, cx, cy = 0, vmax, fade, rowLabels, hlRow = -1, hlCol = -1, showVal, onOver }) {
  const n = data.length
  const m = data[0].length
  const max = vmax ?? maxAbs(data.flat())
  const x0 = cx - ((m - 1) / 2) * CELL
  const y0 = cy + ((n - 1) / 2) * CELL
  return (
    <group>
      {rowLabels &&
        data.map((_, r) => (
          <Text key={`l${r}`} position={[x0 - CELL * 0.85, y0 - r * CELL, 0]} fontSize={CELL * 0.36}
            color={r === hlRow ? '#6ea8fe' : '#9aa3b2'} anchorX="right" anchorY="middle">
            {rowLabels[r]}
          </Text>
        ))}
      {data.map((row, r) =>
        row.map((v, c) => (
          <Cell key={`${r}-${c}`} x={x0 + c * CELL} y={y0 - r * CELL} v={v} max={max}
            outline={r === hlRow || c === hlCol} opacity={fade ? 0.3 + 0.7 * fade[r] : 1}
            showVal={showVal} onOver={onOver ? () => onOver(r, c) : undefined} />
        ))
      )}
    </group>
  )
}

// 圆柱滚轮:每步一列贴在柱面上,绕竖轴旋转,当前步转到正前方
function Reel({ steps, cur, cx, cy, getCol, vmax, hlRow = -1, outlineAll = false, showVal, onOver }) {
  const rot = useRef()
  useFrame(() => {
    if (!rot.current) return
    const tgt = -cur * DELTA
    rot.current.rotation.y += (tgt - rot.current.rotation.y) * 0.18
  })
  return (
    <group position={[cx, cy, -RAD]}>
      <group ref={rot}>
        {steps.map((st, i) => {
          const d = i - cur
          if (Math.abs(d) > WIN) return null
          const active = d === 0
          const col = getCol(st)
          const n = col.length
          const max = vmax ?? maxAbs(col)
          const yTop = ((n - 1) / 2) * CELL
          return (
            <group key={i} rotation={[0, i * DELTA, 0]}>
              <group position={[0, 0, RAD]}>
                {col.map((v, r) => (
                  <Cell key={r} x={0} y={yTop - r * CELL} v={v} max={max}
                    outline={active && (outlineAll || r === hlRow)}
                    opacity={active ? 1 : 0.55} showVal={active && showVal}
                    onOver={active && onOver ? () => onOver(r) : undefined} />
                ))}
              </group>
            </group>
          )
        })}
      </group>
    </group>
  )
}

// 标签用 Html 渲染(系统字体,中文/箭头都清晰,避免 troika 字形缺失)
function Label({ x, y, text, color = '#9aa3b2', size = 12 }) {
  return (
    <Html position={[x, y, 0]} center zIndexRange={[10, 0]} style={{ pointerEvents: 'none' }}>
      <div style={{ fontFamily: 'var(--sans)', fontSize: size, color, whiteSpace: 'nowrap' }}>{text}</div>
    </Html>
  )
}

function flow(ax, ay, bx, by) {
  return <Line points={[[ax, ay, 0], [bx, by, 0]]} color="#3a4150" lineWidth={1} />
}

function Scene({ step, allSteps, t, tokens, fade, sel, dim, mode, onScore, onVCell, onOut }) {
  const cur = t - 1
  const showVal = t <= 7
  const colTopY = ((t - 1) / 2) * CELL // 列顶 y(居中)
  // x 布局(鼓半径 ~1.6,reel 之间要拉开 ~3.4 才不重叠)
  const xK = -7.0
  const xMid = -3.4 // q_t / 分数 共用
  const xW = 0.6 // 权重
  const xV = 4.2
  const xO = 7.0
  // q_t 在分数轮正上方
  const qCy = colTopY + 0.45 + 2 * CELL

  return (
    <>
      <color attach="background" args={['#0f1115']} />
      {/* K 缓存 */}
      <Label x={xK} y={colTopY + 0.55} text="K 缓存(2D)" />
      <FlatGrid data={step.Kc} cx={xK} vmax={undefined} fade={fade} rowLabels={tokens}
        hlRow={mode === 'key' ? sel : -1} showVal={showVal} onOver={(r) => onScore(r)} />

      {/* q_t 轮(分数轮正上方) */}
      <Label x={xMid} y={qCy + 2 * CELL + 0.3} text={`q_t「${allSteps[cur].token}」用完即弃`} color="#6ea8fe" />
      <Reel steps={allSteps} cur={cur} cx={xMid} cy={qCy} getCol={(st) => st.q} showVal={showVal} />
      <Label x={xMid} y={qCy - 2 * CELL - 0.28} text="↓ K·q_t" />

      {/* 分数轮 */}
      <Reel steps={allSteps} cur={cur} cx={xMid} cy={0} getCol={(st) => st.scores}
        hlRow={mode === 'key' ? sel : -1} showVal={showVal} onOver={(r) => onScore(r)} />
      <Label x={xMid} y={-colTopY - 0.4} text="分数轮" />

      {/* 权重轮 */}
      <Reel steps={allSteps} cur={cur} cx={xW} cy={0} getCol={(st) => st.weights} vmax={1}
        hlRow={mode === 'key' ? sel : -1} outlineAll={mode === 'dim'} showVal={showVal} onOver={(r) => onScore(r)} />
      <Label x={xW} y={-colTopY - 0.4} text="权重轮" color="#7ee787" />

      {/* V 缓存 */}
      <Label x={xV} y={colTopY + 0.55} text="V 缓存(2D)" />
      <FlatGrid data={step.Vc} cx={xV} fade={fade} hlCol={dim} showVal={showVal} onOver={(r, c) => onVCell(r, c)} />

      {/* 输出 */}
      <Label x={xO} y={colTopY + 0.55} text="输出 → 下一个词" color="#7ee787" />
      <FlatGrid data={step.out} cx={xO} cy={colTopY - CELL / 2} hlCol={dim} showVal={showVal} onOver={(r, c) => onOut(r, c)} />

      {/* 连线 */}
      {flow(xK + 2 * CELL, 0, xMid - CELL, 0)}
      {flow(xMid + CELL, 0, xW - CELL, 0)}
      {flow(xW + CELL, 0, xV - 2 * CELL, 0)}
      {flow(xV + 2 * CELL, 0, xO - CELL, colTopY - CELL / 2)}

      <OrbitControls enablePan={false} minDistance={8} maxDistance={30} />
    </>
  )
}

export default function DecodeScene3D(props) {
  return (
    <div className="scene3d" style={{ height: 500, background: 'var(--bg)', border: '1px solid var(--border)',
      borderRadius: 10, overflow: 'hidden' }}>
      <Canvas camera={{ position: [1.5, 1.2, 16.5], fov: 44 }} dpr={[1, 2]}>
        <Scene {...props} />
      </Canvas>
    </div>
  )
}
