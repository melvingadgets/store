import { useFormik } from 'formik'
import React from 'react'
import { MdArrowForward, MdLockOutline, MdMailOutline, MdOutlineArrowBack } from 'react-icons/md'
import { Link, useNavigate } from 'react-router-dom'
import * as Yup from "yup"
import { useDispatch } from 'react-redux'
import { loginSuccess } from '../features/auth/authSlice'
import type { AppDispatch } from '../redux/store'
import apiClient, { handleError } from '../utils/axios'
import { notify } from '../utils/notification'
import { buildUserSessionClientContext } from '../utils/userSessionTelemetry'

const Login:React.FC = () => {
  const navigate = useNavigate()
  const dispatch = useDispatch<AppDispatch>()

  const formik = useFormik({
    initialValues: {
      email: "",
      password: "",
      rememberMe: false,
    },
    validationSchema: Yup.object({
      email: Yup.string()
        .email("Invalid email address")
        .required("Email is required"),
      password: Yup.string()
        .min(6, "Password must be at least 6 characters")
        .required("Password is required"),
    }),
    onSubmit: async (values, {setSubmitting}) =>{
      setSubmitting(true)
      try{
        const response = await apiClient.post("/login", {
          ...values,
          clientContext: buildUserSessionClientContext(),
        })
        const { token, user, session } = response.data.data
        dispatch(loginSuccess({user, token, session}))
        notify("success", response.data.message)
        navigate("/")
      }catch(error){
        handleError(error)
      }finally{
        setSubmitting(false)
      }
    }
  })

  return (
    <div className='ios-mobile-shell min-h-screen px-4 py-4'>
      <div className="ios-page-tight flex min-h-screen flex-col justify-between pb-8">
        <div>
          <header className="ios-topbar">
            <button type="button" onClick={() => navigate(-1)} className="ios-icon-button shrink-0" aria-label="Go back">
              <MdOutlineArrowBack size={22} />
            </button>
            <div className="min-w-0 flex-1">
              <p className="ios-overline">Access</p>
              <span className="ios-nav-title block">Sign in</span>
            </div>
            <div className="w-11 shrink-0" />
          </header>

          <section className="ios-card mt-6 overflow-hidden px-5 py-6">
            <div className="rounded-[28px] bg-[linear-gradient(145deg,rgba(7,53,88,0.98)_0%,rgba(24,124,188,0.92)_52%,rgba(178,224,255,0.74)_100%)] px-5 py-6 text-white shadow-[0_24px_56px_rgba(10,71,125,0.2)]">
              <p className="ios-overline text-white/75">Melvin Gadgets</p>
              <h1 className='ios-page-title mt-3 text-white'>Welcome back.</h1>
              <p className='mt-3 max-w-xs text-[0.97rem] font-medium leading-7 text-white/78'>Continue with your account to manage orders, account details, and checkout faster.</p>
            </div>

            <form onSubmit={formik.handleSubmit} className='mt-5 space-y-4'>
              <label className="block">
                <span className="ios-meta mb-2 flex items-center gap-2 font-semibold text-textPrimary">
                  <MdMailOutline size={18} className="text-primary" />
                  Email
                </span>
                <input
                  id="email"
                  type="email"
                  className="ios-input"
                  placeholder="you@example.com"
                  {...formik.getFieldProps("email")}
                />
                {formik.touched.email && formik.errors.email && (
                  <p className="ios-meta mt-2 text-red-600">{formik.errors.email}</p>
                )}
              </label>

              <label className="block">
                <span className="ios-meta mb-2 flex items-center gap-2 font-semibold text-textPrimary">
                  <MdLockOutline size={18} className="text-primary" />
                  Password
                </span>
                <input
                  id="password"
                  type="password"
                  className="ios-input"
                  placeholder="Enter your password"
                  {...formik.getFieldProps("password")}
                />
                {formik.touched.password && formik.errors.password && (
                  <p className="ios-meta mt-2 text-red-600">{formik.errors.password}</p>
                )}
              </label>

              <label className="flex items-center gap-3 rounded-[22px] bg-white/48 px-4 py-3 text-[0.96rem] font-medium text-textPrimary">
                <input
                  id="rememberMe"
                  type="checkbox"
                  className="h-4 w-4 accent-primary"
                  {...formik.getFieldProps("rememberMe")}
                  checked={formik.values.rememberMe}
                />
                Remember me on this device
              </label>

              <button
                type="submit"
                disabled={formik.isSubmitting}
                className="ios-primary-button flex w-full items-center justify-center gap-2 disabled:opacity-70"
              >
                {formik.isSubmitting ? "Signing in..." : "Log in"}
                {!formik.isSubmitting && <MdArrowForward size={18} />}
              </button>
            </form>
          </section>
        </div>

        <div className="ios-meta pb-4 pt-6 text-center">
          Don&apos;t have an account?
          <Link to="/register" className="ml-1 font-bold text-primary">
            Register
          </Link>
        </div>
      </div>
    </div>
  )
}

export default Login
