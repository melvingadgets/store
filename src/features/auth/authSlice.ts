import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import type { User, UserSessionRecord } from "../../types/domain";

interface Authstate{
    isAuthenticated: boolean;
    user: User | null;
    token: string | null;
    session: UserSessionRecord | null;
}

const initialState: Authstate ={
    isAuthenticated: false,
    user: null,
    token: null,
    session: null,
}

export const authSlice = createSlice({
    name: "auth",
    initialState,
    reducers: {
        loginSuccess: (state, action: PayloadAction<{user: User; token: string; session: UserSessionRecord}>) =>{
            state.isAuthenticated = true;
            state.user = action.payload.user
            state.token = action.payload.token
            state.session = action.payload.session
        },
        sessionUpdated: (state, action: PayloadAction<UserSessionRecord>) => {
            state.session = action.payload
        },
        logoutSuccess: (state) =>{
            state.isAuthenticated= false
            state.user = null;
            state.token = null
            state.session = null
        }
    }
})
export const {loginSuccess, logoutSuccess, sessionUpdated} = authSlice.actions
export default authSlice.reducer
