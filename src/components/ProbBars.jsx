// 概率分布柱状图。用于 softmax 输出、采样候选等。
export default function ProbBars({ labels, probs, highlight = -1 }) {
  const max = Math.max(...probs, 1e-6)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {labels.map((label, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 70, fontFamily: 'var(--mono)', fontSize: 13,
            color: i === highlight ? 'var(--accent-2)' : 'var(--text)', textAlign: 'right' }}>
            {label}
          </div>
          <div style={{ flex: 1, background: 'var(--bg)', borderRadius: 6, overflow: 'hidden', height: 22 }}>
            <div
              style={{
                width: `${(probs[i] / max) * 100}%`,
                height: '100%',
                background: i === highlight ? 'var(--accent-2)' : 'var(--accent)',
                transition: 'width 0.3s ease',
              }}
            />
          </div>
          <div style={{ width: 52, fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--text-dim)' }}>
            {(probs[i] * 100).toFixed(1)}%
          </div>
        </div>
      ))}
    </div>
  )
}
