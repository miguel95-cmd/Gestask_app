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

    async function bootstrap() {
      try {
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

    // Escuchador optimizado para evitar caídas de datos tras inactividad
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return

      // Si el evento es solo renovación de token, actualiza el usuario de forma segura
      // sin saturar a la base de datos con consultas bloqueadas por permisos temporales.
      if (event === 'TOKEN_REFRESHED' && session?.user) {
        setUser(session.user)
        setLoading(false)
        return 
      }

      // Manejo estándar para el resto de eventos (SIGNED_IN, SIGNED_OUT, etc.)
      setUser(session?.user ?? null)

      if (session?.user) {
        await loadProfile(session.user)
      } else {
        setProfile(null)
      }

      setLoading(false)
    })

    bootstrap()

    return () => {
      mounted = false
      subscription.unsubscribe()
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
