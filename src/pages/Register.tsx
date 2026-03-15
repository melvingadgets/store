import { useFormik } from 'formik'
import React from 'react'
import { MdArrowForward, MdLockOutline, MdMailOutline, MdOutlineArrowBack, MdPersonOutline } from 'react-icons/md'
import { Link, useNavigate } from 'react-router-dom'
import * as Yup from "yup"
import apiClient, { handleError } from '../utils/axios'
import { notify } from '../utils/notification'

const Register:React.FC = () => {
  const navigate = useNavigate()

  const formik = useFormik({
    initialValues: {
      firstName: "",
      lastName: "",
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
      firstName: Yup.string().required("First Name is required"),
      lastName: Yup.string().required("Last Name is required"),
    }),
    onSubmit: async (values, {setSubmitting}) =>{
      setSubmitting(true)
      try{
        const response = await apiClient.post("/register", {
          firstName: values.firstName,
          lastName: values.lastName,
          email: values.email,
          password: values.password,
        })
        notify("success", response.data.message)
        if(response.status === 201){
          navigate("/login")
        }

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
              <span className="ios-nav-title block">Create account</span>
            </div>
            <div className="w-11 shrink-0" />
          </header>

          <section className="ios-card mt-6 overflow-hidden px-5 py-6">
            <div className="rounded-[28px] bg-[linear-gradient(145deg,rgba(16,37,62,0.98)_0%,rgba(9,82,134,0.92)_46%,rgba(185,228,255,0.74)_100%)] px-5 py-6 text-white shadow-[0_24px_56px_rgba(10,71,125,0.2)]">
              <p className="ios-overline text-white/75">New member</p>
              <h1 className='ios-page-title mt-3 text-white'>Join Melvin Gadgets.</h1>
              <p className='mt-3 max-w-xs text-[0.97rem] font-medium leading-7 text-white/78'>Create your account to save order history, manage details, and move through checkout faster.</p>
            </div>

            <form onSubmit={formik.handleSubmit} className='mt-5 space-y-4'>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="ios-meta mb-2 flex items-center gap-2 font-semibold text-textPrimary">
                    <MdPersonOutline size={18} className="text-primary" />
                    First name
                  </span>
                  <input
                    id="firstName"
                    name="firstName"
                    type="text"
                    className="ios-input"
                    placeholder="First name"
                    onChange={formik.handleChange}
                    onBlur={formik.handleBlur}
                    value={formik.values.firstName}
                  />
                  {formik.touched.firstName && formik.errors.firstName && (
                    <p className="ios-meta mt-2 text-red-600">{formik.errors.firstName}</p>
                  )}
                </label>

                <label className="block">
                  <span className="ios-meta mb-2 flex items-center gap-2 font-semibold text-textPrimary">
                    <MdPersonOutline size={18} className="text-primary" />
                    Last name
                  </span>
                  <input
                    id="lastName"
                    name="lastName"
                    type="text"
                    className="ios-input"
                    placeholder="Last name"
                    onChange={formik.handleChange}
                    onBlur={formik.handleBlur}
                    value={formik.values.lastName}
                  />
                  {formik.touched.lastName && formik.errors.lastName && (
                    <p className="ios-meta mt-2 text-red-600">{formik.errors.lastName}</p>
                  )}
                </label>
              </div>

              <label className="block">
                <span className="ios-meta mb-2 flex items-center gap-2 font-semibold text-textPrimary">
                  <MdMailOutline size={18} className="text-primary" />
                  Email
                </span>
                <input
                  id="email"
                  name="email"
                  type="email"
                  className="ios-input"
                  placeholder="you@example.com"
                  onChange={formik.handleChange}
                  onBlur={formik.handleBlur}
                  value={formik.values.email}
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
                  name="password"
                  type="password"
                  className="ios-input"
                  placeholder="Create a password"
                  onChange={formik.handleChange}
                  onBlur={formik.handleBlur}
                  value={formik.values.password}
                />
                {formik.touched.password && formik.errors.password && (
                  <p className="ios-meta mt-2 text-red-600">{formik.errors.password}</p>
                )}
              </label>

              <button
                type="submit"
                disabled={formik.isSubmitting}
                className="ios-primary-button flex w-full items-center justify-center gap-2 disabled:opacity-70"
              >
                {formik.isSubmitting ? "Creating account..." : "Register"}
                {!formik.isSubmitting && <MdArrowForward size={18} />}
              </button>
            </form>
          </section>
        </div>

        <div className="ios-meta pb-4 pt-6 text-center">
          Already have an account?
          <Link to="/login" className="ml-1 font-bold text-primary">
            Login
          </Link>
        </div>
      </div>
    </div>
  )
}

export default Register
