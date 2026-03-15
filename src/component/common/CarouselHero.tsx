import React from 'react'
import a from "../../assets/images/Phones-removebg-preview.png"
import { useNavigate } from 'react-router-dom'

const CarouselHero:React.FC = () => {
    const navigate = useNavigate()
  return (
    <div className='pt-2 text-white'>
        <div
          className="relative overflow-hidden rounded-[32px] px-5 py-6 text-white shadow-[0_26px_56px_rgba(10,71,125,0.24)]"
          style={{
            background:
              "linear-gradient(145deg, rgba(9,82,134,0.98) 0%, rgba(31,131,196,0.94) 48%, rgba(139,213,255,0.78) 100%)",
          }}
        >
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.45),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(173,222,255,0.32),transparent_24%)]" />
          <div className="absolute -right-10 top-4 h-48 w-48 rounded-full bg-white/10 blur-3xl" />
          <div className="absolute right-2 top-2 h-full w-[52%] bg-contain bg-right bg-no-repeat opacity-95" style={{ backgroundImage: `url(${a})` }} />

          <div className="relative z-10 max-w-[58%]">
            <span className="ios-pill border-white/20 bg-white/15 text-white/90">Spring picks</span>
            <h2 className='mt-4 text-[2.15rem] font-extrabold leading-[0.98] tracking-[-0.055em]'>Upgrade your everyday carry.</h2>
            <p className='mt-3 text-[0.97rem] font-medium leading-7 text-white/78'>Browse phones, accessories, and standout devices with a cleaner mobile shopping flow.</p>
            <button
              className='mt-5 rounded-full border border-white/35 bg-white/12 px-4 py-2 text-base font-bold text-white backdrop-blur-md transition duration-200 active:scale-[0.98]'
              onClick={()=> navigate("/product")}
            >
              Explore devices
            </button>
          </div>
        </div>
    </div>
  )
}

export default CarouselHero
