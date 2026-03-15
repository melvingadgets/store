import React from 'react'
import { AiOutlinePlus } from 'react-icons/ai'
import { useDispatch } from 'react-redux'
import { useNavigate } from 'react-router-dom'
import { addItemToCart } from '../../features/cart/cartSlice'
import type { AppDispatch } from '../../redux/store'
import type { Product } from '../../types/domain'
import formatPrice from '../../utils/formatPrice'
import { notify } from '../../utils/notification'

interface ProductCardProps {
  product: Product
}

const ProductCard: React.FC<ProductCardProps> = ({ product }) => {
  const dispatch = useDispatch<AppDispatch>()
  const navigate = useNavigate()
  const displayImage = product.image
  const displayPrice = product.price

  const handleAddToCart = async () => {
    if (product.storageOptions && product.storageOptions.length > 0) {
      navigate(`/product/${product._id}`)
      return
    }

    try {
      await dispatch(addItemToCart({
        productId: product._id,
        name: product.name,
        price: product.price,
        image: product.image,
        availableQuantity: product.qty,
      })).unwrap()
      notify("success", "Item added successfully")
    } catch (error) {
      notify("error", error instanceof Error ? error.message : "Unable to add item to cart")
    }
  }

  const handleProductClick = () => {
    navigate(`/product/${product._id}`)
  }

  return (
    <article className='ios-card-soft overflow-hidden'>
      <button type="button" onClick={handleProductClick} className="relative h-40 w-full overflow-hidden rounded-[22px] bg-white/60 p-3">
        <span className="ios-pill absolute left-3 top-3 !px-2.5 !py-1 ios-caption uppercase">Store</span>
        {displayImage ? (
          <img src={displayImage} alt={product.name} className='h-full w-full object-contain' />
        ) : (
          <div className='flex h-full w-full items-center justify-center rounded-[18px] bg-white/48 px-4 text-center'>
            <span className='ios-meta font-semibold text-textPrimary'>Image unavailable</span>
          </div>
        )}
      </button>

      <div className="mt-3 px-1">
        <h3 className="ios-card-title line-clamp-2 min-h-[2.6rem] text-[1.02rem]">
          {product.name}
        </h3>
        {product.storageOptions && product.storageOptions.length > 0 && (
          <p className="ios-meta mt-1 line-clamp-2 min-h-[2.3rem]">
            {product.storageOptions.map((option) => option.capacity).join(" / ")}
          </p>
        )}
        <div className="mt-3 flex items-end justify-between gap-2">
          <span className="ios-price-inline max-w-[calc(100%-3.5rem)] break-words leading-tight">
            {product.storageOptions && product.storageOptions.length > 0
              ? `From ${formatPrice(displayPrice)}`
              : formatPrice(displayPrice)}
          </span>
          <button
            className="flex h-10 w-10 items-center justify-center rounded-full bg-white/70 text-primary shadow-[0_10px_20px_rgba(10,71,125,0.12)] transition duration-200 active:scale-[0.96]"
            onClick={handleAddToCart}
            aria-label={`Add ${product.name} to cart`}
          >
            <AiOutlinePlus size={20} />
          </button>
        </div>
      </div>
    </article>
  )
}

export default ProductCard
