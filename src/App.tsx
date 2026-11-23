import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AppShell } from './components/layout/AppShell'
import { CompanionProvider } from './context/CompanionContext'
import { ServicesProvider } from './context/ServicesContext'
import { SessionProvider } from './context/SessionContext'
import { ThemeProvider } from './context/ThemeContext'
import { ChatPage } from './pages/ChatPage'
import { FeedbackPage } from './pages/FeedbackPage'
import { HomePage } from './pages/HomePage'
import { KindnessPoolPage } from './pages/KindnessPoolPage'
import { StartCompanionPage } from './pages/StartCompanionPage'

export default function App() {
  return (
    <ThemeProvider>
      <ServicesProvider>
        <CompanionProvider>
          <SessionProvider>
            <BrowserRouter>
              <Routes>
                <Route element={<AppShell />}>
                  <Route index element={<HomePage />} />
                  <Route path="start" element={<StartCompanionPage />} />
                  <Route path="chat" element={<ChatPage />} />
                  <Route path="kindness" element={<KindnessPoolPage />} />
                  <Route path="feedback" element={<FeedbackPage />} />
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Route>
              </Routes>
            </BrowserRouter>
          </SessionProvider>
        </CompanionProvider>
      </ServicesProvider>
    </ThemeProvider>
  )
}
