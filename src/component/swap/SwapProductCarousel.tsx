import React from 'react'
import { Swiper, SwiperSlide } from 'swiper/react'
import { FreeMode } from 'swiper/modules'
import 'swiper/css'
import 'swiper/css/free-mode'
import { useGetProductsQuery } from '../../redux/shopApi'
import formatPrice from '../../utils/formatPrice'
import { MdCheckCircle } from 'react-icons/md'

interface SwapProductCarouselProps {
  selectedProductId: string | null
  onSelectProduct: (productId: string) => void
}

const SwapProductCarousel: React.FC<SwapProductCarouselProps> = ({
  selectedProductId,
  onSelectProduct,
}) => {
  const {
    data: products,
    isLoading,
    isError,
  } = useGetProductsQuery()

  return (
    <section className='ios-card space-y-4'>
      <div className='flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between'>
        <div>
          <p className='ios-overline'>Swap target</p>
          <h2 className='ios-section-title mt-2'>Choose the device you want</h2>
        </div>
        {products?.length ? <span className='ios-pill'>{products.length} options</span> : null}
      </div>

      {isLoading ? (
        <div className='rounded-[26px] bg-white/54 p-5'>
          <p className='ios-card-title'>Loading products...</p>
          <p className='ios-body-muted mt-2'>Available swap targets are being prepared.</p>
        </div>
      ) : null}

      {!isLoading && isError ? (
        <div className='rounded-[26px] bg-white/54 p-5'>
          <p className='ios-card-title'>Products are unavailable right now.</p>
          <p className='ios-body-muted mt-2'>Try again in a moment.</p>
        </div>
      ) : null}

      {!isLoading && !isError && !products?.length ? (
        <div className='rounded-[26px] bg-white/54 p-5'>
          <p className='ios-card-title'>No products available for swap yet.</p>
          <p className='ios-body-muted mt-2'>Add products with pricing to start the flow.</p>
        </div>
      ) : null}

      {products?.length ? (
        <Swiper
          modules={[FreeMode]}
          freeMode
          slidesPerView='auto'
          spaceBetween={12}
          className='-mx-1 !px-1'
        >
          {products.map((product) => {
            const fromPrice = product.storageOptions?.[0]?.price ?? product.price
            const isSelected = product._id === selectedProductId

            return (
              <SwiperSlide key={product._id} className='!w-[15.25rem] sm:!w-[16.25rem]'>
                <button
                  type='button'
                  onClick={() => onSelectProduct(product._id)}
                  className={`group relative flex h-full w-full flex-col rounded-[22px] border p-3 text-left shadow-[0_12px_24px_rgba(17,33,62,0.08)] transition-all duration-300 active:scale-[0.98] ${
                    isSelected
                      ? 'border-primary bg-white/80 ring-4 ring-primary/20 shadow-primary/20'
                      : 'border-white/60 bg-white/58 hover:border-white/80 hover:bg-white/70'
                  }`}
                >
                  {isSelected && (
                    <div className='absolute right-4 top-4 z-10 text-primary drop-shadow-md animate-in zoom-in duration-200'>
                      <MdCheckCircle size={28} />
                    </div>
                  )}
                  <div className='relative overflow-hidden rounded-[18px] bg-white/62 p-3'>
                    {product.image ? (
                      <img
                        src={product.image}
                        alt={product.name}
                        className='h-36 w-full object-contain transition-transform duration-500 ease-out group-hover:scale-110'
                      />
                    ) : (
                      <div className='flex h-36 items-center justify-center rounded-[16px] bg-white/62 px-4 text-center'>
                        <span className='ios-body-muted font-semibold text-textPrimary'>Image unavailable</span>
                      </div>
                    )}
                  </div>

                  <div className='mt-4 min-w-0 flex-1'>
                    <p className={`ios-card-title truncate transition-colors duration-300 ${isSelected ? 'text-primary' : ''}`}>
                      {product.name}
                    </p>
                    <p className='ios-meta mt-1'>Tap to select this device</p>
                  </div>

                  <div className={`mt-4 rounded-[18px] px-3 py-2 transition-colors duration-300 ${isSelected ? 'bg-primary/10' : 'bg-white/62'}`}>
                    <p className={`ios-caption uppercase ${isSelected ? 'text-primary/70' : ''}`}>From</p>
                    <p className={`ios-price-inline mt-1 ${isSelected ? 'text-primary' : ''}`}>{formatPrice(fromPrice)}</p>
                  </div>
                </button>
              </SwiperSlide>
            )
          })}
        </Swiper>
      ) : null}
    </section>
  )
}

export default SwapProductCarousel
