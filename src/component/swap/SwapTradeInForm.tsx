import React, { useMemo } from 'react'
import { MdKeyboardArrowDown } from 'react-icons/md'
import { ConditionSelector, getConditionSummaryLabel } from './ConditionSelector'
import type { SwapConditionSelections, SwapMetadata } from '../../types/domain'

interface SwapTradeInFormProps {
  swapMetadata: SwapMetadata
  selectedModel: string
  selectedStorage: string
  conditionSelections: SwapConditionSelections
  showAdvancedChecks: boolean
  onModelChange: (model: string) => void
  onStorageChange: (storage: string) => void
  onConditionChange: <K extends keyof SwapConditionSelections>(key: K, value: SwapConditionSelections[K]) => void
  onToggleAdvancedChecks: () => void
}

const SwapTradeInForm: React.FC<SwapTradeInFormProps> = ({
  swapMetadata,
  selectedModel,
  selectedStorage,
  conditionSelections,
  showAdvancedChecks,
  onModelChange,
  onStorageChange,
  onConditionChange,
  onToggleAdvancedChecks,
}) => {
  const swapModels = useMemo(
    () => swapMetadata.models.map((entry) => entry.model).reverse(),
    [swapMetadata.models],
  )

  const availableCapacities = useMemo(
    () => (selectedModel ? swapMetadata.models.find((entry) => entry.model === selectedModel)?.capacities ?? [] : []),
    [selectedModel, swapMetadata.models],
  )

  return (
    <>
      <section className='ios-card-soft space-y-4'>
        <div className='flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between'>
          <div>
            <h2 className='ios-section-title'>Choose your trade-in iPhone</h2>
          </div>
        </div>

        <label className='block'>
          <span className='mb-2 block ios-card-title'>Model</span>
          <div className='relative'>
            <select
              value={selectedModel}
              onChange={(event) => onModelChange(event.target.value)}
              className='ios-input appearance-none pr-12'
            >
              <option value=''>Choose your current iPhone</option>
              {swapModels.map((model) => (
                <option key={model} value={model}>
                  {model}
                </option>
              ))}
            </select>
            <MdKeyboardArrowDown
              size={24}
              className='pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-secondaryText'
            />
          </div>
        </label>

        {selectedModel ? (
          <div className='rounded-[22px] bg-white/50 px-4 py-3'>
            <div className='mt-3 flex flex-wrap gap-2'>
              {availableCapacities.map((capacity) => (
                <button
                  key={capacity}
                  type='button'
                  onClick={() => onStorageChange(capacity)}
                  className={`ios-pill ${selectedStorage === capacity ? 'ios-pill-active' : ''}`}
                >
                  {capacity}
                </button>
              ))}
            </div>
          </div>
        ) : null}
      </section>

      <section className='ios-card-soft space-y-4'>
        <div className='flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between'>
          <div>
            <h2 className='ios-section-title'>Tell us about your iPhone</h2>
          </div>
        </div>

        <div className='space-y-4'>
          {swapMetadata.conditionFactors.slice(0, 2).map((factor) => (
            <div key={factor.key} className='space-y-3'>
              <ConditionSelector
                label={factor.label}
                options={factor.options}
                value={conditionSelections[factor.key] as string}
                onChange={(value) =>
                  onConditionChange(
                    factor.key,
                    value as SwapConditionSelections[typeof factor.key],
                  )
                }
                compact={factor.compact}
                selectedSummary={getConditionSummaryLabel(factor.key, conditionSelections, factor.options)}
              />
            </div>
          ))}

          <div className='rounded-[22px] border border-white/55 bg-white/42 px-4 py-3'>
            <div className='flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between'>
              <div>
                <p className='ios-card-title'>More details</p>
              </div>

              <button
                type='button'
                onClick={onToggleAdvancedChecks}
                className='ios-secondary-button w-full justify-center sm:w-auto'
              >
                {showAdvancedChecks ? 'Hide details' : 'Add details'}
              </button>
            </div>
          </div>

          {showAdvancedChecks ? swapMetadata.conditionFactors.slice(2).map((factor) => (
            <div key={factor.key} className='space-y-3'>
              <ConditionSelector
                label={factor.label}
                options={factor.options}
                value={conditionSelections[factor.key] as string}
                onChange={(value) =>
                  onConditionChange(
                    factor.key,
                    value as SwapConditionSelections[typeof factor.key],
                  )
                }
                compact={factor.compact}
                selectedSummary={getConditionSummaryLabel(factor.key, conditionSelections, factor.options)}
              />
            </div>
          )) : null}
        </div>
      </section>
    </>
  )
}

export default SwapTradeInForm
