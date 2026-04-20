import React, { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { authApi, User } from '@/lib/api'

interface AuthContextType {
  user: User | null
  token: string | null
  isLoading: boolean
  login: (token: string) => Promise<void>
  logout: () => void
  isAuthenticated: boolean
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('token'))
  const [isLoading, setIsLoading] = useState(true)

  const fetchUser = useCallback(async (tok: string) => {
    try {
      localStorage.setItem('token', tok)
      const { user: fetchedUser } = await authApi.getMe()
      setUser(fetchedUser)
    } catch {
      localStorage.removeItem('token')
      setToken(null)
      setUser(null)
    }
  }, [])

  useEffect(() => {
    const storedToken = localStorage.getItem('token')
    if (storedToken) {
      setToken(storedToken)
      fetchUser(storedToken).finally(() => setIsLoading(false))
    } else {
      setIsLoading(false)
    }
  }, [fetchUser])

  const login = useCallback(async (newToken: string) => {
    setToken(newToken)
    await fetchUser(newToken)
  }, [fetchUser])

  const logout = useCallback(() => {
    localStorage.removeItem('token')
    setToken(null)
    setUser(null)
  }, [])

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isLoading,
        login,
        logout,
        isAuthenticated: !!user,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
