import React, { useState } from 'react'
import BlurLoadingContainer from '../component/common/BlurLoadingContainer'
import { MdOutlineArrowBack } from 'react-icons/md'
import { useSelector } from 'react-redux'
import { Link, useNavigate } from 'react-router-dom'
import { useGetOrdersQuery } from '../redux/shopApi'
import type { RootState } from '../redux/store'
import { buildOrderConfirmQuery, canPayOrder, resolveOrderDisplayAmount } from '../lib/paymentState'
import { initializePaystackPayment } from '../services/paymentService'
import type { OrderRecord } from '../types/domain'
import { extractErrorMessage } from '../utils/axios'
import formatPrice from '../utils/formatPrice'
import { notify } from '../utils/notification'
import { launchPaystackCheckout } from '../utils/paystackCheckout'

const History = () => {
  const navigate = useNavigate()
  const user = useSelector((state: RootState) => state.auth.user)
  const [payingOrderId, setPayingOrderId] = useState<string | null>(null)
  const {
    data: orders = [],
    isLoading,
    isError,
  } = useGetOrdersQuery(undefined, { skip: !user?._id })

  const getStatusColor = (statusValue: string) => {
    switch (statusValue) {
      case "created":
        return "text-yellow-600"
      case "processing":
        return "text-blue-600"
      case "completed":
        return "text-green-600"
      case "cancelled":
        return "text-red-600"
      default:
        return "text-gray-600"
    }
  }

  const handlePayOrder = async (order: OrderRecord) => {
    setPayingOrderId(order._id)
    try {
      const response = await initializePaystackPayment({
        orderId: order._id,
        checkoutType: "user",
        paymentReference: order.paymentReference,
        redirectUrl: `${window.location.origin}/orderconfirm`,
      })
      const initData = response.data.data
      const launchMode = await launchPaystackCheckout(initData, {
        onInlineSuccess: ({ reference }) => {
          navigate(buildOrderConfirmQuery({ reference, status: "success" }))
        },
        onInlineCancel: () => {
          notify("warning", "Payment cancelled")
        },
      })

      if (launchMode === "popup") {
        notify("info", "Complete payment in the Paystack tab, then verify")
        navigate(buildOrderConfirmQuery({ reference: initData.reference, pending: true }))
      }
    } catch (error) {
      notify("error", extractErrorMessage(error))
    } finally {
      setPayingOrderId(null)
    }
  }

  if (!user?._id) {
    return (
      <div className='ios-mobile-shell flex min-h-screen items-center justify-center px-4'>
        <div className='ios-card max-w-sm text-center'>
          <p className='text-lg font-bold text-primaryText'>Order history is linked to your account.</p>
          <p className='ios-body-muted mt-2'>Log in to view your placed orders.</p>
          <Link to="/login" className='ios-primary-button mt-5 inline-flex'>Go to login</Link>
        </div>
      </div>
    )
  }

  return (
    <div className='ios-mobile-shell'>
      <BlurLoadingContainer loading={isLoading} minDurationMs={150}>
        <div className="ios-page-tight">
          <header className="ios-topbar">
            <button type="button" onClick={() => navigate(-1)} className="ios-icon-button shrink-0" aria-label="Go back">
              <MdOutlineArrowBack size={22} />
            </button>

            <div className="min-w-0 flex-1">
              <p className="ios-overline">Orders</p>
              <span className="ios-nav-title block">Order history</span>
            </div>
            <div className="w-11 shrink-0" />
          </header>

          <div className="space-y-4">
            {!isLoading && !isError && orders.length === 0 && (
              <div className="ios-card ios-body-muted text-center">
                You have not placed any orders yet.
              </div>
            )}

            {isError && !isLoading && (
              <div className="ios-card ios-body-muted text-center">
                Unable to load your orders right now.
              </div>
            )}

            {orders.map((order) => {
              const displayAmount = resolveOrderDisplayAmount(order)
              const canPay = canPayOrder(order)

              return (
                <div className="ios-card-soft flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between" key={order._id}>
                  <div className="min-w-0">
                    <p className='ios-card-title'>#{order._id.slice(-6).toUpperCase()}</p>
                    <p className={`mt-1 text-base font-bold ${getStatusColor(order.orderStatus)}`}>{order.orderStatus}</p>
                    <p className={`ios-meta mt-1 font-semibold ${order.paymentStatus === "paid" ? "text-emerald-700" : "text-amber-700"}`}>
                      Payment: {order.paymentStatus}
                    </p>
                  </div>
                  <div className='flex flex-col gap-2 sm:items-end sm:text-right'>
                    <p className='ios-price-inline break-words'>
                      {formatPrice(displayAmount)}
                    </p>
                    <p className="ios-meta break-words">
                      {order.createdAt ? new Date(order.createdAt).toLocaleString() : "Recently created"}
                    </p>
                    {canPay && (
                      <button
                        type="button"
                        onClick={() => void handlePayOrder(order)}
                        disabled={payingOrderId === order._id}
                        className="ios-primary-button px-4 py-2 text-sm disabled:opacity-70"
                      >
                        {payingOrderId === order._id ? "Opening..." : "Pay now"}
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </BlurLoadingContainer>
    </div>
  )
}

export default History
