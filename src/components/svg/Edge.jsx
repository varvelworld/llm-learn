import { T } from './theme.js'

// 连线箭头(同一 <svg> 坐标系内)。from→to,可弧形,可带多行标签。
export default function Edge({ from, to, label, arc = 0, color = T.c.dim, labelColor = T.c.accent }) {
  const mx = (from.x + to.x) / 2
  const my = (from.y + to.y) / 2
  const cx = mx
  const cy = my - arc // 控制点上抬形成弧
  const d = arc
    ? `M ${from.x} ${from.y} Q ${cx} ${cy} ${to.x} ${to.y}`
    : `M ${from.x} ${from.y} L ${to.x} ${to.y}`

  // 箭头方向:从控制点(弧)或起点(直线)指向终点
  const ax = arc ? cx : from.x
  const ay = arc ? cy : from.y
  const angle = (Math.atan2(to.y - ay, to.x - ax) * 180) / Math.PI
  const s = 7

  const lines = label ? String(label).split('\n') : []
  const lx = mx
  // 多行整体抬到线上方:最后一行也距线 8px,行距 12px
  const ly = (arc ? cy : my) - 8 - (lines.length - 1) * 12

  return (
    <g>
      <path d={d} fill="none" stroke={color} strokeWidth={1.5} />
      <polygon points={`0,0 ${-s},${-s / 2} ${-s},${s / 2}`}
        fill={color} transform={`translate(${to.x},${to.y}) rotate(${angle})`} />
      {lines.map((ln, i) => (
        <text key={i} x={lx} y={ly + i * 12} textAnchor="middle"
          fontFamily={T.font} fontSize={T.fsLabel} fill={labelColor}>{ln}</text>
      ))}
    </g>
  )
}
