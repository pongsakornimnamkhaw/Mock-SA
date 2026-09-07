export interface IApiResponse<T = unknown> {
  success: boolean
  message: string
  data?: T
}
