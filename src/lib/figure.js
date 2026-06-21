// 图解的几何/着色:纯函数,可单测。组件只负责把这些坐标画成 SVG。

// 值 → 颜色:正数偏红、负数偏蓝,强度随 |v|/vmax。返回 rgba 字符串。
export function colorFor(v, vmax) {
  const t = Math.max(-1, Math.min(1, v / (vmax || 1)))
  return t >= 0
    ? `rgba(255,107,107,${0.12 + 0.78 * t})`
    : `rgba(110,168,254,${0.12 + 0.78 * -t})`
}

// 一张矩阵(含可选行/列标签留白)的像素尺寸。
export function matrixWH({ rows, cols, cell, rowLabelW = 0, colLabelH = 0 }) {
  return { w: rowLabelW + cols * cell, h: colLabelH + rows * cell }
}

// 矩阵乘法交叉布局:A 立左、Bᵀ 躺上、结果在右下。
// 返回三块的局部坐标(grid 原点)、整体尺寸,以及"表头高度"(结果块距顶)。
// m×k 的 A,k×p 的 Bᵀ,m×p 的结果。
export function matmulLayout({ m, k, p, cell, labelW, colLabelH, gap }) {
  const headerH = colLabelH + k * cell + gap // 结果块 / A 块的顶部 y
  const rightX = labelW + k * cell + gap // 结果块 / Bᵀ 块的左 x
  return {
    A: { x: labelW, y: headerH },
    Bt: { x: rightX, y: colLabelH },
    result: { x: rightX, y: headerH },
    headerH,
    w: rightX + p * cell,
    h: headerH + m * cell,
  }
}
