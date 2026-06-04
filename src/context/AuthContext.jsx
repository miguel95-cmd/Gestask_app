import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

import { AuthContext } from './authContext'

function buildFallbackProfile(sessionUser) {
  if (!sessionUser) return null

  const emailLocalPart = sessionUser.email?.split('@')[0] ?? 'usuario'
  const inferredRole =
    sessionUser.user_metadata?.role ??
    sessionUser.app_metadata?.role ??
    (emailLocalPart.toLowerCase().includes('admin') ? 'admin' : null)

  return {
    id: sessionUser.id,
    email: sessionUser.email ?? '',
    full_name:
      sessionUser.user_metadata?.full_name ??
      sessionUser.email?.split('@')[0] ??
      'Usuario',
    role: inferredRole,
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  // Ref para evitar actualizaciones de estado en componente desmontado
  const mounted = useRef(true)

  const loadProfile = useCallback(async (sessionUser) => {
    if (!sessionUser) {
      if (mounted.current) setProfile(null)
      return null
    }

    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', sessionUser.id)
      .maybeSingle()

    if (!mounted.current) return null

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
    mounted.current = true

    // Flag para que el listener sepa si bootstrap ya terminó,
    // evitando que ambos corran en paralelo al inicio.
    let bootstrapDone = false

    async function bootstrap() {
      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (!mounted.current) return

      setUser(session?.user ?? null)

      if (session?.user) {
        await loadProfile(session.user)
      } else {
        setProfile(null)
      }

      if (mounted.current) setLoading(false)
      bootstrapDone = true
    }

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      // Durante el bootstrap inicial ignoramos el evento INITIAL_SESSION
      // para que no compita con bootstrap(). Para cualquier evento posterior
      // (TOKEN_REFRESHED, SIGNED_IN, SIGNED_OUT, etc.) sí actualizamos.
      if (!bootstrapDone && event === 'INITIAL_SESSION') return

      if (!mounted.current) return

      setUser(session?.user ?? null)

      if (session?.user) {
        await loadProfile(session.user)
      } else {
        setProfile(null)
      }

      // Solo quitamos el loading si bootstrap ya terminó (o si es un evento
      // posterior al inicio, p.ej. TOKEN_REFRESHED al volver de otra pestaña).
      if (mounted.current) setLoading(false)
    })

    bootstrap()

    return () => {
      mounted.current = false
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
    <AuthContext.Provider
      value={{ user, profile, loading, signIn, signUp, signOut, refreshProfile }}
    >
      {children}
    </AuthContext.Provider>
  )
}
