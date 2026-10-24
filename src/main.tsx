import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import {RouterProvider} from "react-router-dom"
import { ToastContainer, Zoom } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import './index.css'
import { router } from './routes/AllRoutes';
import { Provider } from 'react-redux';
import { store, persistor } from './redux/store';
import { PersistGate } from 'redux-persist/integration/react';
import { setApiClientAuthTokenResolver } from './utils/axios';
import { MelvinBridge } from './component/common/MelvinBridge';
import { getMelvinBridgeToken, isEmbeddedInMelvin } from './lib/melvinBridge';

// Inside Melvin OS the session comes from the bridge (held in memory); otherwise
// it's the store's own token from redux.
setApiClientAuthTokenResolver(() =>
  (isEmbeddedInMelvin && getMelvinBridgeToken()) || store.getState().auth.token,
)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
   <Provider store={store}>
      <PersistGate loading={null} persistor={persistor}>
        <ToastContainer position='top-right' transition={Zoom} autoClose={2000}/>
        <MelvinBridge />
        <RouterProvider router={router}/>
      </PersistGate>
   </Provider>
  </StrictMode>,
)
