import React, { useEffect, useState } from 'react'
import { RxCross2 } from "react-icons/rx"
import { MdOutlineArrowBack } from 'react-icons/md'
import { useDispatch, useSelector } from 'react-redux'
import { useNavigate } from 'react-router-dom'
import { checkoutCart, checkoutGuestCart, fetchCart } from '../features/cart/cartSlice'
import type { AppDispatch, RootState } from '../redux/store'
import type { GuestCheckoutGuest } from '../types/domain'
import formatPrice from '../utils/formatPrice'
import { notify } from '../utils/notification'

const initialGuestForm: GuestCheckoutGuest = {
  fullName: "",
  email: "",
  whatsappPhoneNumber: "",
  callPhoneNumber: "",
  address: "",
  state: "",
}

const Checkout:React.FC = () => {
  const navigate = useNavigate()
  const dispatch = useDispatch<AppDispatch>()
  const { items, checkoutStatus, bill } = useSelector((state: RootState)=> state.cart)
  const user = useSelector((state: RootState) => state.auth.user)
  const [guestForm, setGuestForm] = useState<GuestCheckoutGuest>(initialGuestForm)
  const displayBill = bill

  useEffect(() => {
    if (user?._id) {
      void dispatch(fetchCart())
    }
  }, [dispatch, user?._id])

  const handleGuestChange = (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = event.target
    setGuestForm((current) => ({
      ...current,
      [name]: value,
    }))
  }

  const validateGuestForm = () => {
    if (!guestForm.fullName || !guestForm.email || !guestForm.whatsappPhoneNumber || !guestForm.address || !guestForm.state) {
      notify("warning", "Please complete all required guest checkout fields")
      return false
    }

    return true
  }

  const handleOrderConfirmation = async () => {
    if (items.length === 0) {
      notify("warning", "Your cart is empty")
      return
    }

    try {
      if (user?._id) {
        await dispatch(checkoutCart()).unwrap()
      } else {
        if (!validateGuestForm()) {
          return
        }

        await dispatch(checkoutGuestCart(guestForm)).unwrap()
      }

      notify("success", "Order placed successfully")
      navigate("/orderconfirm")
    } catch (error) {
      notify("error", error instanceof Error ? error.message : "Unable to place your order")
    }
  }

  return (
    <div className='ios-mobile-shell'>
      <div className="ios-page-tight pb-10">
        <header className="ios-topbar">
          <button type="button" onClick={()=> navigate(-1)} className="ios-icon-button shrink-0" aria-label="Go back">
            <MdOutlineArrowBack size={22}/>
          </button>
          <div className="min-w-0 flex-1">
            <p className="ios-overline">Checkout</p>
            <span className="ios-nav-title block">Complete your order</span>
          </div>
          <div className="w-11 shrink-0" />
        </header>

        <div className="space-y-4">
          {!user?._id && (
            <section className="ios-card space-y-4">
              <div>
                <p className='ios-section-title'>Guest details</p>
                <p className='ios-body-muted mt-1'>We only need the essentials to process your order.</p>
              </div>

              <div className="grid grid-cols-1 gap-3">
                <input
                  name="fullName"
                  value={guestForm.fullName}
                  onChange={handleGuestChange}
                  placeholder="Full name"
                  className="ios-input"
                />
                <input
                  name="email"
                  type="email"
                  value={guestForm.email}
                  onChange={handleGuestChange}
                  placeholder="Email"
                  className="ios-input"
                />
                <input
                  name="whatsappPhoneNumber"
                  value={guestForm.whatsappPhoneNumber}
                  onChange={handleGuestChange}
                  placeholder="WhatsApp phone number"
                  className="ios-input"
                />
                <input
                  name="callPhoneNumber"
                  value={guestForm.callPhoneNumber ?? ""}
                  onChange={handleGuestChange}
                  placeholder="Call number (optional)"
                  className="ios-input"
                />
                <textarea
                  name="address"
                  value={guestForm.address}
                  onChange={handleGuestChange}
                  placeholder="Address"
                  rows={3}
                  className="ios-input resize-none"
                />
                <input
                  name="state"
                  value={guestForm.state}
                  onChange={handleGuestChange}
                  placeholder="State"
                  className="ios-input"
                />
              </div>
            </section>
          )}

          <section className="ios-card space-y-4">
            <div className="flex flex-col gap-2 border-b border-slate-200/40 pb-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className='ios-section-title'>Order summary</p>
                <p className='ios-meta mt-1'>{items.length} line items</p>
              </div>
              <p className='ios-price-inline break-words text-[1.18rem] sm:text-[1.28rem]'>{formatPrice(displayBill)}</p>
            </div>

            <div className="space-y-3">
              {items.map(item => (
                <div key={item.id} className="flex flex-col gap-2 rounded-[22px] bg-white/48 px-4 py-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <p className='ios-card-title'>{item.name}</p>
                    {item.capacity && (
                      <p className='ios-meta mt-1'>{item.capacity}</p>
                    )}
                  </div>
                  <p className='flex items-center gap-1 text-base font-bold text-textPrimary sm:whitespace-nowrap'>
                    {item.quantity} <RxCross2 /> {formatPrice(item.price * item.quantity)}
                  </p>
                </div>
              ))}
            </div>
          </section>

          <button
            onClick={() => void handleOrderConfirmation()}
            disabled={checkoutStatus === "loading"}
            className="ios-primary-button flex w-full justify-center disabled:opacity-70"
          >
            {checkoutStatus === "loading" ? "Processing order" : user?._id ? "Confirm order" : "Place guest order"}
          </button>
        </div>
      </div>
    </div>
  )
}

export default Checkout
