import { describe, it, expect } from 'vitest'
import { dot, matmul, transpose } from './tensor.js'
import { softmax, softmaxWithTemperature } from './softmax.js'
import { attention } from './attention.js'
import { route } from './moe.js'
import { tokenize } from './tokenizer.js'
import { seededMatrix } from './synth.js'
import { colorFor, matrixWH, matmulLayout } from './figure.js'
import { sinkhorn, rowSums, colSums, gainCurve, spectralRadius } from './manifold.js'
import { acceptProbs, expectedAccept, speedup, parallelDraft, cumSurvival, scheduleLength, overlap } from './specdec.js'
import { ngramHash, allocLoss, ALLOC_OPTIMUM } from './engram.js'

describe('tensor', () => {
  it('dot product', () => {
    expect(dot([1, 2, 3], [4, 5, 6])).toBe(32)
  })
  it('matmul', () => {
    const A = [[1, 2], [3, 4]]
    const B = [[5, 6], [7, 8]]
    expect(matmul(A, B)).toEqual([[19, 22], [43, 50]])
  })
  it('transpose', () => {
    expect(transpose([[1, 2, 3], [4, 5, 6]])).toEqual([[1, 4], [2, 5], [3, 6]])
  })
})

describe('softmax', () => {
  it('sums to 1', () => {
    const p = softmax([1, 2, 3])
    expect(p.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 10)
  })
  it('is monotonic with input', () => {
    const p = softmax([1, 2, 3])
    expect(p[2]).toBeGreaterThan(p[1])
    expect(p[1]).toBeGreaterThan(p[0])
  })
  it('higher temperature flattens distribution', () => {
    const sharp = softmaxWithTemperature([1, 2, 3], 0.5)
    const flat = softmaxWithTemperature([1, 2, 3], 5)
    // 平的分布:最大值更小,最小值更大
    expect(Math.max(...flat)).toBeLessThan(Math.max(...sharp))
  })
})

describe('attention', () => {
  it('weights each row sums to 1', () => {
    const Q = [[1, 0], [0, 1], [1, 1]]
    const K = [[1, 0], [0, 1], [1, 1]]
    const V = [[1, 0], [0, 1], [1, 1]]
    const { weights, output } = attention(Q, K, V, true)
    for (const row of weights) {
      expect(row.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 10)
    }
    expect(output.length).toBe(3)
  })
  it('causal mask: first token only attends to itself', () => {
    const Q = [[1, 2], [3, 4], [5, 6]]
    const K = [[1, 2], [3, 4], [5, 6]]
    const V = [[1, 1], [2, 2], [3, 3]]
    const { weights } = attention(Q, K, V, true)
    expect(weights[0][0]).toBeCloseTo(1, 10)
    expect(weights[0][1]).toBeCloseTo(0, 10)
    expect(weights[0][2]).toBeCloseTo(0, 10)
  })
})

describe('moe route', () => {
  it('selects topK experts whose weights renormalize to 1', () => {
    const tokenVec = [1, 0, 1]
    const gateW = [
      [2, 0, 0], // 专家0 -> 打分 2
      [0, 2, 0], // 专家1 -> 打分 0
      [2, 0, 2], // 专家2 -> 打分 4(最高)
      [0, 0, 0], // 专家3 -> 打分 0
    ]
    const { chosen } = route(tokenVec, gateW, 2)
    expect(chosen.length).toBe(2)
    expect(chosen[0].idx).toBe(2)
    const wsum = chosen.reduce((s, c) => s + c.weight, 0)
    expect(wsum).toBeCloseTo(1, 10)
  })
})

describe('synth', () => {
  it('is deterministic for the same seed', () => {
    expect(seededMatrix(3, 4, 7)).toEqual(seededMatrix(3, 4, 7))
  })
  it('has correct shape and bounded values', () => {
    const m = seededMatrix(5, 4, 1)
    expect(m.length).toBe(5)
    expect(m[0].length).toBe(4)
    for (const row of m) for (const v of row) {
      expect(v).toBeGreaterThanOrEqual(-1)
      expect(v).toBeLessThanOrEqual(1)
    }
  })
})

describe('figure geometry', () => {
  it('colorFor: positive→red-ish, negative→blue-ish, clamps', () => {
    expect(colorFor(1, 1)).toContain('255,107,107')
    expect(colorFor(-1, 1)).toContain('110,168,254')
    expect(colorFor(99, 1)).toBe(colorFor(1, 1)) // 夹住
  })
  it('matrixWH adds label gutters', () => {
    expect(matrixWH({ rows: 3, cols: 4, cell: 10 })).toEqual({ w: 40, h: 30 })
    expect(matrixWH({ rows: 3, cols: 4, cell: 10, rowLabelW: 5, colLabelH: 6 })).toEqual({ w: 45, h: 36 })
  })
  it('matmulLayout places A left, Bt top, result bottom-right', () => {
    const L = matmulLayout({ m: 5, k: 4, p: 5, cell: 10, labelW: 20, colLabelH: 10, gap: 6 })
    expect(L.headerH).toBe(10 + 4 * 10 + 6) // 56
    expect(L.A).toEqual({ x: 20, y: 56 })
    expect(L.Bt).toEqual({ x: 20 + 4 * 10 + 6, y: 10 }) // x=66
    expect(L.result).toEqual({ x: 66, y: 56 })
    expect(L.w).toBe(66 + 5 * 10) // 116
    expect(L.h).toBe(56 + 5 * 10) // 106
  })
})

describe('tokenizer', () => {
  it('splits known words and subwords', () => {
    const toks = tokenize('the cat sat')
    expect(toks.map((t) => t.text)).toEqual(['the', 'cat', 'sat'])
  })
  it('breaks unknown word into subword pieces with ## continuation', () => {
    // 'networking' 不在整词表里,被贪心切成 net + ##work + ##ing
    const toks = tokenize('networking')
    expect(toks.map((t) => t.text)).toEqual(['net', '##work', '##ing'])
  })
  it('assigns stable ids', () => {
    const a = tokenize('cat')[0].id
    const b = tokenize('the cat')[1].id
    expect(a).toBe(b)
  })
})

describe('manifold (mHC)', () => {
  it('sinkhorn 收敛到双随机:行和、列和都≈1', () => {
    const M = [[0.2, 0.9, 0.1], [0.7, 0.3, 0.8], [0.5, 0.4, 0.6]]
    const A = sinkhorn(M, 30)
    for (const s of rowSums(A)) expect(s).toBeCloseTo(1, 5)
    for (const s of colSums(A)) expect(s).toBeCloseTo(1, 5)
  })
  it('双随机矩阵谱半径=1', () => {
    const A = sinkhorn([[0.2, 0.9, 0.1], [0.7, 0.3, 0.8], [0.5, 0.4, 0.6]], 40)
    expect(spectralRadius(A)).toBeCloseTo(1, 3)
  })
  it('未约束矩阵增益爆炸、双随机增益有界', () => {
    const raw = [[0.8, 0.7, 0.9], [0.6, 0.9, 0.7], [0.7, 0.8, 0.6]]
    const x0 = [1, 0.5, -0.3]
    const rawGain = gainCurve(raw, x0, 12).at(-1)
    const dsGain = gainCurve(sinkhorn(raw, 30), x0, 12).at(-1)
    expect(rawGain).toBeGreaterThan(50) // 谱半径>1 → 指数放大
    expect(dsGain).toBeLessThan(2) // 谱半径=1 → 有界
  })
})

describe('specdec (DSpark)', () => {
  it('acceptProbs = c^k', () => {
    expect(acceptProbs(0.5, 3)).toEqual([0.5, 0.25, 0.125])
  })
  it('期望接受长度:并行(c=0.5)饱和、半自回归(c=0.85)更长', () => {
    const par = expectedAccept(0.5, 8)
    const sar = expectedAccept(0.85, 8)
    expect(par).toBeCloseTo(0.996, 2) // → 趋近 1
    expect(sar).toBeGreaterThan(par * 3) // 半自回归显著更长
  })
  it('加速比 = E+1', () => {
    expect(speedup(0.5, 8)).toBeCloseTo(expectedAccept(0.5, 8) + 1, 6)
  })
  it('并行抽样:首次串味即截断接受前缀', () => {
    const r = parallelDraft([0.3, 0.8, -0.4, 0.2, -0.9], 5) // 模式 1,1,0,... → 第 2 位串味
    expect(r.mode0).toBe(1)
    expect(r.firstCollision).toBe(2)
    expect(r.acceptedLen).toBe(2)
  })
})

describe('engram', () => {
  it('ngramHash 确定且落在 [0,B)', () => {
    const a = ngramHash([3, 4, 5], 8)
    const b = ngramHash([3, 4, 5], 8)
    expect(a).toBe(b)
    expect(a).toBeGreaterThanOrEqual(0)
    expect(a).toBeLessThan(8)
    expect(ngramHash([5, 4, 3], 100003)).not.toBe(ngramHash([3, 4, 5], 100003)) // 顺序敏感(大桶下)
  })
  it('稀疏分配律:最优在 ~0.22,两端都更差', () => {
    expect(allocLoss(ALLOC_OPTIMUM)).toBeLessThan(allocLoss(0))
    expect(allocLoss(ALLOC_OPTIMUM)).toBeLessThan(allocLoss(1))
    expect(allocLoss(1)).toBeGreaterThan(allocLoss(0)) // 全记忆比全计算还差
  })
})

describe('specdec · confidence & scheduler', () => {
  it('cumSurvival = 前缀连乘', () => {
    expect(cumSurvival([0.9, 0.8, 0.5])).toEqual([0.9, 0.9 * 0.8, 0.9 * 0.8 * 0.5])
  })
  it('scheduleLength:阈值越高验得越少', () => {
    const c = [0.95, 0.85, 0.6, 0.4]
    expect(scheduleLength(c, 0)).toBe(4) // 全验
    expect(scheduleLength(c, 0.99)).toBe(0) // a_1=0.95<0.99
    const mid = scheduleLength(c, 0.5)
    expect(mid).toBeGreaterThan(0)
    expect(mid).toBeLessThan(4)
    expect(scheduleLength(c, 0.9)).toBeLessThanOrEqual(mid) // 阈值升→更短
  })
})

describe('specdec · overlap (置信度标签)', () => {
  it('overlap = Σmin = 1-½Σ|pd-pt|,完全一致时为 1', () => {
    const pd = [0.5, 0.3, 0.2], pt = [0.4, 0.4, 0.2]
    const tv = 0.5 * pd.reduce((s, x, i) => s + Math.abs(x - pt[i]), 0)
    expect(overlap(pd, pt)).toBeCloseTo(1 - tv, 10)
    expect(overlap(pt, pt)).toBeCloseTo(1, 10)
  })
})
