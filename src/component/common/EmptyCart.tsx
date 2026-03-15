import React from 'react'
import { FiShoppingBag } from "react-icons/fi"
import { useNavigate } from 'react-router-dom'

const EmptyCart:React.FC = () => {
  const navigate = useNavigate()

  return (
    <div className="ios-card mx-auto max-w-sm text-center">
      <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full bg-white/60 text-primary shadow-[0_16px_32px_rgba(10,71,125,0.12)]">
        <FiShoppingBag size={44} />
      </div>
      <div className="my-5">
        <h1 className='text-2xl font-bold tracking-[-0.03em] text-textPrimary'>Your cart is empty.</h1>
        <p className='mt-2 text-sm leading-6 text-secondaryText'>Looks like you have not added anything yet. Start with the latest devices and accessories.</p>
      </div>
      <button onClick={()=> navigate("/product")} className='ios-primary-button w-full'>
        Shop now
      </button>
    </div>
  )
}

export default EmptyCart
