import React from 'react'
import { Outlet } from 'react-router-dom'
import AssistantChat from '../component/common/AssistantChat'
import GlobalLoadingOverlay from '../component/common/GlobalLoadingOverlay'
import { AssistantProvider } from '../context/AssistantContext'

const SwapShell: React.FC = () => (
  <AssistantProvider>
    <header className='ios-topbar mx-auto max-w-screen-md px-4 py-3'>
      <span className='text-lg font-bold text-textPrimary'>Melvin&apos;s Store</span>
    </header>
    <div className='mx-auto max-w-screen-md'>
      <Outlet />
    </div>
    <GlobalLoadingOverlay />
    <AssistantChat />
  </AssistantProvider>
)

export default SwapShell
