import { createContext, useContext, useState, useEffect, useCallback } from 'react'

// 语言上下文:'zh' | 'en'。选择存 localStorage,刷新后保留。
export const LANGS = ['zh', 'en']
export const LANG_STORAGE_KEY = 'llm-lang'

// 只允许 'zh' | 'en';脏值/旧值/null 一律回退 zh(否则会进入两按钮都不高亮的第三态)。
const normalizeLang = (v) => (v === 'en' || v === 'zh' ? v : 'zh')

const LangCtx = createContext({ lang: 'zh', setLang: () => {} })

export function LangProvider({ children }) {
  const [lang, setLangRaw] = useState(() => {
    try {
      return normalizeLang(localStorage.getItem(LANG_STORAGE_KEY))
    } catch {
      return 'zh'
    }
  })
  const setLang = useCallback((v) => setLangRaw(normalizeLang(v)), [])
  useEffect(() => {
    try {
      localStorage.setItem(LANG_STORAGE_KEY, lang)
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
 * 注:这是「过渡工具」,适合图内短标签/控件;全量长正文翻译建议改用结构化 copy。
 */
export function useT() {
  const { lang } = useLang()
  return useCallback((zh, en) => (lang === 'en' && en != null && en !== '' ? en : zh), [lang])
}
