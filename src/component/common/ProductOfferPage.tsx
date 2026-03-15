import React, { useMemo } from 'react'
import { MdOutlineArrowBack } from 'react-icons/md'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useGetProductByIdQuery } from '../../redux/shopApi'
import formatPrice from '../../utils/formatPrice'

interface ProductOfferPageProps {
  title: string
  badge: string
  description: string
}

const ProductOfferPage: React.FC<ProductOfferPageProps> = ({ title, badge, description }) => {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const [searchParams] = useSearchParams()
  const {
    data: selectedProduct,
    isLoading,
  } = useGetProductByIdQuery(id ?? "", { skip: !id })

  const requestedCapacity = String(searchParams.get("capacity") ?? "").trim().toUpperCase()
  const storageOptions = useMemo(() => selectedProduct?.storageOptions ?? [], [selectedProduct])
  const selectedStorageOption = useMemo(() => {
    if (storageOptions.length === 0) {
      return null
    }

    return storageOptions.find((option) => option.capacity === requestedCapacity) ?? storageOptions[0]
  }, [requestedCapacity, storageOptions])
  const fallbackPrice = selectedStorageOption?.price ?? selectedProduct?.price ?? 0
  const displayPrice = selectedProduct ? fallbackPrice : 0
  const displayImage = selectedProduct?.image ?? ""

  if (isLoading) {
    return null
  }

  if (!selectedProduct) {
    return (
      <div className='ios-mobile-shell flex min-h-screen items-center justify-center px-4'>
        <div className='ios-card ios-body-muted text-center'>Product not found.</div>
      </div>
    )
  }

  return (
    <div className='ios-mobile-shell'>
      <div className="ios-page-tight">
        <header className="ios-topbar">
          <button type="button" onClick={() => navigate(-1)} className="ios-icon-button shrink-0" aria-label="Go back">
            <MdOutlineArrowBack size={22} />
          </button>

          <div className="min-w-0 flex-1">
            <p className="ios-overline">Offer</p>
            <span className="ios-nav-title block truncate">{title}</span>
          </div>

          <div className="w-11 shrink-0" />
        </header>

        <div className="ios-card space-y-5">
          <span className="ios-pill ios-pill-active">{badge}</span>

          <div className="overflow-hidden rounded-[28px] bg-white/58 p-4">
            {displayImage ? (
              <img
                src={displayImage}
                alt={selectedProduct.name}
                className='mx-auto h-64 w-full rounded-[22px] object-contain bg-white/72 p-4'
              />
            ) : (
              <div className='mx-auto flex h-64 w-full items-center justify-center rounded-[22px] bg-white/72 p-4 text-center'>
                <span className='ios-body-muted font-semibold text-textPrimary'>Image unavailable</span>
              </div>
            )}
          </div>

          <div>
            <h1 className='ios-page-title text-[2.1rem]'>{selectedProduct.name}</h1>
            <p className='ios-body-muted mt-3'>{description}</p>
          </div>

          <div className="rounded-[26px] bg-white/58 p-4 shadow-[0_12px_24px_rgba(17,33,62,0.08)]">
            <p className='ios-caption uppercase'>Selected device</p>
            <p className='ios-section-title mt-2'>{selectedProduct.name}</p>
            {selectedStorageOption && (
              <p className='ios-meta mt-1'>Capacity: {selectedStorageOption.capacity}</p>
            )}
            <p className='ios-price mt-4'>{formatPrice(displayPrice)}</p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ProductOfferPage
