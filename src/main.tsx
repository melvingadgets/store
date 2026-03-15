import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import {RouterProvider} from "react-router-dom"
import { ToastContainer, Zoom } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import './index.css'
import { router } from './routes/AllRoutes';
import { Provider } from 'react-redux';
import { store } from './redux/store';
import { setApiClientAuthTokenResolver } from './utils/axios';

setApiClientAuthTokenResolver(() => store.getState().auth.token)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
   <Provider store={store}>
      <ToastContainer position='top-right' transition={Zoom} autoClose={2000}/>
      <RouterProvider router={router}/>
   </Provider>
  </StrictMode>,
)
