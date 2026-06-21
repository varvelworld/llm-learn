// softmax:把一组任意实数变成和为 1 的概率分布。
// 减去最大值是为了数值稳定(避免 exp 溢出)。

export function softmax(logits) {
  const max = Math.max(...logits)
  const exps = logits.map((x) => Math.exp(x - max))
  const sum = exps.reduce((a, b) => a + b, 0)
  return exps.map((e) => e / sum)
}

/** 带温度的 softmax:temperature 越高分布越平,越低越尖锐 */
export function softmaxWithTemperature(logits, temperature = 1) {
  const t = Math.max(temperature, 1e-6)
  return softmax(logits.map((x) => x / t))
}
