export {}

declare global {
  interface NsApiUser {
    id: number
    username: string
    name: string
    email: string
    role: string
  }

  interface NsApiLoginResult {
    token: string
    expires_at: string
    user: NsApiUser
  }

  interface Window {
    __NS_API_BASE__?: string
    __nsOnUnauthorized?: () => void
    NsApi?: {
      login: (username: string, password: string) => Promise<NsApiLoginResult>
      logout: () => Promise<void>
      getCurrentUser: () => Promise<{ user: NsApiUser }>
      isLoggedIn: () => boolean
      getStoredUser: () => NsApiUser | null
      clearToken: () => void
      getLookups: () => Promise<unknown>
      listCompanies: (filters?: Record<string, unknown>) => Promise<unknown>
      getAnalytics: (months?: string[]) => Promise<unknown>
      [key: string]: unknown
    }
  }
}
