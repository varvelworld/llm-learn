import { HashRouter, Routes, Route, Navigate, NavLink, useParams } from 'react-router-dom'
import { CHAPTERS, findChapter, neighbors } from './chapters/registry.js'

function NavItem({ c }) {
  return c.Component ? (
    <NavLink to={`/c/${c.slug}`} className={({ isActive }) => 'nav-item' + (isActive ? ' active' : '')}>
      <span className="num">{c.num}</span>
      <span>{c.title}</span>
    </NavLink>
  ) : (
    <div className="nav-item soon">
      <span className="num">{c.num}</span>
      <span>{c.title}</span>
      <span className="badge">建设中</span>
    </div>
  )
}

function Sidebar() {
  const prep = CHAPTERS.filter((c) => c.part === 'prep')
  const basics = CHAPTERS.filter((c) => c.part === 'basics')
  const deep = CHAPTERS.filter((c) => c.part === 'deepseek')
  const deepGroups = [...new Set(deep.map((c) => c.group))] // 按版本顺序的子分组
  return (
    <nav className="sidebar">
      <div className="brand">
        可视化学习 LLM
        <small>从零搭到开源大模型架构</small>
      </div>

      <div className="group-label">第 0 部分 · 预备知识(向量与矩阵)</div>
      {prep.map((c) => <NavItem key={c.slug} c={c} />)}

      <div className="group-label">第一部分 · 基础(标准 Transformer)</div>
      {basics.map((c) => <NavItem key={c.slug} c={c} />)}

      <div className="group-label">第二部分 · DeepSeek 创新</div>
      {deepGroups.map((g) => (
        <div key={g}>
          <div className="subgroup-label">{g}</div>
          {deep.filter((c) => c.group === g).map((c) => <NavItem key={c.slug} c={c} />)}
        </div>
      ))}
    </nav>
  )
}

function ChapterRoute() {
  const { slug } = useParams()
  const ch = findChapter(slug)
  if (!ch || !ch.Component) return <Navigate to="/c/overview" replace />
  const { prev, next } = neighbors(slug)
  const C = ch.Component
  return <C prev={prev} next={next} />
}

export default function App() {
  return (
    <HashRouter>
      <div className="app">
        <Sidebar />
        <main className="main">
          <Routes>
            <Route path="/" element={<Navigate to="/c/overview" replace />} />
            <Route path="/c/:slug" element={<ChapterRoute />} />
            <Route path="*" element={<Navigate to="/c/overview" replace />} />
          </Routes>
        </main>
      </div>
    </HashRouter>
  )
}
