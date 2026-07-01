import { createContext, useContext, useState, useEffect } from 'react'

// 语言上下文:'zh' | 'en'。选择存 localStorage,刷新后保留。
const LangCtx = createContext({ lang: 'zh', setLang: () => {} })

export function LangProvider({ children }) {
  const [lang, setLang] = useState(() => {
    try {
      return localStorage.getItem('llm-lang') || 'zh'
    } catch {
      return 'zh'
    }
  })
  useEffect(() => {
    try {
      localStorage.setItem('llm-lang', lang)
    } catch {
      /* ignore */
    }
  }, [lang])
  return <LangCtx.Provider value={{ lang, setLang }}>{children}</LangCtx.Provider>
}

export function useLang() {
  return useContext(LangCtx)
}

/**
 * 返回一个 t(zh, en) 取词函数:英文模式且提供了 en 时用 en,否则回退到中文。
 * 这样章节可以逐步翻译,未译的自动显示中文。
 */
export function useT() {
  const { lang } = useLang()
  return (zh, en) => (lang === 'en' && en != null && en !== '' ? en : zh)
}
