import React from 'react'
import { Outlet } from 'react-router-dom'
import AssistantChat from '../component/common/AssistantChat'
import AuthSessionManager from '../component/common/AuthSessionManager'
import GlobalLoadingOverlay from '../component/common/GlobalLoadingOverlay'
import { AssistantProvider } from '../context/AssistantContext'
import { useAssistant } from '../context/AssistantContext'

const AppShellContent: React.FC = () => {
  const { isOpen } = useAssistant()

  return (
    <>
      <AuthSessionManager />
      <div aria-hidden={isOpen} className={isOpen ? 'pointer-events-none select-none' : ''}>
        <Outlet />
      </div>
      {isOpen ? <div className='pointer-events-auto fixed inset-0 z-[55] bg-[rgba(238,245,255,0.18)] backdrop-blur-[1.5px]' /> : null}
      <GlobalLoadingOverlay />
      <AssistantChat />
    </>
  )
}

const AppShell: React.FC = () => (
  <AssistantProvider>
    <AppShellContent />
  </AssistantProvider>
)

export default AppShell
