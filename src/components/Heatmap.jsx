// 把矩阵(或单个向量)画成彩色格子。值越大越红、越小越蓝。
// 用于嵌入向量、Q/K/V、注意力权重等的可视化。

function cellColor(v, vmax) {
  // v 归一到 [-1,1] 区间映射颜色
  const t = Math.max(-1, Math.min(1, v / (vmax || 1)))
  if (t >= 0) {
    // 0 -> 透明灰,1 -> 暖红
    const a = t
    return `rgba(255, 107, 107, ${0.15 + 0.75 * a})`
  } else {
    const a = -t
    return `rgba(110, 168, 254, ${0.15 + 0.75 * a})`
  }
}

export default function Heatmap({
  matrix,
  rowLabels,
  colLabels,
  vmax,
  showValues = true,
  cell = 40,
  highlightRow = -1,
}) {
  // 允许传一维向量
  const m = Array.isArray(matrix[0]) ? matrix : [matrix]
  const max = vmax ?? Math.max(1e-6, ...m.flat().map((x) => Math.abs(x)))

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ borderCollapse: 'collapse', fontFamily: 'var(--mono)' }}>
        {colLabels && (
          <thead>
            <tr>
              {rowLabels && <th />}
              {colLabels.map((c, j) => (
                <th key={j} style={{ fontSize: 11, color: 'var(--text-dim)', padding: '2px 4px', fontWeight: 400 }}>
                  {c}
                </th>
              ))}
            </tr>
          </thead>
        )}
        <tbody>
          {m.map((row, i) => {
            const hot = i === highlightRow
            return (
            <tr key={i}>
              {rowLabels && (
                <td style={{ fontSize: 12, paddingRight: 8, textAlign: 'right',
                  color: hot ? 'var(--accent)' : 'var(--text-dim)', fontWeight: hot ? 700 : 400 }}>
                  {hot ? '▶ ' : ''}{rowLabels[i]}
                </td>
              )}
              {row.map((v, j) => (
                <td
                  key={j}
                  style={{
                    width: cell,
                    height: cell,
                    minWidth: cell,
                    textAlign: 'center',
                    fontSize: 11,
                    color: '#fff',
                    background: cellColor(v, max),
                    border: '1px solid var(--border)',
                    outline: hot ? '2px solid var(--accent)' : 'none',
                    outlineOffset: '-2px',
                  }}
                  title={String(v)}
                >
                  {showValues ? v.toFixed(2) : ''}
                </td>
              ))}
            </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
