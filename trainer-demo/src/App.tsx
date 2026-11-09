import { useEffect } from 'react'
import { createBrowserRouter, Navigate, Outlet, useLocation } from 'react-router-dom'
import { DemoBar } from './layouts/DemoBar'
import { TrainerLayout } from './layouts/TrainerLayout'
import { ClientLayout } from './layouts/ClientLayout'
import { Toaster } from './components/ui/toast'
import { ConfirmHost } from './components/ui/confirm'
import { QuickSessionModal } from './components/QuickSession'
import { GlobalAddClient } from './components/ClientForm'
import { useStore } from './store/useStore'
import { Dashboard } from './pages/trainer/Dashboard'
import { ClientsPage } from './pages/trainer/Clients'
import { ClientProfile } from './pages/trainer/ClientProfile'
import { ProgramsPage } from './pages/trainer/Programs'
import { ProgramBuilder } from './pages/trainer/ProgramBuilder'
import { WorkoutEditor } from './pages/trainer/WorkoutEditor'
import { ExercisesPage } from './pages/trainer/Exercises'
import { CalendarPage } from './pages/trainer/Calendar'
import { MessagesPage } from './pages/trainer/Messages'
import { SettingsPage } from './pages/trainer/Settings'
import { ClientHome } from './pages/client/ClientHome'
import { ClientWorkouts } from './pages/client/ClientWorkouts'
import { WorkoutPlayer } from './pages/client/WorkoutPlayer'
import { ClientProgress } from './pages/client/ClientProgress'
import { ClientMessages } from './pages/client/ClientMessages'

function Root() {
  const { pathname } = useLocation()
  const mode = useStore((s) => s.mode)
  const setMode = useStore((s) => s.setMode)
  // keep the Demo bar in sync if someone uses the back button or a direct link
  useEffect(() => {
    const want = pathname === '/client' || pathname.startsWith('/client/') ? 'client' : 'trainer'
    if (want !== mode) setMode(want)
  }, [pathname, mode, setMode])
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])
  return (
    <>
      <DemoBar />
      <Outlet />
      <QuickSessionModal />
      <GlobalAddClient />
      <ConfirmHost />
      <Toaster />
    </>
  )
}

export const router = createBrowserRouter([
  {
    element: <Root />,
    children: [
      {
        element: <TrainerLayout />,
        children: [
          { path: '/', element: <Dashboard /> },
          { path: '/clients', element: <ClientsPage /> },
          { path: '/clients/:id', element: <ClientProfile /> },
          { path: '/programs', element: <ProgramsPage tab="programs" /> },
          { path: '/workouts', element: <ProgramsPage tab="workouts" /> },
          { path: '/programs/new', element: <ProgramBuilder /> },
          { path: '/programs/:id', element: <ProgramBuilder /> },
          { path: '/workouts/new', element: <WorkoutEditor /> },
          { path: '/workouts/:id', element: <WorkoutEditor /> },
          { path: '/exercises', element: <ExercisesPage /> },
          { path: '/calendar', element: <CalendarPage /> },
          { path: '/messages', element: <MessagesPage /> },
          { path: '/messages/:clientId', element: <MessagesPage /> },
          { path: '/settings', element: <SettingsPage /> },
        ],
      },
      {
        path: '/client',
        element: <ClientLayout />,
        children: [
          { index: true, element: <ClientHome /> },
          { path: 'workouts', element: <ClientWorkouts /> },
          { path: 'workout/:sessionId', element: <WorkoutPlayer /> },
          { path: 'progress', element: <ClientProgress /> },
          { path: 'messages', element: <ClientMessages /> },
        ],
      },
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
], { future: { v7_relativeSplatPath: true } })
