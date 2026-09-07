import type { IUser } from '@/interface/IUserInterface'

export interface ILoginRequest {
  email: string
  password: string
}

export interface ILoginResponse {
  token: string
  user: IUser
}
