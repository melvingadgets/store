import React, { useEffect } from 'react'
import { HiOutlineShoppingCart } from 'react-icons/hi'
import { MdDelete, MdOutlineArrowBack } from "react-icons/md"
import { useDispatch, useSelector } from 'react-redux'
import { useNavigate } from 'react-router-dom'
import EmptyCart from '../component/common/EmptyCart'
import { addItemToCart, decreaseQuantity, fetchCart, removeItemFromCart } from '../features/cart/cartSlice'
import type { AppDispatch, RootState } from '../redux/store'
import formatPrice from '../utils/formatPrice'
import { notify } from '../utils/notification'

const Cart:React.FC = () => {
  const navigate = useNavigate()
  const dispatch = useDispatch<AppDispatch>()
  const { items, status, bill } = useSelector((state: RootState)=> state.cart)
  const user = useSelector((state: RootState) => state.auth.user)

  useEffect(() => {
    if (user?._id) {
      void dispatch(fetchCart())
    }
  }, [dispatch, user?._id])

  const totalQuantity = items.reduce((total, item)=> total + item.quantity, 0)
  const displayBill = bill

  const handleAdd = async (item: RootState["cart"]["items"][number]) => {
    try {
      await dispatch(addItemToCart({
        productId: item.productId,
        name: item.name,
        price: item.price,
        image: item.image,
        capacity: item.capacity,
        availableQuantity: item.availableQuantity,
      })).unwrap()
    } catch (error) {
      notify("error", error instanceof Error ? error.message : "Unable to add item to cart")
    }
  }

  const handleDecrease = async (item: RootState["cart"]["items"][number]) => {
    try {
      await dispatch(
        decreaseQuantity({
          productId: item.productId,
          capacity: item.capacity,
        }),
      ).unwrap()
    } catch (error) {
      notify("error", error instanceof Error ? error.message : "Unable to update quantity")
    }
  }

  const handleRemove = async (item: RootState["cart"]["items"][number]) => {
    try {
      await dispatch(
        removeItemFromCart({
          productId: item.productId,
          capacity: item.capacity,
        }),
      ).unwrap()
      notify("success", "Item removed from cart")
    } catch (error) {
      notify("error", error instanceof Error ? error.message : "Unable to remove item from cart")
    }
  }

  return (
    <div className='ios-page pb-36'>
      <header className="ios-topbar">
        <button type="button" onClick={()=> navigate(-1)} className="ios-icon-button shrink-0" aria-label="Go back">
          <MdOutlineArrowBack size={22}/>
        </button>

        <div className="min-w-0 flex-1">
          <p className="ios-overline">Bag</p>
          <span className="ios-nav-title block">Your cart</span>
        </div>

        <div className="ios-icon-button relative shrink-0">
          <HiOutlineShoppingCart size={22} />
          <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-xs font-bold text-white">
              {totalQuantity}
          </span>
        </div>
      </header>

      {status === "loading" && items.length === 0 ? null : items.length === 0 ? (
        <div className="pt-10">
          <EmptyCart />
        </div>
      ) : (
        <div className="space-y-4">
          {items.map(item => (
            <div key={item.id} className="ios-card-soft flex items-center gap-3">
              <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-[22px] bg-white/58 p-3">
                {item.image ? (
                  <img
                    src={item.image}
                    alt={item.name}
                    className='h-full w-full object-contain'
                  />
                ) : (
                  <span className='ios-meta text-center font-semibold text-textPrimary'>No image</span>
                )}
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h4 className='ios-card-title truncate text-[1rem]'>{item.name}</h4>
                    {item.capacity && (
                      <p className='ios-meta mt-1'>{item.capacity}</p>
                    )}
                    <p className='ios-price-inline mt-2'>
                      {formatPrice(item.price * item.quantity)}
                    </p>
                  </div>

                  <button type="button" onClick={()=>void handleRemove(item)} className="ios-icon-button !h-9 !w-9 text-red-700" aria-label={`Remove ${item.name}`}>
                    <MdDelete size={18}/>
                  </button>
                </div>

                <div className="mt-4 flex items-center gap-3">
                  <button type="button" className='ios-secondary-button !h-10 !w-10 !rounded-full !px-0 !py-0 text-lg' onClick={()=> void handleDecrease(item)}>-</button>
                  <p className='min-w-6 text-center text-base font-bold text-textPrimary'>{item.quantity}</p>
                  <button type="button" className='ios-secondary-button !h-10 !w-10 !rounded-full !px-0 !py-0 text-lg' onClick={()=> void handleAdd(item)}>+</button>
                </div>
              </div>
            </div>
          ))}

          <div className="ios-card space-y-4">
            <div className="flex items-center justify-between gap-4">
              <p className="ios-section-title">Total</p>
              <p className="ios-price-inline text-[1.3rem]">{formatPrice(displayBill)}</p>
            </div>

            {!user?._id && (
              <p className='ios-body-muted'>
                Your cart stays local while you shop as a guest. You can continue to checkout now or sign in later.
              </p>
            )}

            <button onClick={()=> navigate("/checkout")} className="ios-primary-button flex w-full justify-center">
              Proceed to checkout
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default Cart
