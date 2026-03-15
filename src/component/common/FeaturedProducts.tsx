import React from 'react'
import { Link } from 'react-router-dom';
import { useGetProductsQuery } from '../../redux/shopApi';
import ProductCard from './ProductCard';

const FeaturedProducts: React.FC = () => {
  const { data: products = [] } = useGetProductsQuery()

  const featuredProducts = products.slice(0, 6)

  return (
    <section className='w-full pt-6'>
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h2 className='ios-section-title'>Featured products</h2>
          <p className="ios-body-muted mt-1">Fast picks with the newest catalog pricing.</p>
        </div>
        <Link to="/product" className='ios-pill ios-pill-active'>View all</Link>
      </div>

      <div className='flex space-x-3 overflow-x-auto scrollbar-hide scroll-smooth pb-2' style={{ WebkitOverflowScrolling: "touch" }}>
        {featuredProducts.map((product) => (
          <div key={product._id} className="min-w-[160px] flex-shrink-0">
            <ProductCard product={product} />
          </div>
        ))}
      </div>
    </section>
  )
}

export default FeaturedProducts
