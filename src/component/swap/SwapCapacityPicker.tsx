import React, { useMemo } from 'react'
import type { Product } from '../../types/domain'
import formatPrice from '../../utils/formatPrice'

interface SwapCapacityPickerProps {
  product: Product
  selectedCapacity: string
  onSelectCapacity: (capacity: string) => void
}

const SwapCapacityPicker: React.FC<SwapCapacityPickerProps> = ({
  product,
  selectedCapacity,
  onSelectCapacity,
}) => {
  const storageOptions = useMemo(() => product.storageOptions ?? [], [product.storageOptions])

  if (!storageOptions.length) {
    return null
  }

  const selectedStorageOption = storageOptions.find((option) => option.capacity === selectedCapacity) ?? storageOptions[0]

  return (
    <section className='ios-card-soft space-y-4'>
      <div className='flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between'>
        <div>
          <p className='ios-overline'>Configuration</p>
          <h2 className='ios-section-title mt-2'>Choose capacity</h2>
        </div>
        <span className='ios-price-inline'>{formatPrice(selectedStorageOption.price)}</span>
      </div>

      <div className='flex items-center gap-3 rounded-[24px] bg-white/58 p-4 shadow-[0_12px_24px_rgba(17,33,62,0.08)]'>
        <div className='flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-[18px] bg-white/70 p-2'>
          {product.image ? (
            <img src={product.image} alt={product.name} className='h-full w-full object-contain' />
          ) : (
            <span className='ios-meta text-center'>No image</span>
          )}
        </div>

        <div className='min-w-0 flex-1'>
          <p className='ios-card-title truncate'>{product.name}</p>
          <p className='ios-meta mt-1'>
            Selected: <span className='font-semibold text-textPrimary'>{selectedStorageOption.capacity}</span>
          </p>
        </div>
      </div>

      <div className='flex flex-wrap gap-2'>
        {storageOptions.map((option) => (
          <button
            key={option.capacity}
            type='button'
            onClick={() => onSelectCapacity(option.capacity)}
            className={`ios-pill ${selectedStorageOption.capacity === option.capacity ? 'ios-pill-active' : ''}`}
          >
            {option.capacity}
          </button>
        ))}
      </div>
    </section>
  )
}

export default SwapCapacityPicker
