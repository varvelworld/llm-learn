// mHC(流形约束超连接)的纯函数数学:双随机矩阵 / Sinkhorn–Knopp / 信号增益。
// 核心:把流间混合矩阵约束成「双随机」(行和、列和都=1),谱半径=1,
// 反复跨层作用时信号既不指数爆炸、也不指数衰减。

/** 每行的和 */
export function rowSums(M) {
  return M.map((r) => r.reduce((a, b) => a + b, 0))
}

/** 每列的和 */
export function colSums(M) {
  const n = M.length
  const m = M[0].length
  const c = new Array(m).fill(0)
  for (let i = 0; i < n; i++) for (let j = 0; j < m; j++) c[j] += M[i][j]
  return c
}

/**
 * Sinkhorn–Knopp:交替把每行、每列归一化到「和为 1」,迭代 iters 次。
 * 对非负矩阵会收敛到「双随机矩阵」。iters=0 时原样返回(未约束)。
 * DeepSeek-V4 的 mHC 实用 t_max=20。
 */
export function sinkhorn(M, iters) {
  let A = M.map((r) => r.slice())
  for (let t = 0; t < iters; t++) {
    A = A.map((r) => { const s = r.reduce((a, b) => a + b, 0) || 1; return r.map((x) => x / s) }) // 行归一
    const cs = colSums(A)
    A = A.map((r) => r.map((x, j) => x / (cs[j] || 1))) // 列归一
  }
  return A
}

/** 矩阵 × 向量 */
export function matVec(M, x) {
  return M.map((r) => r.reduce((s, v, j) => s + v * x[j], 0))
}

/** L2 范数 */
export function l2(x) {
  return Math.sqrt(x.reduce((s, v) => s + v * v, 0))
}

/**
 * 信号增益曲线:把混合矩阵 M 反复作用在 x0 上,
 * 返回每层的 ||M^l x0|| / ||x0||(l=0..L)。
 * 双随机 → 谱半径 1 → 增益≈常数(稳);未约束随机矩阵 → 谱半径>1 → 指数爆炸。
 */
export function gainCurve(M, x0, L) {
  const base = l2(x0) || 1
  let x = x0.slice()
  const out = [l2(x) / base]
  for (let l = 0; l < L; l++) {
    x = matVec(M, x)
    out.push(l2(x) / base)
  }
  return out
}

/**
 * 幂迭代估「谱半径」(最大特征值的绝对值)。
 * 对非负矩阵由 Perron–Frobenius 保证收敛;双随机矩阵恰为 1。
 */
export function spectralRadius(M, iters = 80) {
  const n = M.length
  let x = new Array(n).fill(1 / Math.sqrt(n))
  let lam = 0
  for (let t = 0; t < iters; t++) {
    const y = matVec(M, x)
    lam = l2(y) // x 为单位向量 → ||Mx|| 收敛到主特征值绝对值
    if (lam === 0) break
    x = y.map((v) => v / lam)
  }
  return lam
}
