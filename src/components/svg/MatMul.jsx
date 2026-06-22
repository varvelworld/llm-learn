import Matrix from './Matrix.jsx'
import { matmulLayout } from '../../lib/figure.js'
import { T } from './theme.js'

// 矩阵乘交叉网格:A 立左、Bᵀ 躺上、结果在右下(渲染成 <g>,用 x/y 定位)。
// 结果块可悬停;A 行 / Bᵀ 列随选中高亮。布局走 lib/figure.matmulLayout。
export default function MatMul({
  x = 0, y = 0, A, Bt, result, cell = T.cell,
  rowLabels, colLabels, // A 的行标签 / Bᵀ 的列标签(通常都是 token)
  selRow = -1, selCol = -1, onHoverCell, onHoverARow, onHoverBtCol,
  vmaxIO, vmaxResult, showValues = false, aRowWeights,
  aLabel = 'Q', bLabel = 'Kᵀ', resultLabel = 'Q·Kᵀ',
}) {
  const m = A.length
  const k = A[0].length
  const p = result[0].length
  const L = matmulLayout({ m, k, p, cell, labelW: T.labelW, colLabelH: T.colLabelH, gap: T.gap })

  return (
    <g transform={`translate(${x},${y})`}>
      {/* A 立左(带行标签),悬停设置查询行 */}
      <Matrix x={L.A.x - T.labelW} y={L.A.y} data={A} cell={cell}
        rowLabels={rowLabels} rowLabelW={T.labelW} highlightRow={selRow} vmax={vmaxIO} showValues={showValues}
        rowWeights={aRowWeights}
        onHoverCell={onHoverARow ? (i) => onHoverARow(i) : undefined} />
      {/* Bᵀ 躺上(带列标签),悬停设置键列 */}
      <Matrix x={L.Bt.x} y={L.Bt.y - T.colLabelH} data={Bt} cell={cell}
        colLabels={colLabels} colLabelH={T.colLabelH} highlightCol={selCol} vmax={vmaxIO} showValues={showValues}
        onHoverCell={onHoverBtCol ? (_t, j) => onHoverBtCol(j) : undefined} />
      {/* 结果(可交互) */}
      <Matrix x={L.result.x} y={L.result.y} data={result} cell={cell}
        highlightRow={selRow} highlightCol={selCol} onHoverCell={onHoverCell}
        vmax={vmaxResult} showValues={showValues} />

      {/* 小标题 */}
      <text x={L.A.x + (k * cell) / 2} y={L.h + 13} textAnchor="middle"
        fontFamily={T.font} fontSize={T.fsLabel} fill={T.c.dim}>{aLabel}</text>
      <text x={L.Bt.x - 6} y={L.Bt.y + (k * cell) / 2} textAnchor="end"
        fontFamily={T.font} fontSize={T.fsLabel} fill={T.c.dim}>{bLabel}</text>
      <text x={L.result.x + (p * cell) / 2} y={L.h + 13} textAnchor="middle"
        fontFamily={T.font} fontSize={T.fsLabel} fill={T.c.accent2}>{resultLabel}</text>
    </g>
  )
}
