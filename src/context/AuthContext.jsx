import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

import { AuthContext } from './authContext'

function buildFallbackProfile(sessionUser) {
  if (!sessionUser) return null

  const emailLocalPart = sessionUser.email?.split('@')[0] ?? 'usuario'
  const inferredRole = sessionUser.user_metadata?.role ?? sessionUser.app_metadata?.role ?? (emailLocalPart.toLowerCase().includes('admin') ? 'admin' : null)

  return {
    id: sessionUser.id,
    email: sessionUser.email ?? '',
    full_name: sessionUser.user_metadata?.full_name ?? sessionUser.email?.split('@')[0] ?? 'Usuario',
    role: inferredRole,
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  const loadProfile = useCallback(async (sessionUser) => {
    if (!sessionUser) {
      setProfile(null)
      return null
    }

    const { data, error } = await supabase.from('profiles').select('*').eq('id', sessionUser.id).maybeSingle()

    if (data) {
      setProfile(data)
      return data
    }

    if (error) {
      console.error('No se pudo cargar el profile del usuario:', error.message)
    }

    const fallbackProfile = buildFallbackProfile(sessionUser)
    setProfile(fallbackProfile)
    return fallbackProfile
  }, [])

  useEffect(() => {
    let mounted = true

    // Agregamos 'isBackground' para saber si la app apenas está abriendo o si solo volvimos a la pestaña
    async function bootstrap(isBackground = false) {
      try {
        // SOLO mostramos la pantalla gigante de carga si NO estamos en segundo plano (carga inicial)
        if (mounted && !isBackground) setLoading(true)
        
        const { data: { session } } = await supabase.auth.getSession()
        
        if (!mounted) return

        setUser(session?.user ?? null)

        if (session?.user) {
          await loadProfile(session.user)
        } else {
          setProfile(null)
        }
      } catch (err) {
        console.error("Error inicializando la sesión de autenticación:", err)
      } finally {
        if (mounted) setLoading(false)
      }
    }

    // Cuando volvemos a la pestaña, verificamos pero de forma silenciosa (isBackground = true)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        bootstrap(true) 
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return

      if (event === 'TOKEN_REFRESHED' && session?.user) {
        setUser(session.user)
        setLoading(false)
        return 
      }

      setUser(session?.user ?? null)

      if (session?.user) {
        await loadProfile(session.user)
      } else {
        setProfile(null)
      }

      setLoading(false)
    })

    // La primera vez que entramos a la app sí mostramos la carga (isBackground = false)
    bootstrap(false)

    return () => {
      mounted = false
      subscription.unsubscribe()
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [loadProfile])

  async function signIn(email, password) {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return { error }
  }

  async function signUp(email, password, fullName) {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          role: 'student',
        },
      },
    })

    return { error }
  }

  async function signOut() {
    await supabase.auth.signOut()
  }

  async function refreshProfile() {
    return loadProfile(user)
  }

  return (
    <AuthContext.Provider value={{ user, profile, loading, signIn, signUp, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  )
}
