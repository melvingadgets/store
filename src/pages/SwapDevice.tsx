import React, { useEffect, useMemo, useState } from 'react'
import { HiOutlineArrowTrendingUp } from 'react-icons/hi2'
import { MdKeyboardArrowDown, MdOutlineArrowBack } from 'react-icons/md'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useAssistant } from '../context/AssistantContext'
import { useEvaluateSwapQuery, useGetProductByIdQuery, useGetSwapMetadataQuery } from '../redux/shopApi'
import type { SwapConditionOption, SwapConditionSelections } from '../types/domain'
import formatPrice from '../utils/formatPrice'

const SwapDevice: React.FC = () => {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const [searchParams] = useSearchParams()
  const { tradeInDraft } = useAssistant()
  const {
    data: selectedProduct,
    isLoading: isSelectedProductLoading,
  } = useGetProductByIdQuery(id ?? '', { skip: !id })
  const {
    data: swapMetadata,
    isLoading: isSwapMetadataLoading,
  } = useGetSwapMetadataQuery()

  const requestedCapacity = String(searchParams.get('capacity') ?? '').trim().toUpperCase()
  const targetStorageOptions = useMemo(() => selectedProduct?.storageOptions ?? [], [selectedProduct])
  const selectedTargetStorageOption = useMemo(() => {
    if (targetStorageOptions.length === 0) {
      return null
    }

    return targetStorageOptions.find((option) => option.capacity === requestedCapacity) ?? targetStorageOptions[0]
  }, [requestedCapacity, targetStorageOptions])
  const targetPrice = selectedTargetStorageOption?.price ?? selectedProduct?.price ?? 0

  const [selectedModel, setSelectedModel] = useState('')
  const [selectedStorage, setSelectedStorage] = useState('')
  const [conditionSelections, setConditionSelections] = useState<SwapConditionSelections | null>(null)
  const [showAdvancedChecks, setShowAdvancedChecks] = useState(false)

  useEffect(() => {
    if (!swapMetadata?.defaultConditionSelections) {
      return
    }

    setConditionSelections((current) => current ?? swapMetadata.defaultConditionSelections)
  }, [swapMetadata?.defaultConditionSelections])

  const updateConditionSelection = <TKey extends keyof SwapConditionSelections>(
    key: TKey,
    value: SwapConditionSelections[TKey],
  ) => {
    setConditionSelections((current) => current
      ? {
          ...current,
          [key]: value,
        }
      : current)
  }

  const swapModels = useMemo(
    () => (swapMetadata?.models ?? []).map((entry) => entry.model).reverse(),
    [swapMetadata?.models],
  )

  const availableCapacities = useMemo(
    () => (selectedModel ? swapMetadata?.models.find((entry) => entry.model === selectedModel)?.capacities ?? [] : []),
    [selectedModel, swapMetadata?.models],
  )

  useEffect(() => {
    setSelectedStorage((current) =>
      current && availableCapacities.includes(current)
        ? current
        : availableCapacities[0] ?? '',
    )
  }, [availableCapacities])

  useEffect(() => {
    if (tradeInDraft.model && swapModels.includes(tradeInDraft.model)) {
      setSelectedModel((current) => current === tradeInDraft.model ? current : tradeInDraft.model ?? current)
    }
  }, [swapModels, tradeInDraft.model])

  useEffect(() => {
    if (tradeInDraft.storage && availableCapacities.includes(tradeInDraft.storage)) {
      setSelectedStorage((current) => current === tradeInDraft.storage ? current : tradeInDraft.storage ?? current)
    }
  }, [availableCapacities, tradeInDraft.storage])

  useEffect(() => {
    if (!conditionSelections) {
      return
    }

    setConditionSelections((current) => {
      if (!current) {
        return current
      }

      const nextSelections = {
        ...current,
        ...(tradeInDraft.overallCondition ? { overallCondition: tradeInDraft.overallCondition } : {}),
        ...(tradeInDraft.screenCondition ? { screenCondition: tradeInDraft.screenCondition } : {}),
        ...(tradeInDraft.batteryCondition ? { batteryCondition: tradeInDraft.batteryCondition } : {}),
        ...(tradeInDraft.faceIdStatus ? { faceIdStatus: tradeInDraft.faceIdStatus } : {}),
        ...(tradeInDraft.cameraStatus ? { cameraStatus: tradeInDraft.cameraStatus } : {}),
      }

      const hasChanged = Object.entries(nextSelections).some(([key, value]) => current[key as keyof SwapConditionSelections] !== value)
      return hasChanged ? nextSelections : current
    })
  }, [
    conditionSelections,
    tradeInDraft.batteryCondition,
    tradeInDraft.cameraStatus,
    tradeInDraft.faceIdStatus,
    tradeInDraft.overallCondition,
    tradeInDraft.screenCondition,
  ])

  const [debouncedEstimateInput, setDebouncedEstimateInput] = useState<{
    targetProductId: string
    targetCapacity?: string
    tradeInModel: string
    tradeInStorage: string
    conditionSelections: SwapConditionSelections
  } | null>(null)
  const {
    currentData: evaluation,
    isFetching: isSwapEvaluationFetching,
    isError: hasSwapEvaluationError,
  } = useEvaluateSwapQuery(debouncedEstimateInput as NonNullable<typeof debouncedEstimateInput>, {
    skip: debouncedEstimateInput === null,
  })
  const hasEstimate = evaluation !== undefined
  const displayImage = selectedProduct?.image ?? ''

  const handleContinueToBuyOptions = () => {
    if (!selectedProduct?._id) {
      return
    }

    const query = new URLSearchParams()
    if (selectedTargetStorageOption?.capacity) {
      query.set('capacity', selectedTargetStorageOption.capacity)
    }

    navigate(`/product/${selectedProduct._id}${query.toString() ? `?${query.toString()}` : ''}`)
  }

  useEffect(() => {
    if (!selectedProduct || !conditionSelections || !hasEstimateInputs(selectedModel, selectedStorage)) {
      setDebouncedEstimateInput(null)
      return
    }

    const timer = window.setTimeout(() => {
      setDebouncedEstimateInput({
        targetProductId: selectedProduct._id,
        targetCapacity: selectedTargetStorageOption?.capacity,
        tradeInModel: selectedModel,
        tradeInStorage: selectedStorage,
        conditionSelections,
      })
    }, 250)

    return () => window.clearTimeout(timer)
  }, [
    conditionSelections,
    selectedModel,
    selectedProduct,
    selectedStorage,
    selectedTargetStorageOption,
  ])

  if (isSelectedProductLoading || isSwapMetadataLoading || !conditionSelections) {
    return null
  }

  if (!selectedProduct) {
    return (
      <div className='ios-mobile-shell flex min-h-screen items-center justify-center px-4'>
        <div className='ios-card ios-body-muted text-center'>Product not found.</div>
      </div>
    )
  }

  if (!swapMetadata) {
    return (
      <div className='ios-mobile-shell flex min-h-screen items-center justify-center px-4'>
        <div className='ios-card ios-body-muted text-center'>Swap options are unavailable right now.</div>
      </div>
    )
  }

  return (
    <div className='ios-mobile-shell'>
      <div className='ios-page-tight'>
        <header className='ios-topbar'>
          <button type='button' onClick={() => navigate(-1)} className='ios-icon-button shrink-0' aria-label='Go back'>
            <MdOutlineArrowBack size={22} />
          </button>

          <div className='min-w-0 flex-1'>
            <p className='ios-overline'>Trade-in</p>
            <span className='ios-nav-title block truncate'>Estimate</span>
          </div>

          <div className='w-11 shrink-0' />
        </header>

        <div className='space-y-4 pb-6'>
          <section className='ios-card space-y-5'>
            <div className='overflow-hidden rounded-[28px] bg-white/58 p-4'>
              {displayImage ? (
                <img
                  src={displayImage}
                  alt={selectedProduct.name}
                  className='mx-auto h-52 w-full rounded-[22px] bg-white/72 p-4 object-contain'
                />
              ) : (
                <div className='mx-auto flex h-52 w-full items-center justify-center rounded-[22px] bg-white/72 p-4 text-center'>
                  <span className='ios-body-muted font-semibold text-textPrimary'>Image unavailable</span>
                </div>
              )}
            </div>

            <div className='flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between'>
              <div className='min-w-0 flex-1'>
                <h1 className='ios-page-title text-[2.05rem]'>{selectedProduct.name}</h1>
              </div>
              <div className='w-full rounded-[24px] bg-white/62 px-4 py-3 text-left shadow-[0_12px_24px_rgba(17,33,62,0.08)] sm:w-auto sm:text-right'>
                <p className='ios-caption uppercase'>Store price</p>
                <p className='ios-price-inline mt-2 block'>{formatPrice(evaluation?.targetPrice ?? targetPrice)}</p>
              </div>
            </div>
          </section>

          <section className='ios-card-soft space-y-4'>
            <div className='flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between'>
              <div>
                <h2 className='ios-section-title'>Choose your trade-in iPhone</h2>
              </div>
            </div>

            <label className='block'>
              <span className='ios-card-title block mb-2'>Model</span>
              <div className='relative'>
                <select
                  value={selectedModel}
                  onChange={(event) => setSelectedModel(event.target.value)}
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

            {selectedModel && (
              <div className='rounded-[22px] bg-white/50 px-4 py-3'>
                <div className='mt-3 flex flex-wrap gap-2'>
                  {availableCapacities.map((capacity) => (
                    <button
                      key={capacity}
                      type='button'
                      onClick={() => setSelectedStorage(capacity)}
                      className={`ios-pill ${selectedStorage === capacity ? 'ios-pill-active' : ''}`}
                    >
                      {capacity}
                    </button>
                  ))}
                </div>
              </div>
            )}
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
                      updateConditionSelection(
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
                    onClick={() => setShowAdvancedChecks((current) => !current)}
                    className='ios-secondary-button w-full justify-center sm:w-auto'
                  >
                    {showAdvancedChecks ? 'Hide details' : 'Add details'}
                  </button>
                </div>
              </div>

              {showAdvancedChecks && swapMetadata.conditionFactors.slice(2).map((factor) => (
                <div key={factor.key} className='space-y-3'>
                  <ConditionSelector
                    label={factor.label}
                    options={factor.options}
                    value={conditionSelections[factor.key] as string}
                    onChange={(value) =>
                      updateConditionSelection(
                        factor.key,
                        value as SwapConditionSelections[typeof factor.key],
                      )
                    }
                    compact={factor.compact}
                    selectedSummary={getConditionSummaryLabel(factor.key, conditionSelections, factor.options)}
                  />
                </div>
              ))}
            </div>
          </section>

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

            {hasEstimate ? (
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
                  <p className='ios-card-title mt-2'>{selectedModel}</p>
                  <p className='ios-meta mt-1'>{selectedStorage}</p>
                </div>

                <div className='mt-4 flex flex-col gap-3 sm:flex-row'>
                  <button
                    type='button'
                    onClick={handleContinueToBuyOptions}
                    className='ios-primary-button w-full justify-center sm:flex-1'
                  >
                    Continue to buy options
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
                  Once you choose your current iPhone, this page calculates an estimate and the balance left for
                  {` ${selectedProduct.name}.`}
                </p>
              </div>
            )}

            <div className='rounded-[24px] border border-white/55 bg-white/42 px-4 py-3'>
              <p className='ios-meta'>
                Final credit is confirmed after inspection.
              </p>
              {isSwapEvaluationFetching && debouncedEstimateInput && (
                <p className='ios-meta mt-2'>Updating swap estimate...</p>
              )}
              {hasSwapEvaluationError && debouncedEstimateInput && (
                <p className='ios-meta mt-2'>Swap estimate is temporarily unavailable.</p>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}

const hasEstimateInputs = (
  selectedModel: string,
  selectedStorage: string,
) =>
  selectedModel.length > 0 &&
  selectedStorage.length > 0

interface ConditionSelectorProps<TValue extends string> {
  label: string
  options: SwapConditionOption<TValue>[]
  value: string
  onChange: (value: TValue) => void
  compact?: boolean
  selectedSummary?: string
}

const ConditionSelector = <TValue extends string>({
  label,
  options,
  value,
  onChange,
  compact = false,
  selectedSummary,
}: ConditionSelectorProps<TValue>) => (
  <div className='space-y-2'>
    <div className='flex flex-col items-start gap-1 sm:flex-row sm:items-center sm:justify-between'>
      <span className='ios-card-title'>{label}</span>
      <span className='ios-meta'>{selectedSummary ?? options.find((option) => option.value === value)?.label}</span>
    </div>

    <div className={`flex flex-wrap gap-2 ${compact ? 'sm:grid sm:grid-cols-2' : ''}`}>
      {options.map((option) => {
        const isSelected = option.value === value

        return (
          <button
            key={option.value}
            type='button'
            onClick={() => onChange(option.value)}
            className={`min-h-11 min-w-[calc(50%-0.25rem)] rounded-[20px] px-4 py-2.5 text-left transition duration-200 active:scale-[0.98] sm:min-w-0 ${
              isSelected
                ? 'bg-primary text-white shadow-[0_14px_28px_rgba(5,103,171,0.22)]'
                : 'bg-white/56 text-textPrimary shadow-[0_10px_18px_rgba(17,33,62,0.06)]'
            }`}
          >
            <span className='block text-[0.96rem] font-semibold'>{option.label}</span>
          </button>
        )
      })}
    </div>
  </div>
)

const getConditionSummaryLabel = (
  factorKey: string,
  selections: SwapConditionSelections,
  options: SwapConditionOption<string>[],
) => {
  const selectedLabel = options.find((option) => option.value === selections[factorKey as keyof SwapConditionSelections])?.label
  return selectedLabel
}

export default SwapDevice
