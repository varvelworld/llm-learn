// 注意力连线图:一排 token,选中某个作为"查询"位置,
// 画出它对其他 token 的注意力强度(弧线越粗/越亮 = 权重越大)。
export default function AttentionView({ tokens, weights, query, onSelectQuery }) {
  const n = tokens.length
  // 序列越长,token 框越窄,避免画面无限变宽
  const boxW = n > 24 ? 22 : n > 12 ? 36 : 64
  const gap = n > 24 ? 4 : n > 12 ? 8 : 16
  const showText = n <= 24
  const width = n * boxW + (n - 1) * gap
  const archHeight = 90
  const svgH = archHeight + 50
  const centerX = (i) => i * (boxW + gap) + boxW / 2
  const baseY = svgH - 30
  const w = weights[query] || []

  return (
    <div style={{ overflowX: 'auto' }}>
      <svg width={width} height={svgH}>
        {/* 弧线:从 query 到每个 key */}
        {w.map((weight, j) => {
          if (weight < 0.001) return null
          const x1 = centerX(query)
          const x2 = centerX(j)
          const mx = (x1 + x2) / 2
          const lift = baseY - archHeight * (0.4 + 0.6 * weight)
          return (
            <path
              key={j}
              d={`M ${x1} ${baseY} Q ${mx} ${lift} ${x2} ${baseY}`}
              fill="none"
              stroke="var(--accent)"
              strokeWidth={1 + weight * 8}
              strokeOpacity={0.2 + weight * 0.8}
            />
          )
        })}
        {/* token 方块 */}
        {tokens.map((t, i) => (
          <g key={i} onClick={() => onSelectQuery(i)} style={{ cursor: 'pointer' }}>
            <rect
              x={i * (boxW + gap)}
              y={baseY}
              width={boxW}
              height={28}
              rx={6}
              fill={i === query ? 'var(--accent)' : 'var(--bg-elev)'}
              stroke="var(--border)"
            />
            {showText && (
              <text
                x={centerX(i)}
                y={baseY + 19}
                textAnchor="middle"
                fontFamily="var(--mono)"
                fontSize="13"
                fill={i === query ? '#0f1115' : 'var(--text)'}
              >
                {t}
              </text>
            )}
          </g>
        ))}
      </svg>
      <p style={{ fontSize: 13, color: 'var(--text-dim)', marginTop: 4 }}>
        点任意 token 作为「查询」位置 · 当前:<b style={{ color: 'var(--accent)' }}>{tokens[query]}</b>
        (因果掩码:只能看自己和左边)
      </p>
    </div>
  )
}
