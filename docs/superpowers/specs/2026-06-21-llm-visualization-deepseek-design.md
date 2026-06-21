# 可视化学习 LLM(以 DeepSeek 为目标)— 设计文档

日期:2026-06-21

## 目标
做一个**交互式网页**,带 ML 入门(会编程)的学习者从零理解 LLM 的工作原理,
最终落到 DeepSeek 的架构创新(MLA / MoE / MTP)。

## 受众
会写代码、但对神经网络/Transformer 了解不多。讲解从基础概念讲起,逐步搭到 DeepSeek。

## 形式与方案
- 形式:交互式网页讲解(不加载真实大模型)。
- 方案 A:**章节模块式 App**。左侧导航,每章 = 左讲解 + 右可交互演示。
- 技术栈:**React + Vite**(零到一本地可跑、代码可读可改)。

## 关键技术约定
- 演示用**浏览器里真算(toy 尺寸)**:纯 JS 实现数学(矩阵乘/softmax/attention/MoE),
  维度故意取很小(序列 ~6 token、向量 ~8 维、~2 头),拖参数实时重算。
- **数学逻辑全部放 `src/lib/`,是纯函数、和 UI 解耦、有 Vitest 单测**。
  这是教学工具,数学算错=教错人,必须测。
- 状态用各章本地 `useState`;路由用 react-router;样式用普通 CSS,不引重型 UI 库。

## 内容大纲(学习路径)

### 第一部分:基础(标准 Transformer)
0. 总览地图 — 文本→token→…→下一个词的流程,导航入口
1. 分词 Tokenization — 输入句子,实时看切成哪些 token
2. 词嵌入 Embedding — token ID → 向量(热力图/散点)
3. 位置信息 RoPE — 为什么要位置;旋转编码动画
4. 自注意力(核心)— Q/K/V、打分、softmax、加权求和;点 token 看连线
5. 多头注意力 — 多头并行看不同关系
6. 前馈网络 FFN / SwiGLU
7. 残差 & RMSNorm — 为什么能堆深
8. Transformer Block 组装
9. 自回归生成 + KV 缓存 — 引出"KV 吃显存"
10. 输出与采样 — logits→softmax;temperature / top-k / top-p

### 第二部分:DeepSeek 的创新
11. MLA 潜变量注意力 — 低秩压缩 KV;与标准 MHA 显存对比
12. MoE 混合专家 — 路由 + 共享/细粒度专家 + 负载均衡;看 token 分给哪些专家
13. MTP 多 token 预测 — 一次预测多个未来 token
14. 全景总览 — DeepSeek 完整堆叠拼图

## 项目结构
```
llm-learn/
├── index.html, package.json, vite.config.js
├── src/
│   ├── App.jsx              # 路由 + 章节注册
│   ├── chapters/           # 每章一个文件
│   ├── components/         # ChapterLayout / VectorHeatmap / AttentionView /
│   │                       #   MatMulView / ProbBars / StepPlayer / Slider
│   ├── lib/                # tensor / softmax / attention / moe / mla / tokenizer(纯函数)
│   ├── data/               # 内置确定性 toy 权重 / 小词表
│   └── styles/
└── tests/ (或 *.test.js 就近)  # Vitest 单测 lib/ 数学
```

## 复用可视化组件
- `ChapterLayout` 统一页面骨架(顶部进度/导航 + 左讲解 + 右演示 sticky)
- `VectorHeatmap` 向量/矩阵热力图
- `AttentionView` token 注意力连线
- `MatMulView` 矩阵乘逐格动画
- `ProbBars` 概率分布柱状图
- `StepPlayer` 单步播放控制
- `Slider` 调参

## 构建顺序(增量)
1. 脚手架 + 路由 + `ChapterLayout` + 共用组件 + `lib/`(带单测)
2. 先做第 4 章"自注意力"(用到几乎所有积木,垂直切片验证架构)
3. 按 0→14 填满其余章节

## 第一期可见成品(先跑起来给用户看,再迭代)
首个可运行版本覆盖一条完整学习弧:
**0 总览 → 1 分词 → 2 嵌入 → 4 自注意力 → 12 MoE**
其余章节在导航里标记"建设中",看到效果、收到反馈后再补齐。

## 测试
- Vitest 单测 `lib/` 的数学(attention/softmax/moe/tensor 数值正确)。
- 组件以能渲染、交互不报错为主。
