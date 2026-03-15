import React from 'react'
import { FaCheckCircle } from 'react-icons/fa'
import { useSelector } from 'react-redux'
import { useNavigate } from 'react-router-dom'
import type { RootState } from '../redux/store'
import formatPrice from '../utils/formatPrice'

const OrderConfirmation: React.FC = () => {
  const navigate = useNavigate()
  const lastOrder = useSelector((state: RootState) => state.cart.lastOrder)
  const user = useSelector((state: RootState) => state.auth.user)
  const displayAmount = lastOrder?.bill ?? 0

  return (
    <div className="ios-mobile-shell flex min-h-screen items-center justify-center px-4">
      <div className="ios-card w-full max-w-sm text-center">
        <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full bg-emerald-100/80 text-emerald-600 shadow-[0_16px_32px_rgba(16,185,129,0.12)]">
          <FaCheckCircle size={54} />
        </div>

        <h2 className="ios-page-title mt-5 text-[2.15rem]">Thank you for your order.</h2>
        <p className="ios-body-muted mt-3">
          Your order has been created successfully.
        </p>

        {lastOrder && (
          <div className="mt-5 rounded-[24px] bg-white/54 p-4 text-left shadow-[0_12px_24px_rgba(17,33,62,0.08)]">
            <p className="ios-caption uppercase">Order ID</p>
            <p className="ios-card-title mt-1">#{lastOrder._id.slice(-6).toUpperCase()}</p>
            <p className="ios-caption mt-4 uppercase">Amount</p>
            <p className="ios-price mt-2">{formatPrice(displayAmount)}</p>
          </div>
        )}

        <div className="mt-6 space-y-3">
          {user?._id && (
            <button
              onClick={() => navigate('/history')}
              className="ios-primary-button flex w-full justify-center"
            >
              View orders
            </button>
          )}
          <button
            onClick={() => navigate('/product')}
            className="ios-secondary-button flex w-full justify-center"
          >
            Continue shopping
          </button>
        </div>
      </div>
    </div>
  )
}

export default OrderConfirmation
