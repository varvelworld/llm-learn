import { HashRouter, Routes, Route, Navigate, NavLink, useParams } from 'react-router-dom'
import { CHAPTERS, findChapter, neighbors } from './chapters/registry.js'

function Sidebar() {
  const groups = [
    { key: 'basics', label: '第一部分 · 基础' },
    { key: 'deepseek', label: '第二部分 · DeepSeek 创新' },
  ]
  return (
    <nav className="sidebar">
      <div className="brand">
        可视化学习 LLM
        <small>从零搭到 DeepSeek 架构</small>
      </div>
      {groups.map((g) => (
        <div key={g.key}>
          <div className="group-label">{g.label}</div>
          {CHAPTERS.filter((c) => c.part === g.key).map((c) =>
            c.Component ? (
              <NavLink
                key={c.slug}
                to={`/c/${c.slug}`}
                className={({ isActive }) => 'nav-item' + (isActive ? ' active' : '')}
              >
                <span className="num">{c.num}</span>
                <span>{c.title}</span>
              </NavLink>
            ) : (
              <div key={c.slug} className="nav-item soon">
                <span className="num">{c.num}</span>
                <span>{c.title}</span>
                <span className="badge">建设中</span>
              </div>
            )
          )}
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
