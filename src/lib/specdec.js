// 投机解码(speculative decoding)的纯函数数学。
// drafter 草 L 个 token,大模型一次并行验证、接受最长正确前缀。
// 核心 toy 模型:每个 token「被接受且连贯」的概率为 c,接受前缀长度是一段连续命中。
//   P(接受长度 ≥ k) = c^k,   E[接受长度] = Σ_{k=1..L} c^k。
// 并行 drafter 块内 token 独立 → 多峰碰撞,c≈0.5;半自回归(DSpark)建模块内依赖 → c 更高。

/** P(接受长度 ≥ k) 序列,k=1..L(= c^k) */
export function acceptProbs(c, L) {
  const out = []
  let p = 1
  for (let k = 1; k <= L; k++) { p *= c; out.push(p) }
  return out
}

/** 期望接受前缀长度 E = Σ_{k=1..L} c^k */
export function expectedAccept(c, L) {
  return acceptProbs(c, L).reduce((a, b) => a + b, 0)
}

/**
 * 投机解码每个「大模型前向」净产出的 token 数:
 * 接受前缀 E 个,外加被拒处大模型给出的 1 个正确 token。
 * = 相对逐 token 解码的加速比。
 */
export function speedup(c, L) {
  return expectedAccept(c, L) + 1
}

/**
 * 单步接受率 = 草稿分布与大模型分布的「重叠面积」。
 * 投机解码里一个草稿词被接受的概率,对所有词平均后恰为:
 *   Σ_x min(p_d(x), p_t(x)) = 1 − ½·Σ_x |p_d(x) − p_t(x)|（= 1 − 总变差距离）。
 * 两分布越像 → 重叠越大 → 越容易过审。这正是置信度头的训练标签 c*。
 */
export function overlap(pd, pt) {
  return pd.reduce((s, x, i) => s + Math.min(x, pt[i]), 0)
}

/**
 * 前缀存活概率:a_j = ∏_{i≤j} c_i(随 j 单调不增)。
 * c_i 是各位置「在前缀都被接受的条件下能过审」的概率(置信度头预测)。
 */
export function cumSurvival(confs) {
  const out = []
  let p = 1
  for (const c of confs) { p *= c; out.push(p) }
  return out
}

/**
 * 简化版「按负载定验证长度」:保留 a_j ≥ theta 的最长前缀(theta 随系统负载升高)。
 * 真实 DSpark 是最大化吞吐 Θ=τ·SPS(B) 的贪心调度;这里用一个阈值近似
 * 「负载越高 → theta 越高 → 验得越少」这件事。
 */
export function scheduleLength(confs, theta) {
  const a = cumSurvival(confs)
  let l = 0
  for (let j = 0; j < a.length; j++) {
    if (a[j] >= theta) l = j + 1
    else break
  }
  return l
}

/**
 * 并行 drafter 的一次具体抽样:每个位置独立在两个「句意模式」间二选一。
 * 接受前缀 = 从头连续与首 token 同模式的长度(首次「串味」即被拒,其后全废)。
 * @param {number[]} seedRow 每位一个 [-1,1] 的种子数,符号决定选模式 0/1
 */
export function parallelDraft(seedRow, L) {
  const picks = seedRow.slice(0, L).map((v) => (v > 0 ? 1 : 0))
  const mode0 = picks[0]
  let firstCollision = -1
  for (let i = 1; i < L; i++) {
    if (picks[i] !== mode0) { firstCollision = i; break }
  }
  const acceptedLen = firstCollision < 0 ? L : firstCollision
  return { picks, mode0, firstCollision, acceptedLen }
}
