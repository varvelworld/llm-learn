// MoE(混合专家)路由的极简版,体现 DeepSeek 的两个要点:
//   1) top-k 路由:每个 token 只激活少数几个专家(稀疏)
//   2) 共享专家:一个所有 token 都会经过的专家(DeepSeek 的设计)
import { softmax } from './softmax.js'

/**
 * @param {number[]} tokenVec     token 的隐藏向量 [d]
 * @param {number[][]} gateW       门控权重 [numExperts×d],决定路由分数
 * @param {number} topK            每个 token 激活的路由专家数
 * @returns {{ logits, probs, chosen }}
 *   logits: 各专家原始分数; probs: softmax 后的概率;
 *   chosen: 被选中的专家索引(按分数从高到低)及其归一化权重
 */
export function route(tokenVec, gateW, topK = 2) {
  const logits = gateW.map((w) => w.reduce((s, wi, i) => s + wi * tokenVec[i], 0))
  const probs = softmax(logits)
  const ranked = probs
    .map((p, idx) => ({ idx, p }))
    .sort((a, b) => b.p - a.p)
    .slice(0, topK)
  // 选中专家的权重重新归一化(只在被选中的几个里分配)
  const sum = ranked.reduce((s, r) => s + r.p, 0)
  const chosen = ranked.map((r) => ({ idx: r.idx, weight: r.p / sum, raw: r.p }))
  return { logits, probs, chosen }
}

/**
 * 统计一批 token 的专家负载,用来演示"负载均衡"问题。
 * @param {number[][]} tokenVecs  多个 token [n×d]
 * @param {number[][]} gateW
 * @param {number} topK
 * @returns {number[]} 每个专家被分到的 token 计数
 */
export function expertLoad(tokenVecs, gateW, topK = 2) {
  const load = new Array(gateW.length).fill(0)
  for (const t of tokenVecs) {
    const { chosen } = route(t, gateW, topK)
    for (const c of chosen) load[c.idx] += 1
  }
  return load
}
