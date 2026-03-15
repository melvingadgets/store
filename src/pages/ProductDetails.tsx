import React, { useEffect, useMemo, useState } from 'react'
import { HiOutlineShoppingCart } from 'react-icons/hi'
import { MdOutlineArrowBack } from 'react-icons/md'
import { useDispatch, useSelector } from 'react-redux'
import { useNavigate, useParams } from 'react-router-dom'
import { addItemToCart, fetchCart } from '../features/cart/cartSlice'
import { useGetProductByIdQuery } from '../redux/shopApi'
import type { AppDispatch, RootState } from '../redux/store'
import formatPrice from '../utils/formatPrice'
import { createCartLineId } from '../utils/normalizers'
import { notify } from '../utils/notification'

const ProductDetails = () => {
  const navigate = useNavigate()
  const dispatch = useDispatch<AppDispatch>()
  const {id} = useParams<{id: string}>()
  const {
    data: selectedProduct,
    isLoading,
  } = useGetProductByIdQuery(id ?? "", { skip: !id })
  const cartItems = useSelector((state: RootState)=> state.cart.items)
  const user = useSelector((state: RootState) => state.auth.user)
  const totalQuantity = cartItems.reduce((total, item)=> total + item.quantity, 0)
  const storageOptions = useMemo(() => selectedProduct?.storageOptions ?? [], [selectedProduct])
  const hasStorageOptions = storageOptions.length > 0
  const [selectedCapacity, setSelectedCapacity] = useState("")
  const [isOptionsSheetOpen, setIsOptionsSheetOpen] = useState(false)

  useEffect(() => {
    if (user?._id) {
      void dispatch(fetchCart())
    }
  }, [dispatch, user?._id])

  useEffect(() => {
    if (storageOptions.length > 0) {
      setSelectedCapacity((current) =>
        current && storageOptions.some((option) => option.capacity === current)
          ? current
          : storageOptions[0].capacity,
      )
      return
    }

    setSelectedCapacity("")
  }, [storageOptions])

  const selectedStorageOption = useMemo(
    () => storageOptions.find((option) => option.capacity === selectedCapacity) ?? null,
    [selectedCapacity, storageOptions],
  )

  const lineId = selectedProduct?._id
    ? createCartLineId(selectedProduct._id, selectedStorageOption?.capacity)
    : ""
  const cartQuantity = cartItems.find((item) => item.id === lineId)?.quantity ?? 0
  const fallbackDisplayPrice = selectedStorageOption?.price ?? selectedProduct?.price ?? 0
  const displayPrice = selectedProduct ? fallbackDisplayPrice : 0
  const displayImage = selectedProduct?.image ?? ""
  const availableStock = selectedStorageOption?.qty ?? selectedProduct?.qty ?? 0
  const isOutOfStock = availableStock < 1

  const ensureActionReady = () => {
    if (!selectedProduct?._id) {
      return false
    }

    if (hasStorageOptions && !selectedStorageOption) {
      notify("warning", "Select a capacity before continuing")
      return false
    }

    if (isOutOfStock) {
      notify("warning", "This option is currently out of stock")
      return false
    }

    return true
  }

  const buildActionUrl = (path: "easybuy" | "swap") => {
    if (!selectedProduct?._id) {
      return ""
    }

    const query = new URLSearchParams()
    if (selectedStorageOption?.capacity) {
      query.set("capacity", selectedStorageOption.capacity)
    }

    const queryString = query.toString()
    return `/product/${selectedProduct._id}/${path}${queryString ? `?${queryString}` : ""}`
  }

  const ensureSelectionInCart = async () => {
    if (!selectedProduct?._id || cartQuantity > 0) {
      return
    }

    await dispatch(addItemToCart({
      productId: selectedProduct._id,
      name: selectedProduct.name,
      price: displayPrice,
      image: displayImage,
      capacity: selectedStorageOption?.capacity,
      availableQuantity: availableStock,
    })).unwrap()
  }

  const handleBuyNow = async () => {
    if (!ensureActionReady()) {
      return
    }

    try {
      await ensureSelectionInCart()
      navigate("/checkout")
    } catch (error) {
      notify("error", error instanceof Error ? error.message : "Unable to continue to checkout")
    }
  }

  const handleNavigateToOffer = (path: "easybuy" | "swap") => {
    if (!ensureActionReady()) {
      return
    }

    const actionUrl = buildActionUrl(path)
    if (!actionUrl) {
      return
    }

    setIsOptionsSheetOpen(false)
    navigate(actionUrl)
  }

  const handleOpenOptionsSheet = async () => {
    if (!ensureActionReady()) {
      return
    }

    try {
      await ensureSelectionInCart()
      setIsOptionsSheetOpen(true)
    } catch (error) {
      notify("error", error instanceof Error ? error.message : "Unable to continue")
    }
  }

  const handleBuyNowFromSheet = async () => {
    setIsOptionsSheetOpen(false)
    await handleBuyNow()
  }

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
      <div className="ios-page pb-36">
        <header className="ios-topbar">
          <button type="button" onClick={()=> navigate(-1)} className="ios-icon-button shrink-0" aria-label="Go back">
            <MdOutlineArrowBack size={22}/>
          </button>

          <div className="min-w-0 flex-1">
            <p className="ios-overline">Product</p>
            <span className="ios-nav-title block truncate">Product details</span>
          </div>

          <button type="button" className="ios-icon-button relative shrink-0" onClick={() => navigate("/cart")} aria-label="Open cart">
            <HiOutlineShoppingCart size={22} />
            <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-xs font-bold text-white">
              {totalQuantity}
            </span>
          </button>
        </header>

        <div className="space-y-4">
          <section className="ios-card overflow-hidden p-5">
            <div className="rounded-[28px] bg-white/55 p-4">
              {displayImage ? (
                <img src={displayImage} alt={selectedProduct.name} className='h-[300px] w-full object-contain' />
              ) : (
                <div className='flex h-[300px] w-full items-center justify-center rounded-[22px] bg-white/48 px-6 text-center'>
                  <span className='ios-body-muted font-semibold text-textPrimary'>Image unavailable</span>
                </div>
              )}
            </div>

            <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0 flex-1">
                <span className="ios-pill">In store</span>
                <h1 className='ios-page-title mt-3'>{selectedProduct.name}</h1>
                <p className='ios-body-muted mt-3'>
                  {selectedProduct.desc || "Built for a cleaner mobile shopping experience, with live pricing based on your selected configuration."}
                </p>
              </div>
              <div className="w-full rounded-[24px] bg-white/62 px-4 py-3 text-left shadow-[0_12px_24px_rgba(17,33,62,0.08)] sm:w-auto sm:text-right">
                <p className='ios-caption uppercase'>Price</p>
                <p className='ios-price mt-2'>{formatPrice(displayPrice)}</p>
              </div>
            </div>
          </section>

          <section className="ios-card-soft">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className='ios-card-title'>Availability</p>
                <p className='ios-meta mt-1'>Live stock for the currently selected option.</p>
              </div>
              <span className={`ios-pill ${isOutOfStock ? '' : 'ios-pill-active'}`}>
                {isOutOfStock ? "Out of stock" : `${availableStock} in stock`}
              </span>
            </div>
            {selectedStorageOption && (
              <p className='ios-meta mt-3'>Selected capacity: <span className="font-semibold text-textPrimary">{selectedStorageOption.capacity}</span></p>
            )}
            {cartQuantity > 0 && (
              <p className='ios-meta mt-2'>Already in cart: <span className="font-semibold text-textPrimary">{cartQuantity}</span></p>
            )}
          </section>

          {hasStorageOptions && (
            <section className="ios-card-soft">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className='ios-section-title'>Choose capacity</h2>
                  <p className='ios-body-muted mt-1'>Pricing updates instantly when you switch storage.</p>
                </div>
                <span className="ios-pill">{storageOptions.length} options</span>
              </div>

              <div className="mt-4 flex flex-wrap gap-3">
                {storageOptions.map((option) => {
                  const isSelected = selectedCapacity === option.capacity

                  return (
                    <button
                      key={option.capacity}
                      type="button"
                      onClick={() => setSelectedCapacity(option.capacity)}
                      className={`min-w-[5.5rem] rounded-[22px] px-4 py-3 text-left transition duration-200 active:scale-[0.98] ${
                        isSelected
                          ? "bg-primary text-white shadow-[0_14px_28px_rgba(5,103,171,0.24)]"
                          : "bg-white/58 text-textPrimary shadow-[0_10px_20px_rgba(10,71,125,0.08)]"
                      }`}
                    >
                      <span className="block text-base font-bold">{option.capacity}</span>
                      <span className={`mt-1 block text-sm ${isSelected ? "text-white/82" : "text-secondaryText"}`}>
                        {formatPrice(option.price)}
                      </span>
                    </button>
                  )
                })}
              </div>
            </section>
          )}
        </div>
      </div>

      <div className="fixed bottom-3 left-1/2 z-40 w-[calc(100%-1.5rem)] max-w-screen-md -translate-x-1/2">
        <div className="ios-glass-strong rounded-[30px] px-4 py-3" style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 0.75rem)" }}>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="min-w-0 flex-1">
              <p className='ios-caption uppercase'>Selected option</p>
              <p className='ios-card-title mt-1 break-words text-[1.05rem] sm:truncate sm:text-[1.12rem]'>
                {selectedStorageOption ? selectedStorageOption.capacity : "Standard option"}
              </p>
              <p className='ios-meta mt-1 break-words sm:truncate'>
                {formatPrice(displayPrice)}
                {cartQuantity > 0 ? ` / ${cartQuantity} in cart` : ""}
              </p>
            </div>

            <button
              className="ios-primary-button w-full sm:w-auto sm:min-w-[9.5rem] disabled:cursor-not-allowed disabled:opacity-60"
              onClick={() => void handleOpenOptionsSheet()}
              disabled={isOutOfStock}
            >
              {isOutOfStock ? "Out of stock" : "Add to cart"}
            </button>
          </div>
        </div>
      </div>

      {isOptionsSheetOpen && (
        <div className="fixed inset-0 z-50 flex items-end bg-slate-950/28">
          <button
            type="button"
            aria-label="Close purchase options"
            className="absolute inset-0"
            onClick={() => setIsOptionsSheetOpen(false)}
          />
          <div className="relative mx-auto w-full max-w-screen-md">
            <div className="ios-sheet">
              <div className="mx-auto h-1.5 w-16 rounded-full bg-slate-300/80" />
              <div className="mt-4">
                <p className="ios-section-title">Choose what to do next</p>
                <p className="ios-body-muted mt-1">
                  {selectedStorageOption ? `${selectedStorageOption.capacity} selected` : "Current device selected"}
                </p>
              </div>

              <div className="mt-5 space-y-3">
                <button
                  type="button"
                  onClick={() => void handleBuyNowFromSheet()}
                  className="ios-primary-button flex w-full flex-col gap-3 rounded-[26px] px-5 py-4 text-left sm:flex-row sm:items-start sm:justify-between"
                >
                  <span>
                    <span className="block text-[1.02rem] font-bold">Buy now</span>
                    <span className="mt-1 block text-[0.92rem] text-white/82">Go straight to checkout</span>
                  </span>
                  <span className="text-base font-bold text-white/82">{formatPrice(displayPrice)}</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleNavigateToOffer("easybuy")}
                  className="ios-secondary-button flex w-full flex-col gap-3 rounded-[26px] px-5 py-4 text-left sm:flex-row sm:items-start sm:justify-between"
                >
                  <span>
                    <span className="block text-[1.02rem] font-bold text-textPrimary">Buy on EasyBuy</span>
                    <span className="mt-1 block ios-meta">Continue on the EasyBuy page</span>
                  </span>
                  <span className="ios-pill ios-pill-active">Route</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleNavigateToOffer("swap")}
                  className="ios-secondary-button flex w-full flex-col gap-3 rounded-[26px] px-5 py-4 text-left sm:flex-row sm:items-start sm:justify-between"
                >
                  <span>
                    <span className="block text-[1.02rem] font-bold text-textPrimary">Swap old device</span>
                    <span className="mt-1 block ios-meta">Open the swap flow for this device</span>
                  </span>
                  <span className="ios-pill">Route</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default ProductDetails
