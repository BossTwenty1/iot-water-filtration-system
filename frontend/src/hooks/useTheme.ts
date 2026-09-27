import { useEffect,useState } from 'react'

export type ThemeMode='light'|'dark'

function readExplicitTheme():ThemeMode|null{
  try{
    const value:unknown=JSON.parse(window.localStorage.getItem('aquasense-theme')??'null')
    return value==='light'||value==='dark'?value:null
  }catch{return null}
}

function readSystemTheme():ThemeMode{
  try{return window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'}
  catch{return 'light'}
}

export function useTheme(){
  // Keep system resolution distinct from an explicit, persisted user choice.
  // index.html uses this same priority before React paints.
  const [explicitTheme,setExplicitTheme]=useState(readExplicitTheme)
  const [systemTheme,setSystemTheme]=useState(readSystemTheme)
  const theme=explicitTheme??systemTheme

  useEffect(()=>{
    if(explicitTheme!==null)return
    try{
      const media=window.matchMedia('(prefers-color-scheme: dark)')
      const update=()=>setSystemTheme(media.matches?'dark':'light')
      update()
      media.addEventListener('change',update)
      return()=>media.removeEventListener('change',update)
    }catch{/* Light remains the fallback when system preference is unavailable. */}
  },[explicitTheme])

  useEffect(()=>{
    document.documentElement.classList.toggle('dark',theme==='dark')
    document.documentElement.style.colorScheme=theme
  },[theme])

  const setTheme=(next:ThemeMode)=>{
    setExplicitTheme(next)
    try{window.localStorage.setItem('aquasense-theme',JSON.stringify(next))}
    catch{/* Explicit choices remain usable in this session if storage is blocked. */}
  }
  return {theme,setTheme,toggleTheme:()=>setTheme(theme==='light'?'dark':'light')}
}
