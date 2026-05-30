import React from 'react'
import { HiOutlineArrowTrendingUp } from 'react-icons/hi2'
import type { SwapEvaluationResult } from '../../types/domain'
import formatPrice from '../../utils/formatPrice'

interface SwapEstimateCardProps {
  evaluation: SwapEvaluationResult | undefined
  isEvaluating: boolean
  hasError: boolean
  selectedModel: string
  selectedStorage: string
  targetProductName: string
  onOpenWhatsApp: () => void
}

const SwapEstimateCard: React.FC<SwapEstimateCardProps> = ({
  evaluation,
  isEvaluating,
  hasError,
  selectedModel,
  selectedStorage,
  targetProductName,
  onOpenWhatsApp,
}) => (
  <section className='ios-card space-y-4'>
    <div className='flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between'>
      <div>
        <p className='ios-overline'>Estimate</p>
        <h2 className='ios-section-title mt-2'>Swap summary</h2>
      </div>
      <div className='ios-icon-button h-11 w-11 shrink-0'>
        <HiOutlineArrowTrendingUp size={20} />
      </div>
    </div>

    {evaluation ? (
      <div className='rounded-[26px] bg-white/58 p-4 shadow-[0_12px_24px_rgba(17,33,62,0.08)]'>
        <p className='ios-caption uppercase'>Estimated balance to pay</p>
        <p className='ios-price mt-3 break-words leading-tight'>
          {`${formatPrice(evaluation.estimatedBalanceMin)} - ${formatPrice(evaluation.estimatedBalanceMax)}`}
        </p>

        <div className='mt-4 rounded-[22px] border border-white/55 bg-white/52 px-4 py-3'>
          <div className='flex flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-between'>
            <div className='min-w-0'>
              <p className='ios-caption uppercase'>Estimated trade-in credit</p>
            </div>

            <p className='ios-price-inline break-words sm:text-right'>
              {`${formatPrice(evaluation.customerEstimateMin)} - ${formatPrice(evaluation.customerEstimateMax)}`}
            </p>
          </div>
        </div>

        <div className='mt-4 rounded-[22px] bg-white/45 px-4 py-3'>
          <p className='ios-caption uppercase'>Trade-in device</p>
          <p className='ios-card-title mt-2'>{selectedModel}</p>
          <p className='ios-meta mt-1'>{selectedStorage}</p>
          {targetProductName ? (
            <p className='ios-meta mt-3'>For {targetProductName}</p>
          ) : null}
        </div>

        <div className='mt-4 flex flex-col gap-3 sm:flex-row'>
          <button
            type='button'
            onClick={onOpenWhatsApp}
            className='ios-primary-button w-full justify-center sm:flex-1'
          >
            Continue on WhatsApp
          </button>
          <button
            type='button'
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            className='ios-secondary-button w-full justify-center sm:w-auto'
          >
            Review device details
          </button>
        </div>
      </div>
    ) : (
      <div className='rounded-[26px] bg-white/54 p-5'>
        <p className='ios-card-title'>Pick a model and storage to estimate your swap.</p>
        <p className='ios-body-muted mt-2'>
          Choose the device you want and tell us about your current iPhone to get a live estimate.
        </p>
      </div>
    )}

    <div className='rounded-[24px] border border-white/55 bg-white/42 px-4 py-3'>
      <p className='ios-meta'>Final credit is confirmed after inspection.</p>
      {isEvaluating ? (
        <p className='ios-meta mt-2'>Updating swap estimate...</p>
      ) : null}
      {hasError ? (
        <p className='ios-meta mt-2'>Swap estimate is temporarily unavailable.</p>
      ) : null}
    </div>
  </section>
)

export default SwapEstimateCard
