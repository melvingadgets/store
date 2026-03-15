import React from 'react'
import { HiOutlineShoppingCart } from 'react-icons/hi'
import { MdOutlineArrowBack } from 'react-icons/md'
import { useSelector } from 'react-redux'
import { useNavigate, useSearchParams } from 'react-router-dom'
import BlurLoadingContainer from '../component/common/BlurLoadingContainer'
import ProductCard from '../component/common/ProductCard'
import { useGetCategoriesQuery, useGetProductsQuery } from '../redux/shopApi'
import type { RootState } from '../redux/store'
import { getCategoryId } from '../utils/normalizers'

const Product:React.FC = () => {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const selectedCategoryId = searchParams.get("category") ?? ""
  const cartItems = useSelector((state: RootState)=> state.cart.items)
  const totalQuantity = cartItems.reduce((total, item)=> total + item.quantity, 0)
  const { data: products = [], isLoading: productsLoading } = useGetProductsQuery()
  const { data: categories = [] } = useGetCategoriesQuery()
  const selectedCategory = categories.find((category) => category._id === selectedCategoryId) ?? null

  const filteredProducts = selectedCategoryId
    ? products.filter((product) => getCategoryId(product.category) === selectedCategoryId)
    : products
  const loading = productsLoading && products.length === 0

  return (
    <BlurLoadingContainer loading={loading} minDurationMs={150}>
      <div className='ios-page'>
        <header className="ios-topbar">
          <button type="button" onClick={()=> navigate(-1)} className="ios-icon-button shrink-0" aria-label="Go back">
            <MdOutlineArrowBack size={22}/>
          </button>

          <div className="min-w-0 flex-1">
            <p className="ios-overline">Browse</p>
            <span className="ios-nav-title block truncate">
              {selectedCategory?.name ?? "All products"}
            </span>
          </div>

          <button type="button" className="ios-icon-button relative shrink-0" onClick={() => navigate("/cart")} aria-label="Open cart">
            <HiOutlineShoppingCart size={22} />
            <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-xs font-bold text-white">
              {totalQuantity}
            </span>
          </button>
        </header>

        <div className="space-y-4">
          <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
            <button
              type="button"
              onClick={() => setSearchParams({})}
              className={`ios-pill whitespace-nowrap ${!selectedCategoryId ? 'ios-pill-active' : ''}`}
            >
              All
            </button>
            {categories.map((category) => (
              <button
                key={category._id}
                type="button"
                onClick={() => setSearchParams({ category: category._id })}
                className={`ios-pill whitespace-nowrap ${selectedCategoryId === category._id ? 'ios-pill-active' : ''}`}
              >
                {category.name}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {filteredProducts.map((item) => (
              <span key={item._id}>
                <ProductCard product={item} />
              </span>
            ))}
          </div>

          {!productsLoading && filteredProducts.length === 0 && (
            <div className="ios-card ios-body-muted text-center">
              No products are available for this category yet.
            </div>
          )}
        </div>
      </div>
    </BlurLoadingContainer>
  )
}

export default Product
