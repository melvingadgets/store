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
        // Signed in through Melvin OS: the bridge holds the token in memory (the
        // axios resolver reads it), so it's deliberately NOT put in state — nothing
        // the token gets persisted by redux-persist. Only the user is reflected here.
        bridgeSessionEstablished: (state, action: PayloadAction<{user: User}>) =>{
            state.isAuthenticated = true
            state.user = action.payload.user
            state.token = null
            state.session = null
        },
        logoutSuccess: (state) =>{
            state.isAuthenticated= false
            state.user = null;
            state.token = null
            state.session = null
        }
    }
})
export const {loginSuccess, logoutSuccess, sessionUpdated, bridgeSessionEstablished} = authSlice.actions
export default authSlice.reducer
