// 前馈网络(FFN)与激活。FFN 逐 token 独立:把每个 token 的向量先升维、过非线性、再降维。
// 标准 FFN:W2 · relu(W1 · x)
// SwiGLU(LLaMA / DeepSeek 用):门控版 —— (Swish(x·Wg) ⊙ (x·Wu)) · Wd
import { matmul } from './tensor.js'

export const relu = (z) => Math.max(0, z)
/** Swish / SiLU:z·sigmoid(z),平滑、负区有小幅泄漏 */
export const swish = (z) => z / (1 + Math.exp(-z))

/**
 * SwiGLU 前馈,逐 token。
 * @param {number[]} x  输入向量 [d]
 * @param {number[][]} Wg 门投影 [d × dff]
 * @param {number[][]} Wu 值投影 [d × dff]
 * @param {number[][]} Wd 降维投影 [dff × d]
 * @returns {{gate, up, hidden, out}} 各中间量,便于逐步画
 */
export function swiglu(x, Wg, Wu, Wd) {
  const gate = matmul([x], Wg)[0].map(swish) // 门(经 Swish)
  const up = matmul([x], Wu)[0] // 值
  const hidden = gate.map((g, i) => g * up[i]) // 门 ⊙ 值
  const out = matmul([hidden], Wd)[0] // 降回 d
  return { gate, up, hidden, out }
}
