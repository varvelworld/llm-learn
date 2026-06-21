// 带标签和当前值显示的滑块。
export default function Slider({ label, value, min, max, step = 0.01, onChange, fmt }) {
  return (
    <div className="slider-row">
      <label>
        <span>{label}</span>
        <b>{fmt ? fmt(value) : value}</b>
      </label>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
      />
    </div>
  )
}
