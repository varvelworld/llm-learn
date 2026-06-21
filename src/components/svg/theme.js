// 图解的设计令牌:尺寸 + 颜色(SVG 用十六进制,heat 单元用 figure.colorFor)。
export const T = {
  cell: 26,
  labelW: 40,
  colLabelH: 16,
  gap: 16,
  font: 'ui-monospace, Menlo, monospace',
  fs: 10, // 单元数字字号
  fsLabel: 11, // 标签字号
  c: {
    accent: '#6ea8fe',
    accent2: '#7ee787',
    warn: '#f0a35e',
    border: '#2a2f3a',
    bgElev: '#1e222b',
    text: '#e6e9ef',
    dim: '#9aa3b2',
    bg: '#0f1115',
  },
}
