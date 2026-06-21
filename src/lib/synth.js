// 确定性伪随机:同样的种子永远给同样的结果(教学演示要可复现)。
// mulberry32 是个很短的高质量 32 位 PRNG。
function mulberry32(seed) {
  let a = seed >>> 0
  return function () {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * 生成 n×d 的确定性向量矩阵,数值落在 [-1, 1]。
 * 用于按任意序列长度合成 Q/K/V。
 */
export function seededMatrix(n, d, seed = 1) {
  const rng = mulberry32(seed)
  const out = []
  for (let i = 0; i < n; i++) {
    const row = []
    for (let j = 0; j < d; j++) row.push(+(rng() * 2 - 1).toFixed(2))
    out.push(row)
  }
  return out
}
