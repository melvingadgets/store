import React from 'react'
import { MdOutlineAdminPanelSettings, MdOutlineArrowBack, MdOutlinePeople } from 'react-icons/md'
import { useSelector } from 'react-redux'
import { Link, useNavigate } from 'react-router-dom'
import {
  useGetUserSessionSummaryQuery,
  useGetUserSessionsQuery,
} from '../redux/shopApi'
import type { RootState } from '../redux/store'
import type { UserSessionRecord } from '../types/domain'

const formatTimestamp = (value?: string | null) => value ? new Date(value).toLocaleString() : "-"
const formatBreakdown = (items: Array<{ label: string; count: number }>) =>
  items.slice(0, 3).map((entry) => `${entry.label} (${entry.count})`).join(", ") || "No data"

const sessionStatusClassName = (status: UserSessionRecord["status"]) => {
  switch (status) {
    case "online":
      return "bg-emerald-100 text-emerald-700"
    case "idle":
      return "bg-amber-100 text-amber-700"
    case "offline":
      return "bg-slate-200 text-slate-700"
    case "logged_out":
      return "bg-rose-100 text-rose-700"
    case "expired":
      return "bg-violet-100 text-violet-700"
    default:
      return "bg-slate-200 text-slate-700"
  }
}

const AdminSessions: React.FC = () => {
  const navigate = useNavigate()
  const user = useSelector((state: RootState) => state.auth.user)
  const isAdmin = user?.role === "admin" || user?.role === "superadmin"
  const { data: userSessionSummary, isFetching: userSessionSummaryLoading } = useGetUserSessionSummaryQuery(undefined, {
    skip: !isAdmin,
    pollingInterval: 30_000,
  })
  const { data: userSessions = [], isFetching: userSessionsLoading } = useGetUserSessionsQuery({ limit: 50 }, {
    skip: !isAdmin,
    pollingInterval: 30_000,
  })

  if (!user?._id) {
    return (
      <div className='ios-mobile-shell flex min-h-screen items-center justify-center px-4'>
        <div className='ios-card max-w-sm text-center'>
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-white/60 text-primary shadow-[0_12px_24px_rgba(10,71,125,0.12)]">
            <MdOutlineAdminPanelSettings size={32} />
          </div>
          <p className='mt-4 text-lg font-bold text-primaryText'>Admin tools require login.</p>
          <p className='ios-body-muted mt-2'>Sign in with an admin account to review live user sessions.</p>
          <Link to="/login" className='ios-primary-button mt-5 inline-flex'>Go to login</Link>
        </div>
      </div>
    )
  }

  if (!isAdmin) {
    return (
      <div className='ios-mobile-shell flex min-h-screen items-center justify-center px-4'>
        <div className='ios-card max-w-sm text-center'>
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-white/60 text-primary shadow-[0_12px_24px_rgba(10,71,125,0.12)]">
            <MdOutlineAdminPanelSettings size={32} />
          </div>
          <p className='mt-4 text-lg font-bold text-primaryText'>Admin access only.</p>
          <p className='ios-body-muted mt-2'>Your current account does not have permission to review live user sessions.</p>
        </div>
      </div>
    )
  }

  return (
    <div className='ios-page pb-24'>
      <header className="ios-topbar">
        <button type="button" onClick={() => navigate(-1)} className="ios-icon-button shrink-0" aria-label="Go back">
          <MdOutlineArrowBack size={22} />
        </button>
        <div className="min-w-0 flex-1">
          <p className="ios-overline">Back office</p>
          <span className="ios-nav-title block">Logged-in users</span>
        </div>
        <Link to="/admin" className="ios-secondary-button !px-4 !py-2 text-sm">
          Dashboard
        </Link>
      </header>

      <section className="ios-card mb-4 overflow-hidden px-5 py-6">
        <div className="rounded-[28px] bg-[linear-gradient(145deg,rgba(16,37,62,0.98)_0%,rgba(9,82,134,0.92)_46%,rgba(185,228,255,0.74)_100%)] px-5 py-6 text-white shadow-[0_24px_56px_rgba(10,71,125,0.2)]">
          <p className="ios-overline text-white/75">Session monitoring</p>
          <h1 className='ios-page-title mt-3 text-white'>Track active and recent user sessions.</h1>
          <p className='mt-3 max-w-2xl text-[0.96rem] font-medium leading-7 text-white/78'>
            Review who is online, who has gone idle, when users logged out, and which device, browser, and route they last used.
          </p>
        </div>
      </section>

      <section className="ios-card mb-4">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="ios-icon-button !h-10 !w-10 text-primary">
              <MdOutlinePeople size={20} />
            </div>
            <div>
              <h2 className="ios-section-title">User presence</h2>
              <p className="ios-body-muted">Live session telemetry from backend heartbeats, login events, and explicit logouts.</p>
            </div>
          </div>
          <div className="ios-pill">{userSessionsLoading || userSessionSummaryLoading ? "Refreshing" : "Live"}</div>
        </div>

        {userSessionSummary ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
              <div className="ios-card-soft px-4 py-3">
                <p className="ios-caption uppercase text-primary">Active users</p>
                <p className="mt-2 text-xl font-bold text-primaryText">{userSessionSummary.overview.activeUsers}</p>
              </div>
              <div className="ios-card-soft px-4 py-3">
                <p className="ios-caption uppercase text-primary">Online</p>
                <p className="mt-2 text-xl font-bold text-primaryText">{userSessionSummary.overview.onlineCount}</p>
              </div>
              <div className="ios-card-soft px-4 py-3">
                <p className="ios-caption uppercase text-primary">Idle</p>
                <p className="mt-2 text-xl font-bold text-primaryText">{userSessionSummary.overview.idleCount}</p>
              </div>
              <div className="ios-card-soft px-4 py-3">
                <p className="ios-caption uppercase text-primary">Offline</p>
                <p className="mt-2 text-xl font-bold text-primaryText">{userSessionSummary.overview.offlineCount}</p>
              </div>
              <div className="ios-card-soft px-4 py-3">
                <p className="ios-caption uppercase text-primary">Logged out</p>
                <p className="mt-2 text-xl font-bold text-primaryText">{userSessionSummary.overview.loggedOutCount}</p>
              </div>
              <div className="ios-card-soft px-4 py-3">
                <p className="ios-caption uppercase text-primary">Expired</p>
                <p className="mt-2 text-xl font-bold text-primaryText">{userSessionSummary.overview.expiredCount}</p>
              </div>
            </div>

            <div className="grid gap-3 lg:grid-cols-3">
              <div className="rounded-[22px] bg-[#0a4d7b]/8 px-4 py-3">
                <p className="ios-caption uppercase text-primary">Top browsers</p>
                <p className="mt-2 text-sm text-primaryText">{formatBreakdown(userSessionSummary.breakdowns.browsers)}</p>
              </div>
              <div className="rounded-[22px] bg-[#0a4d7b]/8 px-4 py-3">
                <p className="ios-caption uppercase text-primary">Top devices</p>
                <p className="mt-2 text-sm text-primaryText">{formatBreakdown(userSessionSummary.breakdowns.deviceTypes)}</p>
              </div>
              <div className="rounded-[22px] bg-[#0a4d7b]/8 px-4 py-3">
                <p className="ios-caption uppercase text-primary">Top operating systems</p>
                <p className="mt-2 text-sm text-primaryText">{formatBreakdown(userSessionSummary.breakdowns.operatingSystems)}</p>
              </div>
            </div>

            <div className="space-y-3">
              {userSessions.map((record) => (
                <div key={record.sessionId} className="ios-card-soft px-4 py-4">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="ios-card-title">{record.user?.userName ?? "Unknown user"}</p>
                        <span className={`rounded-full px-3 py-1 text-[0.72rem] font-semibold uppercase tracking-[0.16em] ${sessionStatusClassName(record.status)}`}>
                          {record.status.replaceAll("_", " ")}
                        </span>
                      </div>
                      <p className="ios-meta mt-1 break-all">{record.user?.email ?? "No email"} • {record.ipAddress || "No IP captured"}</p>
                      <p className="ios-meta mt-1">{record.browser} • {record.os} • {record.deviceType}</p>
                    </div>
                    <div className="rounded-[18px] bg-white/55 px-3 py-2 text-sm text-secondaryText">
                      Last seen {formatTimestamp(record.lastSeenAt)}
                    </div>
                  </div>

                  <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <div className="rounded-[18px] bg-white/55 px-3 py-3">
                      <p className="ios-caption uppercase text-primary">Login</p>
                      <p className="mt-2 text-sm text-primaryText">{formatTimestamp(record.loginAt)}</p>
                    </div>
                    <div className="rounded-[18px] bg-white/55 px-3 py-3">
                      <p className="ios-caption uppercase text-primary">Logout</p>
                      <p className="mt-2 text-sm text-primaryText">{formatTimestamp(record.logoutAt)}</p>
                    </div>
                    <div className="rounded-[18px] bg-white/55 px-3 py-3">
                      <p className="ios-caption uppercase text-primary">Last event</p>
                      <p className="mt-2 text-sm text-primaryText">{record.lastEvent || "-"}</p>
                    </div>
                    <div className="rounded-[18px] bg-white/55 px-3 py-3">
                      <p className="ios-caption uppercase text-primary">Path</p>
                      <p className="mt-2 break-all text-sm text-primaryText">{record.lastPath || "-"}</p>
                    </div>
                  </div>
                </div>
              ))}

              {userSessions.length === 0 && (
                <p className="ios-body-muted">No user session telemetry has been recorded yet.</p>
              )}
            </div>
          </div>
        ) : (
          <p className="ios-body-muted">User presence telemetry will appear here after people start logging in.</p>
        )}
      </section>
    </div>
  )
}

export default AdminSessions
