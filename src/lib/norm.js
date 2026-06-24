// RMSNorm:只按"均方根"缩放,不像 LayerNorm 那样减均值,也没有偏置。
// rms(x) = sqrt( mean(x_i^2) + eps );  output_i = x_i / rms(x) * g_i
// g 是逐维的可学习增益(gain)。比 LayerNorm 更省、更稳,LLaMA / DeepSeek 都用它。

/** 均方根(含数值稳定项 eps) */
export function rms(v, eps = 1e-5) {
  const ms = v.reduce((s, x) => s + x * x, 0) / v.length
  return Math.sqrt(ms + eps)
}

/**
 * RMSNorm。
 * @param {number[]} v 输入向量
 * @param {number[]} [g] 逐维增益,缺省全 1
 * @param {number} [eps]
 * @returns {number[]}
 */
export function rmsNorm(v, g, eps = 1e-5) {
  const r = rms(v, eps)
  return v.map((x, i) => (x / r) * (g ? g[i] : 1))
}
