import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import type { User } from "../../types/domain";

interface Authstate{
    isAuthenticated: boolean;
    user: User | null;
    token: string | null;
}

const initialState: Authstate ={
    isAuthenticated: false,
    user: null,
    token: null,
}

export const authSlice = createSlice({
    name: "auth",
    initialState,
    reducers: {
        loginSuccess: (state, action: PayloadAction<{user: User; token: string}>) =>{
            state.isAuthenticated = true;
            state.user = action.payload.user
            state.token = action.payload.token
        },
        logoutSuccess: (state) =>{
            state.isAuthenticated= false
            state.user = null;
            state.token = null
        }
    }
})
export const {loginSuccess, logoutSuccess} = authSlice.actions
export default authSlice.reducer
