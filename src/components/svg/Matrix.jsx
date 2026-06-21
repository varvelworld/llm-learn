import { memo, useMemo } from 'react'
import { colorFor } from '../../lib/figure.js'
import { T } from './theme.js'

// 格子层:只依赖数据/尺寸/回调(都需稳定),悬停时不重渲染——这是长序列流畅的关键。
const Cells = memo(function Cells({ data, cell, gx, gy, max, rowWeights, showValues, onHoverCell }) {
  const maxW = rowWeights ? Math.max(1e-6, ...rowWeights) : 1
  return (
    <g>
      {data.map((row, i) => {
        const alpha = rowWeights ? 0.12 + 0.88 * (rowWeights[i] / maxW) : 1
        return row.map((v, j) => (
          <g key={`${i}-${j}`}>
            <rect
              x={gx + j * cell} y={gy + i * cell} width={cell} height={cell}
              fill={colorFor(v, max)} fillOpacity={alpha}
              stroke={T.c.border} strokeWidth={1}
              onMouseEnter={onHoverCell ? () => onHoverCell(i, j) : undefined}
              style={onHoverCell ? { cursor: 'pointer' } : undefined}
            />
            {showValues && (
              <text x={gx + j * cell + cell / 2} y={gy + i * cell + cell * 0.66}
                textAnchor="middle" fontFamily={T.font} fontSize={T.fs} fill="#fff"
                opacity={alpha} pointerEvents="none">{v.toFixed(1)}</text>
            )}
          </g>
        ))
      })}
    </g>
  )
})

// 一张矩阵 = 静态格子层 + 轻量高亮层(行/列/单元格描边)。
export default function Matrix({
  x = 0, y = 0, data, cell = T.cell,
  rowLabels, colLabels, rowLabelW, colLabelH,
  highlightRow = -1, highlightCol = -1, highlightCell,
  onHoverCell, showValues = false, vmax, rowWeights,
}) {
  const rows = data.length
  const cols = data[0].length
  const gx = rowLabelW ?? (rowLabels ? T.labelW : 0)
  const gy = colLabelH ?? (colLabels ? T.colLabelH : 0)
  // data 身份稳定时只算一次,避免每次悬停 O(n²) 求最大值
  const max = useMemo(
    () => vmax ?? Math.max(1e-6, ...data.flat().map((v) => Math.abs(v))),
    [data, vmax]
  )
  const hl = { fill: 'none', stroke: T.c.accent, pointerEvents: 'none' }

  return (
    <g transform={`translate(${x},${y})`}>
      {colLabels &&
        colLabels.map((c, j) => (
          <text key={`c${j}`} x={gx + j * cell + cell / 2} y={gy - 5}
            textAnchor="middle" fontFamily={T.font} fontSize={T.fsLabel}
            fill={j === highlightCol ? T.c.accent : T.c.dim}>{c}</text>
        ))}
      {rowLabels &&
        rowLabels.map((r, i) => (
          <text key={`r${i}`} x={gx - 6} y={gy + i * cell + cell * 0.66}
            textAnchor="end" fontFamily={T.font} fontSize={T.fsLabel}
            fill={i === highlightRow ? T.c.accent : T.c.dim}>
            {i === highlightRow ? '▶ ' : ''}{r}
          </text>
        ))}

      <Cells data={data} cell={cell} gx={gx} gy={gy} max={max}
        rowWeights={rowWeights} showValues={showValues} onHoverCell={onHoverCell} />

      {/* 高亮层:只画几条描边,随悬停更新 */}
      {highlightRow >= 0 && (
        <rect x={gx} y={gy + highlightRow * cell} width={cols * cell} height={cell} strokeWidth={2} {...hl} />
      )}
      {highlightCol >= 0 && (
        <rect x={gx + highlightCol * cell} y={gy} width={cell} height={rows * cell} strokeWidth={2} {...hl} />
      )}
      {highlightCell && (
        <rect x={gx + highlightCell[1] * cell} y={gy + highlightCell[0] * cell}
          width={cell} height={cell} strokeWidth={2.5} {...hl} />
      )}
    </g>
  )
}
