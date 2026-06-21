// 极简张量工具:都是纯函数,只处理一维数组(向量)和二维数组(矩阵)。
// 维度故意取很小,方便教学时把每个数都看清楚。

/** 点积:两个等长向量 */
export function dot(a, b) {
  let s = 0
  for (let i = 0; i < a.length; i++) s += a[i] * b[i]
  return s
}

/** 矩阵 × 矩阵。A: [m×k], B: [k×n] -> [m×n] */
export function matmul(A, B) {
  const m = A.length
  const k = A[0].length
  const n = B[0].length
  const out = Array.from({ length: m }, () => new Array(n).fill(0))
  for (let i = 0; i < m; i++) {
    for (let j = 0; j < n; j++) {
      let s = 0
      for (let p = 0; p < k; p++) s += A[i][p] * B[p][j]
      out[i][j] = s
    }
  }
  return out
}

/** 矩阵转置 */
export function transpose(A) {
  const m = A.length
  const n = A[0].length
  const out = Array.from({ length: n }, () => new Array(m).fill(0))
  for (let i = 0; i < m; i++)
    for (let j = 0; j < n; j++) out[j][i] = A[i][j]
  return out
}

/** 矩阵每个元素乘以标量 */
export function scale(A, s) {
  return A.map((row) => row.map((v) => v * s))
}

/** 向量加法 */
export function addVec(a, b) {
  return a.map((v, i) => v + b[i])
}

/** L2 范数 */
export function norm(a) {
  return Math.sqrt(dot(a, a))
}
