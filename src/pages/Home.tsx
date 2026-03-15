import React from 'react'
import { FaUserCircle } from 'react-icons/fa'
import { HiOutlineShoppingCart } from 'react-icons/hi'
import { useSelector } from 'react-redux'
import { useNavigate } from 'react-router-dom'
import CarouselHero from '../component/common/CarouselHero'
import CategoryGrid from '../component/common/Category'
import FeaturedProducts from '../component/common/FeaturedProducts'
import type { RootState } from '../redux/store'

const Home:React.FC = () => {
  const navigate = useNavigate()
  const cartItems = useSelector((state: RootState)=> state.cart.items)
  const totalQuantity = cartItems.reduce((total, item)=> total + item.quantity, 0)
  const {isAuthenticated} = useSelector((state: RootState)=>state.auth)

  const handleUserIconClick = ()=>{
    navigate(isAuthenticated ? "/account" : "/login")
  }

  return (
    <div className='ios-page'>
      <header className="ios-topbar">
        <div className="min-w-0 flex-1">
          <p className="ios-overline">Melvin Gadgets</p>
          <h1 className="ios-nav-title mt-1">Discover your next device.</h1>
        </div>

        <button type="button" className="ios-icon-button shrink-0" onClick={handleUserIconClick} aria-label="Open account">
          <FaUserCircle size={24} />
        </button>

        <button type="button" className="ios-icon-button relative shrink-0" onClick={()=>navigate("/cart")} aria-label="Open cart">
          <HiOutlineShoppingCart size={22} />
          <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-xs font-bold text-white">
            {totalQuantity}
          </span>
        </button>
      </header>

      <div className="space-y-1">
        <CarouselHero/>
        <CategoryGrid/>
        <FeaturedProducts/>
      </div>
    </div>
  )
}

export default Home
