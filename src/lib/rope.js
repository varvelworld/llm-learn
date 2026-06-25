// RoPE(Rotary Position Embedding,旋转位置编码)。
// 思路:把向量按维度两两配对,每一对 (x_{2i}, x_{2i+1}) 看成 2D 平面上的一个点,
// 在位置 m 处把它旋转 m·θ_i 弧度。θ_i = base^(-2i/d) 随维度递减——频率从快到慢。
// 杀手级性质:旋转后 q_m · k_n 只依赖「相对位置 (m − n)」,与绝对位置无关。
import { dot } from './tensor.js'

/** 每一对的角频率 θ_i = base^(-2i/d),共 d/2 个,从快(1)到慢。 */
export function freqs(d, base = 10000) {
  const half = Math.floor(d / 2)
  return Array.from({ length: half }, (_, i) => Math.pow(base, (-2 * i) / d))
}

/** 把一个 2D 向量 (x,y) 旋转 angle 弧度(逆时针)。 */
export function rot2(x, y, angle) {
  const c = Math.cos(angle)
  const s = Math.sin(angle)
  return [x * c - y * s, x * s + y * c]
}

/**
 * 对完整向量 v 施加「位置 m」的 RoPE 旋转,返回旋转后的新向量(长度不变)。
 * @param {number[]} v 原始向量(q 或 k)
 * @param {number} m 位置序号
 * @param {number} base 频率底数
 */
export function applyRope(v, m, base = 10000) {
  const d = v.length
  const th = freqs(d, base)
  const out = new Array(d)
  for (let i = 0; i < th.length; i++) {
    const [a, b] = rot2(v[2 * i], v[2 * i + 1], m * th[i])
    out[2 * i] = a
    out[2 * i + 1] = b
  }
  if (d % 2) out[d - 1] = v[d - 1] // 奇数维:最后一维不配对,原样保留
  return out
}

/** 旋转后 q(位置 m)与 k(位置 n)的点积。 */
export function ropeDot(q, k, m, n, base = 10000) {
  return dot(applyRope(q, m, base), applyRope(k, n, base))
}
