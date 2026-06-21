// 缩放点积注意力(Scaled Dot-Product Attention)的逐步分解。
// 返回每一步的中间结果,方便页面把"计算过程"一步步画出来。
import { matmul, transpose, scale } from './tensor.js'
import { softmax } from './softmax.js'

/**
 * @param {number[][]} Q 查询 [seq×d]
 * @param {number[][]} K 键   [seq×d]
 * @param {number[][]} V 值   [seq×d]
 * @param {boolean} causal 是否因果掩码(只能看自己和前面的 token)
 * @returns {{ scores, scaled, weights, output, d }}
 */
export function attention(Q, K, V, causal = true) {
  const d = Q[0].length
  // 1) 打分:Q·Kᵀ -> [seq×seq]
  const scores = matmul(Q, transpose(K))
  // 2) 缩放:除以 sqrt(d),避免点积过大导致 softmax 太尖
  const scaled = scale(scores, 1 / Math.sqrt(d))
  // 3) 因果掩码:位置 i 不能看 j>i
  const masked = scaled.map((row, i) =>
    row.map((v, j) => (causal && j > i ? -Infinity : v))
  )
  // 4) 每一行做 softmax -> 注意力权重 [seq×seq]
  const weights = masked.map((row) => softmax(row))
  // 5) 用权重对 V 加权求和 -> 输出 [seq×d]
  const output = matmul(weights, V)
  return { scores, scaled, weights, output, d }
}
