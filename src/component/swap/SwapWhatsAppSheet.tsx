import React from 'react'

interface SwapWhatsAppSheetProps {
  isOpen: boolean
  onClose: () => void
  whatsAppUrl: string
  messagePreview: string
}

const SwapWhatsAppSheet: React.FC<SwapWhatsAppSheetProps> = ({
  isOpen,
  onClose,
  whatsAppUrl,
  messagePreview,
}) => {
  if (!isOpen) {
    return null
  }

  return (
    <div className='fixed inset-0 z-50 flex items-end bg-slate-950/28'>
      <button
        type='button'
        aria-label='Close'
        className='absolute inset-0'
        onClick={onClose}
      />
      <div className='relative mx-auto w-full max-w-screen-md'>
        <div className='ios-sheet'>
          <div className='mx-auto h-1.5 w-16 rounded-full bg-slate-300/80' />

          <div className='mt-4'>
            <p className='ios-section-title'>Continue on WhatsApp</p>
            <p className='ios-body-muted mt-1'>Review the message before opening WhatsApp.</p>
          </div>

          <div className='mt-5 rounded-[24px] bg-white/60 p-4 shadow-[0_12px_24px_rgba(17,33,62,0.08)]'>
            <p className='ios-caption uppercase'>Message preview</p>
            <div className='mt-3 whitespace-pre-wrap text-[0.94rem] leading-6 text-textPrimary'>
              {messagePreview}
            </div>
          </div>

          <div className='mt-5 flex flex-col gap-3 sm:flex-row'>
            <button
              type='button'
              onClick={() => {
                if (whatsAppUrl) {
                  window.open(whatsAppUrl, '_blank')
                }
              }}
              className='ios-primary-button w-full justify-center disabled:cursor-not-allowed disabled:opacity-60 sm:flex-1'
              disabled={!whatsAppUrl}
            >
              Open WhatsApp
            </button>
            <button
              type='button'
              onClick={() => {
                if (messagePreview) {
                  void navigator.clipboard.writeText(messagePreview)
                }
              }}
              className='ios-secondary-button w-full justify-center disabled:cursor-not-allowed disabled:opacity-60 sm:flex-1'
              disabled={!messagePreview}
            >
              Copy message
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default SwapWhatsAppSheet
