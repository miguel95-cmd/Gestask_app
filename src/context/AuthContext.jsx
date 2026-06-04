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
  // "loading" = todavía no sabemos si hay sesión ni perfil
  // "profileLoading" = ya sabemos que hay user, pero el perfil aún no llegó
  const [loading, setLoading] = useState(true)
  const [profileLoading, setProfileLoading] = useState(false)

  const mounted = useRef(true)

  const loadProfile = useCallback(async (sessionUser) => {
    if (!sessionUser) {
      if (mounted.current) {
        setProfile(null)
        setProfileLoading(false)
      }
      return null
    }

    if (mounted.current) setProfileLoading(true)

    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', sessionUser.id)
      .maybeSingle()

    if (!mounted.current) return null

    if (error) {
      console.error('No se pudo cargar el perfil:', error.message)
    }

    const resolved = data ?? buildFallbackProfile(sessionUser)
    setProfile(resolved)
    setProfileLoading(false)
    return resolved
  }, [])

  useEffect(() => {
    mounted.current = true
    let bootstrapDone = false

    async function bootstrap() {
      const { data: { session } } = await supabase.auth.getSession()

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

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        // Ignorar INITIAL_SESSION: lo maneja bootstrap() para evitar carrera
        if (!bootstrapDone && event === 'INITIAL_SESSION') return
        if (!mounted.current) return

        setUser(session?.user ?? null)

        if (session?.user) {
          await loadProfile(session.user)
        } else {
          setProfile(null)
        }

        if (mounted.current) setLoading(false)
      }
    )

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
      options: { data: { full_name: fullName, role: 'student' } },
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
      value={{ user, profile, loading, profileLoading, signIn, signUp, signOut, refreshProfile }}
    >
      {children}
    </AuthContext.Provider>
  )
}
