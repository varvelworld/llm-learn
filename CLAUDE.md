# llm-learn — 开发指南

一个交互式 Web 教程(React + Vite),从零讲清大语言模型怎么工作,一直到前沿开源大模型架构。
面向**有编程基础、ML 零基础**的读者。部署在 GitHub Pages,push `main` 经 Actions 自动上线。

## 教程方法论:每章三支柱(新增/修改章节必须同时满足)

1. **公式化(严谨抽象)** —— 关键数学用 LaTeX(`src/components/Tex.jsx` 的 `<Tex>`)写出严谨形式,
   既给**具体数值对照**、又抽象到一般式。**数学/架构必须算对、讲对**(讲错 = 教错人)。
2. **可视化(可互动直观)** —— 配**真实 toy 计算**的交互图,拖滑块 / 点选实时变,建立直观印象。
   绝不用假数据糊弄;数值由 `src/lib/` 的纯函数真算。
3. **快速且零基础** —— 读者三分钟能抓住主旨;预备知识自洽,不假设背景。

> 典范:P3「神经网络图 ↔ 矩阵乘交叉布局」—— 直观印象 + LaTeX 公式对照 + 足够抽象可迁移,三条同时达成。
> 设计新章节先自问:数值公式(LaTeX)对了吗?有没有可拖动的真实计算图?零基础能否快速看懂?缺一就补。

## 章节开发约定

- **单一数据源**:章节在 `src/chapters/registry.js` 注册(侧边栏、路由、翻页全从这里派生)。
  `Component: null` = 建设中。`part`: `'prep' | 'basics' | 'deepseek'`。
- **数学进 `src/lib/`**:所有计算写成**纯函数**并可单测(见 `lib.test.js`);组件只负责画。
  现有:`tensor / softmax / attention / norm / ffn / rope / moe / synth(seededMatrix 可复现) / figure(colorFor, matmulLayout)`。
- **章节骨架**:用 `ChapterLayout`(`kicker, title, prev, next`,children[0]=讲解、children[1]=演示)。
- **可视化标配**:`FigureBoard` 包 `renderSvg(cell)`,自带控制条 + 全屏 pan/zoom 画布。
  SVG 原语/配色用 `src/components/svg/`(`Matrix`, `MatMul`, `Edge`, `theme.js` 的 `T`)。
  **矩阵乘统一用「矩阵乘交叉布局」**(`MatMul`:被乘矩阵立左、输入躺上、结果右下),全教程复用。
- **公式**:用 `<Tex>`(KaTeX);配色对齐图中箭头(蓝 `#6ea8fe`=输入、绿 `#7ee787`、橙 `#f0a35e`=结果);
  负数加括号、带符号相加,避免 `+ -1.5`。

## 自查与提交

- 改完先**本地构建截图自查**:`npx vite build` → 本地静态服务 → Playwright 截 `.demo svg` 看效果,再给用户。
- **本地 commit 照常,但不自动 `git push`**;push 会触发上线,等用户明确说"推"再推。

## 结构速览

```
src/chapters/   各章(Ch* 正篇、P* 预备知识) + registry.js
src/lib/        纯函数数学(可单测)
src/components/  ChapterLayout、Tex,svg/ 下是图解原语
```
