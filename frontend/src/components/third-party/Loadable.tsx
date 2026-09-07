import { Suspense, type ElementType } from 'react'
import { Loader } from '@/components/third-party/Loader'

export const Loadable = (Component: ElementType) => (props: Record<string, unknown>) => (
  <Suspense fallback={<Loader />}>
    <Component {...props} />
  </Suspense>
)
