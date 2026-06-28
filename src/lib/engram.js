// Engram(条件记忆 / 可扩展查表)的纯函数数学。
// 思路:把最近几个 token 的 n-gram 哈希成一个确定的「桶号」,O(1) 查一张大表取出记忆嵌入。
// 论文:Conditional Memory via Scalable Lookup(DeepSeek 2026,arXiv:2601.07372)。

/**
 * 把一个 n-gram(token id 数组)确定性地哈希成 [0,B) 的桶号。
 * 用 FNV-1a 风格的整数哈希:同样的 n-gram 永远落同一个桶(可复现、O(1))。
 */
export function ngramHash(ids, B) {
  let h = 2166136261 >>> 0
  for (const id of ids) h = Math.imul(h ^ (id >>> 0), 16777619) >>> 0
  return h % B
}

/**
 * 稀疏分配律(toy 示意,形状对齐论文):
 * 把稀疏参数预算的比例 f∈[0,1] 分给「记忆(Engram)」,其余给「计算(MoE)」。
 * 验证损失是 U 形:全计算(f=0)和全记忆(f=1)都不optimal,最低点在 f*≈0.22。
 */
export const ALLOC_OPTIMUM = 0.22
export function allocLoss(f) {
  const fs = ALLOC_OPTIMUM
  return 1 + 3.0 * (f - fs) ** 2 + 0.25 * Math.max(0, f - fs) // 右端(全记忆)更差,轻微不对称
}
