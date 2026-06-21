// 单步流程控制:上一步 / 下一步,并显示每一步的标题。
export default function StepPlayer({ steps, step, onStep }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
        <button className="btn" disabled={step === 0} onClick={() => onStep(step - 1)}>
          ← 上一步
        </button>
        <button className="btn" disabled={step === steps.length - 1} onClick={() => onStep(step + 1)}>
          下一步 →
        </button>
        <span style={{ color: 'var(--text-dim)', fontSize: 13, marginLeft: 4 }}>
          {step + 1} / {steps.length}
        </span>
      </div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {steps.map((s, i) => (
          <button
            key={i}
            onClick={() => onStep(i)}
            className="btn"
            style={{
              fontSize: 12,
              borderColor: i === step ? 'var(--accent)' : 'var(--border)',
              color: i === step ? 'var(--accent)' : 'var(--text-dim)',
            }}
          >
            {s.label}
          </button>
        ))}
      </div>
    </div>
  )
}
