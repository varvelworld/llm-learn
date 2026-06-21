import { useState } from 'react'

// 矩阵乘法网格图:Q 立在左、Kᵀ 躺在上,右下角的 n×n 就是分数。
// 结果某格 (i,j) = Q 的第 i 行 · K 的第 j 行(点积)。
// 鼠标移到结果格上,高亮对应的 Q 行与 K 列,并把点积拆开给线代不熟的人看。

function cellColor(v, vmax) {
  const t = Math.max(-1, Math.min(1, v / (vmax || 1)))
  return t >= 0
    ? `rgba(255,107,107,${0.12 + 0.78 * t})`
    : `rgba(110,168,254,${0.12 + 0.78 * -t})`
}

// Kᵀ 区(列标签 + 说明 + Kᵀ 块 + 间隙)的高度,供外部把别的矩阵对齐到结果块。
const KLABEL_H = 16
const KCAPTION_H = 22
export function matmulHeaderHeight(n, d, cell) {
  const gap = n > 16 ? 8 : 16
  return KLABEL_H + KCAPTION_H + d * cell + gap
}

export default function MatMulGrid({ Q, K, scores, tokens, query = 0, cell: cellProp, showValues, selRow, onSelectRow }) {
  const n = Q.length
  const d = Q[0].length
  // 行可受控(供"追踪某 token"跨步骤高亮);列在组件内部管理(用于点积拆解)
  const [internal, setInternal] = useState({ i: Math.min(query, n - 1), j: 0 })
  const sel = { i: selRow ?? internal.i, j: internal.j }
  const pick = (i, j) => {
    setInternal({ i, j })
    if (onSelectRow) onSelectRow(i)
  }

  const small = n > 8
  const tiny = n > 16
  // 默认尺寸;若外部传入则与流程其它步骤对齐
  const cell = cellProp ?? (tiny ? 16 : small ? 24 : 36)
  const show = showValues ?? !small
  const labelW = cell < 20 ? 18 : 46
  const gap = tiny ? 8 : 16 // Q/Kᵀ 与结果块之间的间隙
  const ioMax = Math.max(1e-6, ...[...Q.flat(), ...K.flat()].map(Math.abs))
  const sMax = Math.max(1e-6, ...scores.flat().map(Math.abs))
  const leftOffset = labelW + d * cell + gap

  const cellBox = (v, vmax, opts = {}) => ({
    width: cell, height: cell, boxSizing: 'border-box',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontFamily: 'var(--mono)', fontSize: 10, color: '#fff',
    background: cellColor(v, vmax), border: '1px solid var(--border)',
    outline: opts.hot ? '2px solid var(--accent)' : opts.soft ? '1px solid var(--accent)' : 'none',
    outlineOffset: -2, cursor: opts.click ? 'pointer' : 'default',
  })

  const tlabel = (t, on) => ({
    fontSize: 10, fontFamily: 'var(--mono)',
    color: on ? 'var(--accent)' : 'var(--text-dim)', fontWeight: on ? 700 : 400,
    overflow: 'hidden', whiteSpace: 'nowrap',
  })

  const qi = Q[sel.i]
  const kj = K[sel.j]
  const terms = qi.map((q, idx) => ({ q, k: kj[idx], p: q * kj[idx] }))
  const val = scores[sel.i][sel.j]

  return (
    <div style={{ overflowX: 'auto' }}>
      <div style={{ minWidth: leftOffset + n * cell }}>
        {/* 顶部:K 的 token 列标签 */}
        <div style={{ display: 'flex', marginLeft: leftOffset, height: KLABEL_H, lineHeight: `${KLABEL_H}px`, overflow: 'hidden' }}>
          {tokens.map((t, j) => (
            <div key={j} style={{ width: cell, textAlign: 'center', ...tlabel(t, j === sel.j) }}>
              {tiny ? '' : t}
            </div>
          ))}
        </div>
        <div style={{ marginLeft: leftOffset, marginBottom: 4, fontSize: 11, color: 'var(--text-dim)', height: KCAPTION_H - 4, lineHeight: `${KCAPTION_H - 4}px`, overflow: 'hidden' }}>
          Kᵀ ↓ 每一列是一个 token 的 K 向量(躺平)
        </div>

        {/* Kᵀ 块:d 行 × n 列 */}
        <div style={{
          marginLeft: leftOffset, display: 'grid',
          gridTemplateColumns: `repeat(${n}, ${cell}px)`, gridTemplateRows: `repeat(${d}, ${cell}px)`,
        }}>
          {Array.from({ length: d }).map((_, r) =>
            tokens.map((_, c) => (
              <div key={`kt-${r}-${c}`} style={cellBox(K[c][r], ioMax, { hot: c === sel.j })}>
                {show ? K[c][r].toFixed(1) : ''}
              </div>
            ))
          )}
        </div>

        {/* Q 行 + 结果 */}
        <div style={{ display: 'flex', marginTop: gap }}>
          {/* Q 的 token 行标签 */}
          <div style={{ width: labelW, display: 'grid', gridTemplateRows: `repeat(${n}, ${cell}px)` }}>
            {tokens.map((t, i) => (
              <div key={i} style={{
                height: cell, display: 'flex', alignItems: 'center', justifyContent: 'flex-end',
                paddingRight: 4, ...tlabel(t, i === sel.i),
              }}>{tiny ? '' : t}</div>
            ))}
          </div>

          {/* Q 块:n 行 × d 列 */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${d}, ${cell}px)`, gridTemplateRows: `repeat(${n}, ${cell}px)`,
          }}>
            {Q.map((row, i) =>
              row.map((v, c) => (
                <div key={`q-${i}-${c}`} style={cellBox(v, ioMax, { hot: i === sel.i })}>
                  {show ? v.toFixed(1) : ''}
                </div>
              ))
            )}
          </div>

          {/* Q 与结果之间的间隙 */}
          <div style={{ width: gap, flexShrink: 0 }} />

          {/* 结果块:n 行 × n 列(= Q·Kᵀ) */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${n}, ${cell}px)`, gridTemplateRows: `repeat(${n}, ${cell}px)`,
          }}>
            {scores.map((row, i) =>
              row.map((v, j) => (
                <div
                  key={`s-${i}-${j}`}
                  onMouseEnter={() => pick(i, j)}
                  style={cellBox(v, sMax, {
                    hot: i === sel.i && j === sel.j,
                    soft: i === sel.i || j === sel.j,
                    click: true,
                  })}
                >{show ? v.toFixed(1) : ''}</div>
              ))
            )}
          </div>
        </div>

        <div style={{ display: 'flex', marginLeft: labelW, marginTop: 4 }}>
          <div style={{ width: d * cell, fontSize: 11, color: 'var(--text-dim)' }}>↑ Q(每行一个查询向量)</div>
          <div style={{ width: gap, flexShrink: 0 }} />
          <div style={{ fontSize: 11, color: 'var(--accent-2)' }}>↑ 结果 = 分数矩阵 Q·Kᵀ</div>
        </div>
      </div>

      {/* 点积拆解 */}
      <div className="matmul-expand">
        <div style={{ marginBottom: 4 }}>
          分数[<b style={{ color: 'var(--accent)' }}>{tokens[sel.i]}</b> 行 · <b style={{ color: 'var(--accent)' }}>{tokens[sel.j]}</b> 列] =
          两个向量逐位相乘再相加:
        </div>
        <div style={{ fontFamily: 'var(--mono)', fontSize: 13, lineHeight: 2 }}>
          {terms.map((t, idx) => (
            <span key={idx}>
              {idx > 0 && ' + '}
              <span title="Q 分量">{t.q.toFixed(1)}</span>×<span title="K 分量">{t.k.toFixed(1)}</span>
            </span>
          ))}
          {'  =  '}
          <b style={{ color: 'var(--accent-2)' }}>{val.toFixed(2)}</b>
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 2 }}>
          点结果里任意一格,或移动鼠标,看它由哪一行 Q、哪一列 K 算出来。
        </div>
      </div>
    </div>
  )
}
