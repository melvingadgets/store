import React, { useCallback, useEffect, useState } from 'react'
import { FaCheckCircle, FaClock, FaExclamationCircle } from 'react-icons/fa'
import { useDispatch, useSelector } from 'react-redux'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { updateLastOrderPayment } from '../features/cart/cartSlice'
import {
  buildOrderConfirmQuery,
  canPayOrder,
  resolveOrderCheckoutType,
  resolveOrderDisplayAmount,
} from '../lib/paymentState'
import { shopApi } from '../redux/shopApi'
import type { AppDispatch, RootState } from '../redux/store'
import {
  initializePaystackPayment,
  verifyPaystackPayment,
  type VerifiedOrderPayment,
} from '../services/paymentService'
import { extractErrorMessage } from '../utils/axios'
import formatPrice from '../utils/formatPrice'
import { notify } from '../utils/notification'
import { launchPaystackCheckout } from '../utils/paystackCheckout'

const OrderConfirmation: React.FC = () => {
  const navigate = useNavigate()
  const dispatch = useDispatch<AppDispatch>()
  const [searchParams] = useSearchParams()
  const lastOrder = useSelector((state: RootState) => state.cart.lastOrder)
  const user = useSelector((state: RootState) => state.auth.user)

  const referenceParam = (searchParams.get('reference') ?? searchParams.get('trxref') ?? '').trim()
  const statusParam = (searchParams.get('status') ?? '').trim().toLowerCase()

  const [verifiedOrder, setVerifiedOrder] = useState<VerifiedOrderPayment | null>(null)
  const [verifying, setVerifying] = useState(false)
  const [verifyError, setVerifyError] = useState<string | null>(null)
  const [retryingPayment, setRetryingPayment] = useState(false)

  const runVerification = useCallback(async (reference: string) => {
    if (!reference) {
      return
    }

    setVerifying(true)
    setVerifyError(null)
    try {
      const response = await verifyPaystackPayment({ reference })
      const verified = response.data.data
      setVerifiedOrder(verified)
      dispatch(updateLastOrderPayment({
        orderId: verified._id,
        paymentStatus: verified.paymentStatus,
        orderStatus: verified.orderStatus,
        paymentReference: verified.paymentReference,
        paystackReference: verified.paystackReference,
        paidAt: verified.paidAt,
      }))
      dispatch(shopApi.util.invalidateTags([{ type: 'Orders', id: 'LIST' }]))
    } catch (error) {
      setVerifyError(extractErrorMessage(error))
    } finally {
      setVerifying(false)
    }
  }, [dispatch])

  useEffect(() => {
    if (!referenceParam || statusParam === 'cancelled') {
      return
    }
    void runVerification(referenceParam)
  }, [referenceParam, runVerification, statusParam])

  const effectiveOrderId = verifiedOrder?._id ?? lastOrder?._id ?? ''
  const effectivePaymentStatus = verifiedOrder?.paymentStatus ?? lastOrder?.paymentStatus ?? 'pending'
  const effectiveOrderStatus = verifiedOrder?.orderStatus ?? lastOrder?.orderStatus ?? 'created'
  const effectiveReference = verifiedOrder?.paystackReference ?? verifiedOrder?.paymentReference ?? lastOrder?.paystackReference ?? lastOrder?.paymentReference ?? referenceParam
  const displayAmount = verifiedOrder
    ? resolveOrderDisplayAmount(verifiedOrder)
    : resolveOrderDisplayAmount(lastOrder)

  const canRetryPayment = Boolean(
    lastOrder?._id &&
    canPayOrder({ paymentStatus: effectivePaymentStatus, orderStatus: effectiveOrderStatus }),
  )

  const handleRetryPayment = async () => {
    if (!lastOrder?._id) {
      return
    }

    setRetryingPayment(true)
    try {
      const checkoutType = resolveOrderCheckoutType(lastOrder)
      const initResponse = await initializePaystackPayment({
        orderId: lastOrder._id,
        checkoutType,
        paymentReference: lastOrder.paymentReference,
        redirectUrl: `${window.location.origin}/orderconfirm`,
      })
      const initData = initResponse.data.data
      const launchMode = await launchPaystackCheckout(initData, {
        onInlineSuccess: ({ reference }) => {
          navigate(buildOrderConfirmQuery({ reference, status: 'success' }), { replace: true })
          void runVerification(reference)
        },
        onInlineCancel: () => {
          notify('warning', 'Payment window closed before completion')
        },
      })

      if (launchMode === 'popup') {
        notify('info', 'Complete payment in the Paystack tab, then tap Verify payment')
      }
    } catch (error) {
      notify('error', extractErrorMessage(error))
    } finally {
      setRetryingPayment(false)
    }
  }

  const isPaid = effectivePaymentStatus === 'paid'
  const isCancelled = statusParam === 'cancelled' && !isPaid

  return (
    <div className="ios-mobile-shell flex min-h-screen items-center justify-center px-4 py-8">
      <div className="ios-card w-full max-w-sm text-center">
        {verifying ? (
          <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full bg-blue-100/80 text-primary shadow-[0_16px_32px_rgba(5,103,171,0.12)]">
            <FaClock size={46} />
          </div>
        ) : isPaid ? (
          <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full bg-emerald-100/80 text-emerald-600 shadow-[0_16px_32px_rgba(16,185,129,0.12)]">
            <FaCheckCircle size={54} />
          </div>
        ) : (
          <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full bg-amber-100/80 text-amber-600 shadow-[0_16px_32px_rgba(245,158,11,0.12)]">
            <FaExclamationCircle size={48} />
          </div>
        )}

        <h2 className="ios-page-title mt-5 text-[2.05rem]">
          {verifying
            ? 'Verifying payment...'
            : isPaid
              ? 'Payment confirmed.'
              : isCancelled
                ? 'Payment cancelled.'
                : 'Order awaiting payment.'}
        </h2>
        <p className="ios-body-muted mt-3">
          {verifying
            ? 'We are confirming your transaction with Paystack.'
            : isPaid
              ? 'Your order has been paid and is now being processed.'
              : verifyError
                ? verifyError
                : isCancelled
                  ? 'Your order is reserved. You can complete payment whenever you are ready.'
                  : 'Complete your Paystack payment to confirm and process this order.'}
        </p>

        {(effectiveOrderId || effectiveReference) && (
          <div className="mt-5 rounded-[24px] bg-white/54 p-4 text-left shadow-[0_12px_24px_rgba(17,33,62,0.08)]">
            {effectiveOrderId && (
              <>
                <p className="ios-caption uppercase">Order ID</p>
                <p className="ios-card-title mt-1">#{effectiveOrderId.slice(-6).toUpperCase()}</p>
              </>
            )}
            <p className={`ios-caption uppercase ${effectiveOrderId ? 'mt-4' : ''}`}>Payment status</p>
            <p className={`mt-1 text-sm font-bold uppercase ${isPaid ? 'text-emerald-700' : 'text-amber-700'}`}>
              {effectivePaymentStatus}
            </p>
            {displayAmount > 0 && (
              <>
                <p className="ios-caption mt-4 uppercase">Amount</p>
                <p className="ios-price mt-2">{formatPrice(displayAmount)}</p>
              </>
            )}
            {effectiveReference && (
              <>
                <p className="ios-caption mt-4 uppercase">Reference</p>
                <p className="ios-meta mt-1 break-all font-mono">{effectiveReference}</p>
              </>
            )}
          </div>
        )}

        <div className="mt-6 space-y-3">
          {!verifying && !isPaid && referenceParam && (
            <button
              type="button"
              onClick={() => void runVerification(referenceParam)}
              className="ios-secondary-button flex w-full justify-center"
            >
              Verify payment
            </button>
          )}
          {!verifying && canRetryPayment && (
            <button
              type="button"
              onClick={() => void handleRetryPayment()}
              disabled={retryingPayment}
              className="ios-primary-button flex w-full justify-center disabled:opacity-70"
            >
              {retryingPayment ? 'Opening Paystack...' : 'Pay with Paystack'}
            </button>
          )}
          {user?._id && (
            <button
              type="button"
              onClick={() => navigate('/history')}
              className={isPaid || !canRetryPayment ? 'ios-primary-button flex w-full justify-center' : 'ios-secondary-button flex w-full justify-center'}
            >
              View orders
            </button>
          )}
          <button
            type="button"
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
