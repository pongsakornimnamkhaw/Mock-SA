import type { RouteObject } from 'react-router-dom'
import { createBrowserRouter } from 'react-router-dom'

// Layouts
import FullLayout from '@/layout/FullLayout'
import MiniLayout from '@/layout/MiniLayout'

// Guards
import { ProtectedRoute } from '@/components/ProtectedRoute'
import { PublicOnlyRoute } from '@/components/PublicOnlyRoute'

// Pages
import { LandingPage } from '@/pages/landing/LandingPage'
import { HomePage } from '@/pages/concerts/HomePage'
import { AllShowsPage } from '@/pages/concerts/AllShowsPage'
import { ConcertDetailPage } from '@/pages/concerts/ConcertDetailPage'
import { ZoneSelectionPage } from '@/pages/concerts/ZoneSelectionPage'
import Login from '@/pages/authentication/Login'
import Register from '@/pages/authentication/Register'
import Dashboard from '@/pages/dashboard'
import NotFound from '@/pages/not-found'

export const routes: RouteObject[] = [
  {
    path: '/',
    element: <FullLayout />,
    children: [
      { index: true, element: <LandingPage /> },
      { path: 'home', element: <HomePage /> },
      { path: 'shows', element: <AllShowsPage /> },
      { path: 'shows/:concertId', element: <ConcertDetailPage /> },
      { path: 'shows/:concertId/zones', element: <ZoneSelectionPage /> },
      {
        element: <ProtectedRoute />,
        children: [
          { path: 'dashboard', element: <Dashboard /> },
        ]
      }
    ],
  },
  {
    element: <MiniLayout />,
    children: [
      {
        element: <PublicOnlyRoute />,
        children: [
          { path: 'login', element: <Login /> },
          { path: 'register', element: <Register /> },
        ]
      }
    ]
  },
  {
    path: '*',
    element: <NotFound />,
  }
]

export const router = createBrowserRouter(routes)
