import { createContext } from 'react'
import type { IUser } from '@/interface/IUserInterface'

export interface IAuthContext {
  user: IUser | null
  token: string | null
  login: (token: string, user: IUser) => void
  logout: () => void
  isAuthenticated: boolean
}

export const AuthContext = createContext<IAuthContext | undefined>(undefined)
