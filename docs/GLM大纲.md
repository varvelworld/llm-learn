# 第三部分 · GLM(规划大纲 / 草案)

> 状态:**结构草案,待核实后开建**。沿用 [[CLAUDE.md]] 三支柱(可拖动 toy 图 + LaTeX + 零基础)与铁律(动笔前权威核对)。
> 定位:读者已学完标准 Transformer(第一部分)与 DeepSeek 的 MLA/MoE/MTP/稀疏注意力(第二部分),
> 故 GLM 部分用**对比式**讲——同一问题 GLM 做了哪些不同取舍,以及 GLM-5.2 的新东西。章节用 G1–G7 前缀。

| 章 | 标题 | 核心(GLM 的独特取舍) | 对照/复用 | 主要权威源 |
|---|---|---|---|---|
| G1 | GLM 是什么 · 渊源与版本演进 | 起源:**自回归空白填充**训练目标(区别于纯左到右 GPT);现代 GLM-4/5 已转标准解码器。版本表 GLM-4→4.5→5→5.2 | Ch00 | GLM 2021(arXiv:2103.10360)、GLM-130B(2210.02414)、ChatGLM/GLM-4(2406.12793) |
| G2 | QK-Norm · 稳定注意力打分 | 算 q·k **之前**对 Q、K 各做一次归一化,防打分爆掉 | Ch04、Ch07 | GLM-4.5(2508.06471) |
| G3 | 部分 RoPE + GQA · GLM-4.5 注意力 | **只给一部分维度加 RoPE**;**GQA** 共享 KV 头(对照 DeepSeek 走 MLA) | Ch03、Ch05、Ch11 | GLM-4.5(2508.06471) |
| G4 | Sigmoid 门控 MoE · GLM 的稀疏专家 | 路由用 **sigmoid 门**、**深而窄**、无辅助损失均衡 —— 对照 DeepSeekMoE | Ch12 | GLM-4.5(2508.06471)、GLM-5(2602.15763) |
| G5 | GLM-5.2 IndexShare · 1M 上下文关键 ⭐ | 稀疏注意力 **top-k 索引在相邻几层之间复用**,省重复选键 → 1M 上下文每 token FLOPs 降 ~2.9× | Ch14/15/16 | GLM-5(2602.15763)、GLM-5.2 发布(2026.6) |
| G6 | MTP 与投机解码(GLM 版) | GLM 也用多 token 预测,5.2 接受长度 +20% | 第二部分 MTP | GLM-5(2602.15763) |
| G7 | 全景对比 · DeepSeek vs GLM | 两条开源路线对照:注意力、MoE 路由、稀疏注意力(DSA/CSA vs DSA+IndexShare)、长上下文打法 | 收尾 | 综合 |

## ✅ 核实结论(已查证,多源印证)

1. **GLM-5/5.2 注意力 = MLA(非 GQA)**:GLM-4.5 是 GQA+部分 RoPE;**GLM-5 转向并趋同 DeepSeek**——
   用 **MLA + DSA**、RoPE(MLA 式解耦)、MoE(256 专家/80 层/40B 激活)、MTP。GLM-5 报告(2602.15763)摘要明确
   "adopts DSA";多源印证 MLA。→ G3 仍讲 GLM-4.5 的 GQA+部分 RoPE,但注明 GLM-5 后改 MLA;G5 聚焦 IndexShare。
2. **IndexShare = GLM-5.2 的独门增量**:在 DSA 之上,跨相邻层复用稀疏 top-k 索引 → 1M 上下文、FLOPs 降 ~2.9×。
3. 故事线确定:**GLM-4.5 分叉 → GLM-5 趋同(MLA+DSA)→ GLM-5.2 增量(IndexShare)**。

> 仍待坐实(写 G5 前):IndexShare 跨层共享的精确对象(top-k 索引 vs 索引器输出)从 GLM-5 报告原文确认。

## 进度

- ✅ **G1 已建**(glm-overview):渊源(空白填充)+ 两条路线对照网格(分叉→趋同→增量)。
- ✅ **G5 已建**(glm-indexshare):IndexShare 已坐实——每 4 层共享 1 次索引(组长🔍算、其余↻用),
  相邻层选中 token 重合 70~100%,索引省 (G−1)/G=75%,1M 上下文每 token FLOPs 降 ~2.9×。
  交互:L=8 层×token 选择网格 + G 滑块 + 漏选标记 + FLOP 公式。源:IndexCache(arXiv:2603.12201)。
- ⬜ G2/G3/G4/G6/G7 建设中。

## 已查证(初步)

- GLM-4.5(2025-07-28):355B/32B MoE,sigmoid 门控,GQA + 部分 RoPE,QK-Norm,MTP 层支持投机解码,深而窄、96 注意力头,Muon 优化器。
- GLM-5(arXiv:2602.15763):744B/40B,256 专家,80 层;报告提及 MLA、DSA、head dim 192→256、MTP 共享 3 层预测 2 token,接受长度 2.76(vs DeepSeek-V3.2 2.55);200K 上下文。
- GLM-5.2(2026-06-13):744B/40B MoE,**IndexShare**,1M 上下文,MIT 许可,MTP +20% 接受长度。

来源:GLM-4.5 HF(huggingface.co/zai-org/GLM-4.5)、GLM-5 arXiv(arxiv.org/abs/2602.15763)、GLM-4.5 报告(arXiv:2508.06471)。
