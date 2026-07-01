import { T } from './theme.js'
import { useT } from '../../i18n/lang.jsx'

// 注意力连线(渲染成 <g>,放进流水线同一块 SVG 画板)。
// 选中的查询 token 用弧线连到它关注的各 key,线越粗/越亮 = 权重越大。
// 几何随 cell 缩放,和上面的矩阵一致。
export function arcsGeom(cell) {
  const bw = cell + 8
  const gap = Math.max(4, Math.round(cell * 0.25))
  const step = bw + gap
  const archH = Math.max(46, cell * 2.4)
  const boxH = Math.max(20, Math.round(cell * 0.9))
  return { bw, gap, step, archH, boxH }
}

export default function AttentionArcs({ x = 0, y = 0, tokens, weights, query, selKey = -1, onSelect, onSelectKey, cell = T.cell }) {
  const t = useT()
  const { bw, step, archH, boxH } = arcsGeom(cell)
  const cx = (i) => i * step + bw / 2
  const w = weights[query] || []

  return (
    <g transform={`translate(${x},${y})`}>
      {/* 弧线:query → 各 key;选中的键用绿色高亮,和 ③ 权重列联动 */}
      {w.map((wt, j) => {
        if (wt < 0.01) return null
        const on = j === selKey
        return (
          <path key={j}
            d={`M ${cx(query)} ${archH} Q ${(cx(query) + cx(j)) / 2} ${archH - archH * (0.35 + 0.65 * wt)} ${cx(j)} ${archH}`}
            fill="none" stroke={on ? T.c.accent2 : T.c.accent} strokeWidth={1 + wt * 8}
            strokeOpacity={on ? 1 : selKey >= 0 ? (0.1 + wt * 0.4) : (0.18 + wt * 0.82)} />
        )
      })}
      {/* token 方块:作查询(蓝)或作选中键(绿框) */}
      {tokens.map((tok, i) => (
        <g key={i} onMouseEnter={() => onSelect(i)}
          onMouseDown={onSelectKey ? (e) => { e.stopPropagation(); onSelectKey(i) } : undefined}
          style={{ cursor: 'pointer' }}>
          <rect x={i * step} y={archH} width={bw} height={boxH} rx={5}
            fill={i === query ? T.c.accent : T.c.bgElev}
            stroke={i === selKey ? T.c.accent2 : T.c.border} strokeWidth={i === selKey ? 2 : 1} />
          <text x={cx(i)} y={archH + boxH * 0.68} textAnchor="middle"
            fontFamily={T.font} fontSize={T.fsLabel} fill={i === query ? '#0f1115' : T.c.text}>{tok}</text>
        </g>
      ))}
      <text x={0} y={archH + boxH + 16} fontFamily={T.font} fontSize={T.fsLabel} fill={T.c.dim}>
        {t('弧越粗 = 权重越大 = ③ 权重列的值;该 token 的值按此权重汇入输出(悬停查询;点 token 选键)',
          'Thicker arc = larger weight = the ③ weight-column value; that token\'s value flows into the output by this weight (hover a query; click a token to pick a key)')}
      </text>
    </g>
  )
}
