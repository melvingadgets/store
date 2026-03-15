import React, { useEffect, useState } from 'react'
import BlurLoadingContainer from '../component/common/BlurLoadingContainer'
import { FaUserCircle } from 'react-icons/fa'
import { MdOutlineArrowBack } from 'react-icons/md'
import { useDispatch, useSelector } from 'react-redux'
import { Link, useNavigate } from 'react-router-dom'
import { useGetProfileQuery, useUpdateProfileImageMutation, useUpdateProfileMutation } from '../redux/shopApi'
import type { AppDispatch, RootState } from '../redux/store'
import { logoutUser } from '../services/authService'
import { handleError } from '../utils/axios'
import { notify } from '../utils/notification'
import { clearClientSessionState } from '../utils/sessionCleanup'

const Account: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>()
  const navigate = useNavigate()
  const user = useSelector((state: RootState) => state.auth.user)
  const [formValues, setFormValues] = useState({
    firstName: "",
    lastName: "",
    phoneNumber: "",
    DOB: "",
  })
  const {
    data: account,
    isLoading: loading,
  } = useGetProfileQuery(undefined, { skip: !user?._id })
  const [updateProfileMutation, { isLoading: savingProfile }] = useUpdateProfileMutation()
  const [updateProfileImageMutation, { isLoading: savingImage }] = useUpdateProfileImageMutation()
  const saving = savingProfile || savingImage
  const userRecord = user!

  const profileRecord = account?.profile && typeof account.profile === "object" ? account.profile : null

  useEffect(() => {
    const hydratedProfile =
      account?.profile && typeof account.profile === "object" ? account.profile : undefined

    setFormValues({
      firstName: hydratedProfile?.firstName ?? "",
      lastName: hydratedProfile?.lastName ?? "",
      phoneNumber: hydratedProfile?.phoneNumber ?? "",
      DOB: hydratedProfile?.DOB ?? "",
    })
  }, [account])

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = event.target
    setFormValues((current) => ({
      ...current,
      [name]: value,
    }))
  }

  const handleSave = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!profileRecord?._id) {
      notify("warning", "Profile details are not ready yet")
      return
    }

    try {
      const response = await updateProfileMutation({
        profileId: profileRecord._id,
        payload: formValues,
      }).unwrap()
      notify("success", response.message)
    } catch (error) {
      handleError(error)
    }
  }

  const handleAvatarChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]

    if (!file || !profileRecord?._id) {
      return
    }

    try {
      const response = await updateProfileImageMutation({
        profileId: profileRecord._id,
        file,
      }).unwrap()
      notify("success", response.message)
    } catch (error) {
      handleError(error)
    } finally {
      event.target.value = ""
    }
  }

  const handleLogout = async () => {
    try {
      await logoutUser()
    } catch {
      // Clear the local session even if the network call fails.
    } finally {
      await clearClientSessionState(dispatch)
      navigate("/login")
    }
  }

  return (
    <div className='ios-mobile-shell'>
      <BlurLoadingContainer loading={loading} minDurationMs={150}>
      <div className="ios-page-tight pb-12">
        <header className="ios-topbar">
          <button type="button" onClick={() => navigate(-1)} className="ios-icon-button shrink-0" aria-label="Go back">
            <MdOutlineArrowBack size={22} />
          </button>
          <div className="min-w-0 flex-1">
            <p className="ios-overline">Profile</p>
            <span className="ios-nav-title block">Account</span>
          </div>
          <div className="w-11 shrink-0" />
        </header>

        <div className="space-y-4">
          <section className="ios-card">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
              {profileRecord?.avatar ? (
                <img
                  src={profileRecord.avatar}
                  alt={account?.userName ?? "Avatar"}
                  className="h-20 w-20 rounded-full border border-white/60 object-cover"
                />
              ) : (
                <div className="flex h-20 w-20 items-center justify-center rounded-full bg-white/55 text-primary">
                  <FaUserCircle size={54} />
                </div>
              )}

              <div className="min-w-0 flex-1">
                <p className="ios-section-title truncate">{account?.userName ?? userRecord.userName}</p>
                <p className="ios-meta mt-1 truncate">{account?.email ?? userRecord.email}</p>
                <p className="ios-caption mt-2 uppercase text-primary">{userRecord.role ?? "user"}</p>
              </div>
            </div>

            <label className="ios-secondary-button mt-4 inline-flex cursor-pointer">
              Update avatar
              <input type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
            </label>
          </section>

          <form onSubmit={handleSave} className="ios-card space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <label className="ios-meta font-semibold text-primaryText">
                First name
                <input
                  name="firstName"
                  value={formValues.firstName}
                  onChange={handleChange}
                  className="ios-input mt-2"
                />
              </label>
              <label className="ios-meta font-semibold text-primaryText">
                Last name
                <input
                  name="lastName"
                  value={formValues.lastName}
                  onChange={handleChange}
                  className="ios-input mt-2"
                />
              </label>
              <label className="ios-meta font-semibold text-primaryText">
                Phone number
                <input
                  name="phoneNumber"
                  value={formValues.phoneNumber}
                  onChange={handleChange}
                  className="ios-input mt-2"
                />
              </label>
              <label className="ios-meta font-semibold text-primaryText">
                Date of birth
                <input
                  name="DOB"
                  value={formValues.DOB}
                  onChange={handleChange}
                  className="ios-input mt-2"
                />
              </label>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <button
                type="submit"
                disabled={saving}
                className="ios-primary-button w-full sm:w-auto disabled:opacity-70"
              >
                {saving ? "Saving..." : "Save profile"}
              </button>
              <Link to="/history" className="ios-secondary-button w-full justify-center sm:w-auto">
                View orders
              </Link>
              <button
                type="button"
                onClick={() => void handleLogout()}
                className="ios-secondary-button w-full justify-center text-red-700 sm:w-auto"
              >
                Log out
              </button>
            </div>
          </form>
        </div>
      </div>
      </BlurLoadingContainer>
    </div>
  )
}

export default Account
