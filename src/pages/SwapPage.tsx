import React, { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import SwapCapacityPicker from '../component/swap/SwapCapacityPicker'
import SwapEstimateCard from '../component/swap/SwapEstimateCard'
import SwapProductCarousel from '../component/swap/SwapProductCarousel'
import SwapTradeInForm from '../component/swap/SwapTradeInForm'
import SwapWhatsAppSheet from '../component/swap/SwapWhatsAppSheet'
import { useAssistant } from '../context/AssistantContext'
import {
  useEvaluateSwapQuery,
  useGetProductsQuery,
  useGetSwapMetadataQuery,
} from '../redux/shopApi'
import type { SwapConditionSelections } from '../types/domain'
import { buildSwapWhatsAppMessage, buildSwapWhatsAppUrl } from '../utils/swapMessage'
import { resetGlobalLoad } from '../lib/globalLoading'

const SwapPage: React.FC = () => {
  const [searchParams] = useSearchParams()
  const { tradeInDraft } = useAssistant()
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null)
  const [selectedCapacity, setSelectedCapacity] = useState('')
  const [selectedModel, setSelectedModel] = useState('')
  const [selectedStorage, setSelectedStorage] = useState('')
  const [conditionSelections, setConditionSelections] = useState<SwapConditionSelections | null>(null)
  const [showAdvancedChecks, setShowAdvancedChecks] = useState(false)
  const [isWhatsAppSheetOpen, setIsWhatsAppSheetOpen] = useState(false)
  const [debouncedEstimateInput, setDebouncedEstimateInput] = useState<{
    targetProductId: string
    targetCapacity?: string
    tradeInModel: string
    tradeInStorage: string
    conditionSelections: SwapConditionSelections
  } | null>(null)

  const { data: products, isLoading: isProductsLoading } = useGetProductsQuery()
  const { data: swapMetadata, isLoading: isSwapMetadataLoading } = useGetSwapMetadataQuery()

  useEffect(() => {
    if (!isProductsLoading && !isSwapMetadataLoading) {
      resetGlobalLoad()
    }
  }, [isProductsLoading, isSwapMetadataLoading])


  const selectedProduct = useMemo(
    () => products?.find((product) => product._id === selectedProductId) ?? null,
    [products, selectedProductId],
  )
  const storageOptions = useMemo(() => selectedProduct?.storageOptions ?? [], [selectedProduct?.storageOptions])
  const selectedStorageOption = useMemo(
    () => storageOptions.find((option) => option.capacity === selectedCapacity) ?? null,
    [selectedCapacity, storageOptions],
  )
  const targetPrice = selectedStorageOption?.price ?? selectedProduct?.price ?? 0
  const requestedCapacity = String(searchParams.get('capacity') ?? '').trim().toUpperCase()

  const swapModels = useMemo(
    () => (swapMetadata?.models ?? []).map((entry) => entry.model).reverse(),
    [swapMetadata?.models],
  )
  const availableCapacities = useMemo(
    () => (selectedModel ? swapMetadata?.models.find((entry) => entry.model === selectedModel)?.capacities ?? [] : []),
    [selectedModel, swapMetadata?.models],
  )

  useEffect(() => {
    const preselectedProductId = searchParams.get('productId')
    const preselectedCapacity = searchParams.get('capacity')

    if (preselectedProductId) {
      setSelectedProductId(preselectedProductId)
    }

    if (preselectedCapacity) {
      setSelectedCapacity(preselectedCapacity.trim().toUpperCase())
    }
  }, [searchParams])

  useEffect(() => {
    if (!swapMetadata?.defaultConditionSelections) {
      return
    }

    setConditionSelections((current) => current ?? swapMetadata.defaultConditionSelections)
  }, [swapMetadata?.defaultConditionSelections])

  useEffect(() => {
    if (!selectedProduct) {
      setSelectedCapacity('')
      return
    }

    if (!storageOptions.length) {
      setSelectedCapacity('')
      return
    }

    const preselectedOption = requestedCapacity
      ? storageOptions.find((option) => option.capacity === requestedCapacity)
      : null

    setSelectedCapacity(preselectedOption?.capacity ?? storageOptions[0].capacity)
  }, [requestedCapacity, selectedProduct?._id, storageOptions])

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

      const hasChanged = Object.entries(nextSelections).some(
        ([key, value]) => current[key as keyof SwapConditionSelections] !== value,
      )

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

  const {
    currentData: evaluation,
    isFetching: isSwapEvaluationFetching,
    isError: hasSwapEvaluationError,
  } = useEvaluateSwapQuery(debouncedEstimateInput as NonNullable<typeof debouncedEstimateInput>, {
    skip: debouncedEstimateInput === null,
  })

  useEffect(() => {
    if (!selectedProduct || !conditionSelections || !selectedModel || !selectedStorage) {
      setDebouncedEstimateInput(null)
      return
    }

    const timer = window.setTimeout(() => {
      setDebouncedEstimateInput({
        targetProductId: selectedProduct._id,
        targetCapacity: selectedCapacity || undefined,
        tradeInModel: selectedModel,
        tradeInStorage: selectedStorage,
        conditionSelections,
      })
    }, 250)

    return () => window.clearTimeout(timer)
  }, [conditionSelections, selectedCapacity, selectedModel, selectedProduct, selectedStorage])

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

  const handleOpenWhatsApp = () => {
    if (evaluation && selectedProduct) {
      setIsWhatsAppSheetOpen(true)
    }
  }

  const whatsAppPhone = import.meta.env.VITE_WHATSAPP_PHONE ?? ''

  const whatsAppMessage = evaluation && selectedProduct && conditionSelections
    ? buildSwapWhatsAppMessage({
        targetProductName: selectedProduct.name,
        targetCapacity: selectedCapacity || undefined,
        targetPrice,
        tradeInModel: selectedModel,
        tradeInStorage: selectedStorage,
        conditionSelections,
        evaluation,
      })
    : ''

  const whatsAppUrl = evaluation && selectedProduct && conditionSelections
    ? buildSwapWhatsAppUrl(whatsAppPhone, {
        targetProductName: selectedProduct.name,
        targetCapacity: selectedCapacity || undefined,
        targetPrice,
        tradeInModel: selectedModel,
        tradeInStorage: selectedStorage,
        conditionSelections,
        evaluation,
      })
    : ''

  return (
    <div className='ios-mobile-shell'>
      <div className='ios-page-tight'>
        <header className='ios-topbar'>
          <div className='min-w-0 flex-1'>
            <p className='ios-overline'>Trade-in</p>
            <span className='ios-nav-title block truncate'>Estimate</span>
          </div>
        </header>

        <div className='space-y-4 pb-6'>
          <SwapProductCarousel
            selectedProductId={selectedProductId}
            onSelectProduct={setSelectedProductId}
          />

          {selectedProductId && !selectedProduct && !isProductsLoading ? (
            <section className='ios-card-soft'>
              <p className='ios-body-muted'>The selected product is unavailable. Choose another device to continue.</p>
            </section>
          ) : null}

          {selectedProduct ? (
            <SwapCapacityPicker
              product={selectedProduct}
              selectedCapacity={selectedCapacity}
              onSelectCapacity={setSelectedCapacity}
            />
          ) : null}

          {swapMetadata && conditionSelections ? (
            <SwapTradeInForm
              swapMetadata={swapMetadata}
              selectedModel={selectedModel}
              selectedStorage={selectedStorage}
              conditionSelections={conditionSelections}
              showAdvancedChecks={showAdvancedChecks}
              onModelChange={setSelectedModel}
              onStorageChange={setSelectedStorage}
              onConditionChange={updateConditionSelection}
              onToggleAdvancedChecks={() => setShowAdvancedChecks((current) => !current)}
            />
          ) : (
            <section className='ios-card-soft'>
              <p className='ios-body-muted'>
                {isSwapMetadataLoading ? 'Loading swap options...' : 'Swap options are unavailable right now.'}
              </p>
            </section>
          )}

          <SwapEstimateCard
            evaluation={evaluation}
            isEvaluating={isSwapEvaluationFetching && debouncedEstimateInput !== null}
            hasError={hasSwapEvaluationError && debouncedEstimateInput !== null}
            selectedModel={selectedModel}
            selectedStorage={selectedStorage}
            targetProductName={selectedProduct?.name ?? ''}
            onOpenWhatsApp={handleOpenWhatsApp}
          />
        </div>
      </div>

      <SwapWhatsAppSheet
        isOpen={isWhatsAppSheetOpen}
        onClose={() => setIsWhatsAppSheetOpen(false)}
        whatsAppUrl={whatsAppUrl}
        messagePreview={whatsAppMessage}
      />
    </div>
  )
}

export default SwapPage
