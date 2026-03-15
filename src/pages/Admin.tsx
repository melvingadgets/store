import React, { useEffect, useMemo, useState } from 'react'
import BlurLoadingContainer from '../component/common/BlurLoadingContainer'
import {
  MdCloudUpload,
  MdDelete,
  MdInventory2,
  MdOutlineAdminPanelSettings,
  MdOutlineArrowBack,
  MdOutlineCategory,
  MdOutlinePeople,
  MdSave,
} from 'react-icons/md'
import { useSelector } from 'react-redux'
import { Link, useNavigate } from 'react-router-dom'
import {
  useCreateCategoryMutation,
  useCreateProductMutation,
  useGetAssistantTimingSummaryQuery,
  useDeleteCategoryMutation,
  useGetAllUsersQuery,
  useGetCategoriesQuery,
  useGetProductsQuery,
  useGetUserSessionSummaryQuery,
  useGetUserSessionsQuery,
  useUpdateProductStorageOptionsMutation,
} from '../redux/shopApi'
import type { RootState } from '../redux/store'
import type { AssistantTimingStageNode, ProductStorageOption, UserSessionRecord } from '../types/domain'
import { handleError } from '../utils/axios'
import { notify } from '../utils/notification'

const formatDuration = (value: number) => `${Math.round(value)} ms`
const formatTimestamp = (value?: string | null) => value ? new Date(value).toLocaleString() : "—"
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

const TimingStageTree: React.FC<{ node: AssistantTimingStageNode; depth?: number }> = ({ node, depth = 0 }) => (
  <div className={depth === 0 ? "rounded-[24px] bg-white/52 p-4 shadow-[0_12px_28px_rgba(28,66,112,0.08)]" : "mt-3 pl-4"}>
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="ios-card-title capitalize">{node.label}</p>
        <p className="ios-meta mt-1">
          Avg {formatDuration(node.stats.avgMs)} • P95 {formatDuration(node.stats.p95Ms)} • Max {formatDuration(node.stats.maxMs)}
        </p>
      </div>
      <div className="rounded-full bg-[#0a4d7b]/8 px-3 py-2 text-right text-[0.76rem] font-semibold uppercase tracking-[0.18em] text-primary">
        {node.stats.shareOfAvgTotal}% of avg total
      </div>
    </div>
    {node.children.length > 0 && (
      <div className="mt-3 border-l border-[#0a4d7b]/12">
        {node.children.map((child) => (
          <TimingStageTree key={child.key} node={child} depth={depth + 1} />
        ))}
      </div>
    )}
  </div>
)

const Admin: React.FC = () => {
  const navigate = useNavigate()
  const user = useSelector((state: RootState) => state.auth.user)
  const [storageDrafts, setStorageDrafts] = useState<Record<string, ProductStorageOption[]>>({})
  const [categoryForm, setCategoryForm] = useState({
    name: "",
    parent: "",
  })
  const [productForm, setProductForm] = useState({
    name: "",
    desc: "",
    qty: "",
    price: "",
    categoryId: "",
  })
  const [productImage, setProductImage] = useState<File | null>(null)

  const isAdmin = user?.role === "admin" || user?.role === "superadmin"
  const { data: users = [], isFetching: usersLoading } = useGetAllUsersQuery(undefined, { skip: !isAdmin })
  const { data: categories = [], isFetching: categoriesLoading } = useGetCategoriesQuery(undefined, { skip: !isAdmin })
  const { data: products = [], isFetching: productsLoading } = useGetProductsQuery(undefined, { skip: !isAdmin })
  const { data: assistantTimingSummary, isFetching: assistantTimingLoading } = useGetAssistantTimingSummaryQuery(undefined, {
    skip: !isAdmin,
  })
  const { data: userSessionSummary, isFetching: userSessionSummaryLoading } = useGetUserSessionSummaryQuery(undefined, {
    skip: !isAdmin,
    pollingInterval: 30_000,
  })
  const { data: userSessions = [], isFetching: userSessionsLoading } = useGetUserSessionsQuery({ limit: 25 }, {
    skip: !isAdmin,
    pollingInterval: 30_000,
  })
  const [createCategoryMutation, { isLoading: creatingCategory }] = useCreateCategoryMutation()
  const [deleteCategoryMutation, { isLoading: deletingCategory }] = useDeleteCategoryMutation()
  const [createProductMutation, { isLoading: creatingProduct }] = useCreateProductMutation()
  const [updateStorageOptionsMutation, { isLoading: updatingStorageOptions }] = useUpdateProductStorageOptionsMutation()
  const loading =
    usersLoading ||
    categoriesLoading ||
    productsLoading ||
    assistantTimingLoading ||
    creatingCategory ||
    deletingCategory ||
    creatingProduct ||
    updatingStorageOptions

  useEffect(() => {
    setStorageDrafts(
      Object.fromEntries(
        products
          .filter((product) => (product.storageOptions?.length ?? 0) > 0)
          .map((product) => [product._id, product.storageOptions ?? []]),
      ),
    )
  }, [products])

  const iphonesWithStorageOptions = useMemo(
    () => products.filter((product) => (product.storageOptions?.length ?? 0) > 0),
    [products],
  )

  const scrollToSection = (sectionId: string) => {
    document.getElementById(sectionId)?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    })
  }

  const handleCategoryChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = event.target
    setCategoryForm((current) => ({
      ...current,
      [name]: value,
    }))
  }

  const handleProductChange = (
    event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>,
  ) => {
    const { name, value } = event.target
    setProductForm((current) => ({
      ...current,
      [name]: value,
    }))
  }

  const handleStoragePriceChange = (productId: string, capacity: string, value: string) => {
    setStorageDrafts((current) => ({
      ...current,
      [productId]: (current[productId] ?? []).map((option) =>
        option.capacity === capacity
          ? {
              ...option,
              price: Number(value || 0),
            }
          : option,
      ),
    }))
  }

  const handleSaveStorageOptions = async (productId: string) => {
    try {
      const response = await updateStorageOptionsMutation({
        productId,
        storageOptions: storageDrafts[productId] ?? [],
      }).unwrap()
      notify("success", response.message)
    } catch (error) {
      handleError(error)
    }
  }

  const handleCreateCategory = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    try {
      const response = await createCategoryMutation(categoryForm).unwrap()
      notify("success", response.message)
      setCategoryForm({ name: "", parent: "" })
    } catch (error) {
      handleError(error)
    }
  }

  const handleDeleteCategory = async (categoryId: string) => {
    try {
      const response = await deleteCategoryMutation(categoryId).unwrap()
      notify("success", response.message)
    } catch (error) {
      handleError(error)
    }
  }

  const handleCreateProduct = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!productForm.categoryId || !productImage) {
      notify("warning", "Complete the product form and select an image")
      return
    }

    const formData = new FormData()
    formData.append("name", productForm.name)
    formData.append("desc", productForm.desc)
    formData.append("qty", productForm.qty)
    formData.append("price", productForm.price)
    formData.append("image", productImage)

    try {
      const response = await createProductMutation({
        categoryId: productForm.categoryId,
        formData,
      }).unwrap()
      notify("success", response.message)
      setProductForm({
        name: "",
        desc: "",
        qty: "",
        price: "",
        categoryId: "",
      })
      setProductImage(null)
    } catch (error) {
      handleError(error)
    }
  }

  if (!user?._id) {
    return (
      <div className='ios-mobile-shell flex min-h-screen items-center justify-center px-4'>
        <div className='ios-card max-w-sm text-center'>
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-white/60 text-primary shadow-[0_12px_24px_rgba(10,71,125,0.12)]">
            <MdOutlineAdminPanelSettings size={32} />
          </div>
          <p className='mt-4 text-lg font-bold text-primaryText'>Admin tools require login.</p>
          <p className='ios-body-muted mt-2'>Sign in with an admin account to manage catalog data.</p>
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
          <p className='ios-body-muted mt-2'>Your current account does not have permission to create catalog data or view all users.</p>
        </div>
      </div>
    )
  }

  return (
    <BlurLoadingContainer loading={loading} minDurationMs={150}>
    <div className='ios-page pb-32'>
      <header className="ios-topbar">
        <button type="button" onClick={() => navigate(-1)} className="ios-icon-button shrink-0" aria-label="Go back">
          <MdOutlineArrowBack size={22} />
        </button>
        <div className="min-w-0 flex-1">
          <p className="ios-overline">Back office</p>
          <span className="ios-nav-title block">Admin dashboard</span>
        </div>
        <div className="ios-pill">{loading ? "Refreshing" : "Live"}</div>
      </header>

      <section className="ios-card mb-4 overflow-hidden px-5 py-6">
        <div className="rounded-[28px] bg-[linear-gradient(145deg,rgba(16,37,62,0.98)_0%,rgba(9,82,134,0.92)_46%,rgba(185,228,255,0.74)_100%)] px-5 py-6 text-white shadow-[0_24px_56px_rgba(10,71,125,0.2)]">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="ios-overline text-white/75">Operations</p>
              <h1 className='ios-page-title mt-3 text-white'>Manage the catalog.</h1>
              <p className='mt-3 max-w-xs text-[0.96rem] font-medium leading-7 text-white/78'>Create categories, add products, tune iPhone capacity pricing, and review account access from one mobile-friendly admin surface.</p>
            </div>
            <div className="hidden h-14 w-14 shrink-0 items-center justify-center rounded-full bg-white/14 md:flex">
              <MdOutlineAdminPanelSettings size={28} />
            </div>
          </div>

          <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="rounded-[22px] bg-white/12 px-3 py-3 backdrop-blur-sm">
              <p className="ios-caption uppercase text-white/70">Users</p>
              <p className="mt-2 text-xl font-bold">{users.length}</p>
            </div>
            <div className="rounded-[22px] bg-white/12 px-3 py-3 backdrop-blur-sm">
              <p className="ios-caption uppercase text-white/70">Categories</p>
              <p className="mt-2 text-xl font-bold">{categories.length}</p>
            </div>
            <div className="rounded-[22px] bg-white/12 px-3 py-3 backdrop-blur-sm">
              <p className="ios-caption uppercase text-white/70">Products</p>
              <p className="mt-2 text-xl font-bold">{products.length}</p>
            </div>
          </div>

          <div className="mt-5 flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              onClick={() => scrollToSection("user-presence")}
              className="ios-secondary-button w-full justify-center bg-white/18 text-white backdrop-blur-sm sm:w-auto"
            >
              <MdOutlinePeople size={18} />
              View logged-in users
            </button>
            <button
              type="button"
              onClick={() => scrollToSection("assistant-timing")}
              className="ios-secondary-button w-full justify-center bg-white/12 text-white backdrop-blur-sm sm:w-auto"
            >
              <MdOutlineAdminPanelSettings size={18} />
              View AI timing
            </button>
          </div>
        </div>
      </section>

      <section id="assistant-timing" className="ios-card mb-4">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="ios-icon-button !h-10 !w-10 text-primary">
              <MdOutlineAdminPanelSettings size={20} />
            </div>
            <div>
              <h2 className="ios-section-title">AI request timing</h2>
              <p className="ios-body-muted">See where assistant latency is being spent, from session work down to model and tool stages.</p>
            </div>
          </div>
          <div className="ios-pill">{assistantTimingLoading ? "Refreshing" : "Telemetry"}</div>
        </div>

        {assistantTimingSummary ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="ios-card-soft px-4 py-3">
                <p className="ios-caption uppercase text-primary">Avg total</p>
                <p className="mt-2 text-xl font-bold text-primaryText">{formatDuration(assistantTimingSummary.overview.avgTotalMs)}</p>
              </div>
              <div className="ios-card-soft px-4 py-3">
                <p className="ios-caption uppercase text-primary">P95 total</p>
                <p className="mt-2 text-xl font-bold text-primaryText">{formatDuration(assistantTimingSummary.overview.p95TotalMs)}</p>
              </div>
              <div className="ios-card-soft px-4 py-3">
                <p className="ios-caption uppercase text-primary">Max total</p>
                <p className="mt-2 text-xl font-bold text-primaryText">{formatDuration(assistantTimingSummary.overview.maxTotalMs)}</p>
              </div>
              <div className="ios-card-soft px-4 py-3">
                <p className="ios-caption uppercase text-primary">Requests</p>
                <p className="mt-2 text-xl font-bold text-primaryText">{assistantTimingSummary.overview.totalRequests}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="rounded-[22px] bg-[#0a4d7b]/8 px-4 py-3">
                <p className="ios-caption uppercase text-primary">Model</p>
                <p className="mt-2 text-lg font-bold text-primaryText">{assistantTimingSummary.overview.modelCount}</p>
              </div>
              <div className="rounded-[22px] bg-[#0a4d7b]/8 px-4 py-3">
                <p className="ios-caption uppercase text-primary">Fallback</p>
                <p className="mt-2 text-lg font-bold text-primaryText">{assistantTimingSummary.overview.fallbackCount}</p>
              </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
              <div className="space-y-3">
                <div>
                  <p className="ios-section-title">Latency hierarchy</p>
                  <p className="ios-body-muted mt-1">Largest contributors are sorted first so you can see whether time is going into routing, model work, tools, or session persistence.</p>
                </div>
                {assistantTimingSummary.stageHierarchy.length > 0 ? (
                  <div className="space-y-3">
                    {assistantTimingSummary.stageHierarchy.map((node) => (
                      <TimingStageTree key={node.key} node={node} />
                    ))}
                  </div>
                ) : (
                  <p className="ios-body-muted">No assistant timing data has been recorded yet.</p>
                )}
              </div>

              <div className="space-y-3">
                <div>
                  <p className="ios-section-title">Slowest recent requests</p>
                  <p className="ios-body-muted mt-1">Use this list to inspect real sessions that took the longest.</p>
                </div>
                {assistantTimingSummary.recentSlowRequests.length > 0 ? (
                  <div className="space-y-3">
                    {assistantTimingSummary.recentSlowRequests.map((request) => (
                      <div key={`${request.sessionId}-${request.createdAt}`} className="ios-card-soft px-4 py-4">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <p className="ios-card-title">{formatDuration(request.totalMs)}</p>
                            <p className="ios-meta mt-1">
                              {request.intent} • {request.source} • {new Date(request.createdAt).toLocaleString()}
                            </p>
                          </div>
                          <div className="ios-pill">{request.usedTools.length > 0 ? request.usedTools.join(", ") : "No tools"}</div>
                        </div>
                        <div className="mt-3 space-y-2">
                          {request.marks.map((mark) => (
                            <div key={`${request.sessionId}-${mark.stage}`} className="flex items-center justify-between gap-3 rounded-[18px] bg-white/55 px-3 py-2 text-sm">
                              <span className="font-medium capitalize text-primaryText">{mark.stage.replaceAll("_", " ")}</span>
                              <span className="text-secondaryText">{formatDuration(mark.durationMs)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="ios-body-muted">Recent slow requests will appear here after the assistant handles traffic.</p>
                )}
              </div>
            </div>
          </div>
        ) : (
          <p className="ios-body-muted">Assistant telemetry will appear here once admin telemetry is available.</p>
        )}
      </section>

      <section id="user-presence" className="ios-card mb-4">
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
                      <p className="mt-2 text-sm text-primaryText">{record.lastEvent || "—"}</p>
                    </div>
                    <div className="rounded-[18px] bg-white/55 px-3 py-3">
                      <p className="ios-caption uppercase text-primary">Path</p>
                      <p className="mt-2 break-all text-sm text-primaryText">{record.lastPath || "—"}</p>
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

      <div className="space-y-4">
        <section className="ios-card">
          <div className="mb-4 flex items-center gap-3">
            <div className="ios-icon-button !h-10 !w-10 text-primary">
              <MdOutlineCategory size={20} />
            </div>
            <div>
              <h2 className="ios-section-title">Create category</h2>
              <p className="ios-body-muted">Add new category groups for the storefront.</p>
            </div>
          </div>

          <form onSubmit={handleCreateCategory} className="grid gap-3 sm:grid-cols-2">
            <input
              name="name"
              value={categoryForm.name}
              onChange={handleCategoryChange}
              placeholder="Category name"
              className="ios-input"
            />
            <input
              name="parent"
              value={categoryForm.parent}
              onChange={handleCategoryChange}
              placeholder="Parent category"
              className="ios-input"
            />
            <button type="submit" className="ios-primary-button flex items-center justify-center gap-2 sm:col-span-2">
              <MdSave size={18} />
              Save category
            </button>
          </form>
        </section>

        <section className="ios-card">
          <div className="mb-4 flex items-center gap-3">
            <div className="ios-icon-button !h-10 !w-10 text-primary">
              <MdInventory2 size={20} />
            </div>
            <div>
              <h2 className="ios-section-title">Create product</h2>
              <p className="ios-body-muted">Add a new product with description, stock, image, and category.</p>
            </div>
          </div>

          <form onSubmit={handleCreateProduct} className="grid gap-3">
            <input
              name="name"
              value={productForm.name}
              onChange={handleProductChange}
              placeholder="Product name"
              className="ios-input"
            />
            <textarea
              name="desc"
              value={productForm.desc}
              onChange={handleProductChange}
              placeholder="Product description"
              rows={4}
              className="ios-input resize-none"
            />
            <div className="grid gap-3 sm:grid-cols-3">
              <input
                name="qty"
                value={productForm.qty}
                onChange={handleProductChange}
                placeholder="Quantity"
                className="ios-input"
              />
              <input
                name="price"
                value={productForm.price}
                onChange={handleProductChange}
                placeholder="Price"
                className="ios-input"
              />
              <select
                name="categoryId"
                value={productForm.categoryId}
                onChange={handleProductChange}
                className="ios-input"
              >
                <option value="">Select category</option>
                {categories.map((category) => (
                  <option key={category._id} value={category._id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </div>

            <label className="rounded-[22px] border border-white/60 bg-white/48 px-4 py-4 text-sm text-textPrimary shadow-[0_10px_24px_rgba(28,66,112,0.08)]">
              <span className="mb-2 flex items-center gap-2 font-semibold">
                <MdCloudUpload size={18} className="text-primary" />
                Upload product image
              </span>
              <input
                type="file"
                accept="image/*"
                onChange={(event) => setProductImage(event.target.files?.[0] ?? null)}
                className="mt-2 block w-full text-sm"
              />
              {productImage && (
                <p className="mt-2 text-sm text-secondaryText">{productImage.name}</p>
              )}
            </label>

            <button type="submit" className="ios-primary-button flex items-center justify-center gap-2">
              <MdSave size={18} />
              Save product
            </button>
          </form>
        </section>

        <section className="ios-card">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="ios-icon-button !h-10 !w-10 text-primary">
                <MdInventory2 size={20} />
              </div>
              <div>
                <h2 className="ios-section-title">iPhone capacity pricing</h2>
                <p className="ios-body-muted">Adjust per-capacity pricing for iPhone variants.</p>
              </div>
            </div>
            {loading && <span className="ios-pill">Refreshing</span>}
          </div>

          <div className="space-y-4">
            {iphonesWithStorageOptions.map((product) => (
                <div key={product._id} className="ios-card-soft">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <p className="ios-card-title">{product.name}</p>
                    <p className="ios-meta mt-1">Starting price updates automatically from the lowest capacity.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void handleSaveStorageOptions(product._id)}
                    className="ios-secondary-button w-full !px-4 !py-2 text-sm sm:w-auto"
                  >
                    Save prices
                  </button>
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  {(storageDrafts[product._id] ?? []).map((option) => (
                    <label key={option.capacity} className="rounded-[22px] bg-white/58 px-4 py-3 text-sm shadow-[0_10px_24px_rgba(28,66,112,0.08)]">
                      <span className="ios-card-title text-[1rem]">{option.capacity}</span>
                      <span className="ios-meta ml-2">Qty: {option.qty}</span>
                      <input
                        type="number"
                        min="0"
                        value={option.price}
                        onChange={(event) => handleStoragePriceChange(product._id, option.capacity, event.target.value)}
                        className="ios-input mt-2"
                      />
                    </label>
                  ))}
                </div>
              </div>
            ))}
            {iphonesWithStorageOptions.length === 0 && (
              <p className="text-sm text-secondaryText">No capacity-based iPhone products were found yet.</p>
            )}
          </div>
        </section>

        <section className="ios-card">
          <div className="mb-4 flex items-center gap-3">
            <div className="ios-icon-button !h-10 !w-10 text-primary">
              <MdOutlineCategory size={20} />
            </div>
            <div>
              <h2 className="ios-section-title">Categories</h2>
              <p className="ios-body-muted">Review and remove categories when necessary.</p>
            </div>
          </div>

          <div className="space-y-3">
            {categories.map((category) => (
              <div key={category._id} className="ios-card-soft flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="ios-card-title">{category.name}</p>
                  <p className="ios-meta">{category.parent || "No parent category"}</p>
                </div>
                <button
                  type="button"
                  onClick={() => void handleDeleteCategory(category._id)}
                  className="ios-icon-button !h-10 !w-10 text-red-700"
                  aria-label={`Delete ${category.name}`}
                >
                  <MdDelete size={18} />
                </button>
              </div>
            ))}
          </div>
        </section>

        <section className="ios-card">
          <div className="mb-4 flex items-center gap-3">
            <div className="ios-icon-button !h-10 !w-10 text-primary">
              <MdOutlinePeople size={20} />
            </div>
            <div>
              <h2 className="ios-section-title">Users</h2>
              <p className="ios-body-muted">Read-only list of registered accounts and roles.</p>
            </div>
          </div>

          <div className="space-y-3">
            {users.map((record) => (
              <div key={record._id} className="ios-card-soft px-4 py-3">
                <p className="ios-card-title">{record.userName}</p>
                <p className="ios-meta mt-1">{record.email}</p>
                <p className="ios-caption mt-2 uppercase text-primary">{record.role ?? "user"}</p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
    </BlurLoadingContainer>
  )
}

export default Admin
