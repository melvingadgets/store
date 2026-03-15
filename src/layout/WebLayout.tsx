import React, { useEffect } from 'react'
import { useDispatch, useSelector } from 'react-redux';
import { Outlet } from 'react-router-dom';
import Footer from '../component/block/Footer';
import { fetchCart } from '../features/cart/cartSlice';
import type { AppDispatch, RootState } from '../redux/store';
const WebLayout:React.FC = () => {
    const dispatch = useDispatch<AppDispatch>()
    const user = useSelector((state: RootState) => state.auth.user)

    useEffect(() => {
        if (user?._id) {
            void dispatch(fetchCart())
        }
    }, [dispatch, user?._id])

    return (
      <div className='ios-mobile-shell'>
          <div className="mx-auto max-w-screen-md">
              <Outlet/>
          </div>
          <Footer/>
      </div>
    )

}
export default WebLayout
