# Codex Implementation Handoff — Swap Page Gated Launch

## Overview

Build a new standalone `/swap` page for a React e-commerce app, gated behind a feature flag. When the flag is ON, the entire app shows ONLY the swap page. When OFF, the full app works normally and the new swap page does not exist.

**Tech stack**: React 18, TypeScript, Vite, Redux Toolkit + RTK Query, TailwindCSS, Swiper 11, React Router v6.

**Do NOT modify** any existing page behavior. The old swap page (`SwapDevice.tsx`) stays fully functional. You are only allowed to:
- Extract shared code out of `SwapDevice.tsx` (and update its imports)
- Modify `AllRoutes.tsx` to add gated routing
- Modify `vite-env.d.ts` to add env types
- Modify `.env` / `.env.example` to add new variables
- Create new files

---

## Task 1: Extract ConditionSelector into shared file

**Create** `src/component/swap/ConditionSelector.tsx`

Move these two items out of `src/pages/SwapDevice.tsx` (lines 435–488) into the new file and export them:

```tsx
// MOVE THIS from SwapDevice.tsx lines 435-478
import type { SwapConditionOption } from '../../types/domain'

interface ConditionSelectorProps<TValue extends string> {
  label: string
  options: SwapConditionOption<TValue>[]
  value: string
  onChange: (value: TValue) => void
  compact?: boolean
  selectedSummary?: string
}

export const ConditionSelector = <TValue extends string>({
  label,
  options,
  value,
  onChange,
  compact = false,
  selectedSummary,
}: ConditionSelectorProps<TValue>) => (
  <div className='space-y-2'>
    <div className='flex flex-col items-start gap-1 sm:flex-row sm:items-center sm:justify-between'>
      <span className='ios-card-title'>{label}</span>
      <span className='ios-meta'>{selectedSummary ?? options.find((option) => option.value === value)?.label}</span>
    </div>

    <div className={`flex flex-wrap gap-2 ${compact ? 'sm:grid sm:grid-cols-2' : ''}`}>
      {options.map((option) => {
        const isSelected = option.value === value

        return (
          <button
            key={option.value}
            type='button'
            onClick={() => onChange(option.value)}
            className={`min-h-11 min-w-[calc(50%-0.25rem)] rounded-[20px] px-4 py-2.5 text-left transition duration-200 active:scale-[0.98] sm:min-w-0 ${
              isSelected
                ? 'bg-primary text-white shadow-[0_14px_28px_rgba(5,103,171,0.22)]'
                : 'bg-white/56 text-textPrimary shadow-[0_10px_18px_rgba(17,33,62,0.06)]'
            }`}
          >
            <span className='block text-[0.96rem] font-semibold'>{option.label}</span>
          </button>
        )
      })}
    </div>
  </div>
)

// MOVE THIS from SwapDevice.tsx lines 481-488
import type { SwapConditionSelections } from '../../types/domain'

export const getConditionSummaryLabel = (
  factorKey: string,
  selections: SwapConditionSelections,
  options: SwapConditionOption<string>[],
) => {
  const selectedLabel = options.find((option) => option.value === selections[factorKey as keyof SwapConditionSelections])?.label
  return selectedLabel
}
```

**Then modify** `src/pages/SwapDevice.tsx`:
- Remove the inline `ConditionSelector` component (lines 435–478) and `getConditionSummaryLabel` (lines 481–488)
- Remove the `ConditionSelectorProps` interface (lines 435–442)
- Add this import at the top:
  ```ts
  import { ConditionSelector, getConditionSummaryLabel } from '../component/swap/ConditionSelector'
  ```
- Everything else in SwapDevice.tsx stays exactly the same.

---

## Task 2: Feature flag + env setup

**Create** `src/lib/featureFlags.ts`:
```ts
export const isNewSwapEnabled = () =>
  import.meta.env.VITE_ENABLE_NEW_SWAP === 'true'
```

**Modify** `src/vite-env.d.ts` — add two lines inside `ImportMetaEnv`:
```ts
/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string;
  readonly VITE_ENABLE_NEW_SWAP?: string;
  readonly VITE_WHATSAPP_PHONE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
```

**Modify** `.env` — add after the existing line:
```
VITE_ENABLE_NEW_SWAP=true
VITE_WHATSAPP_PHONE=234XXXXXXXXXX
```

**Modify** `.env.example` — same additions with placeholder values:
```
VITE_ENABLE_NEW_SWAP=true
VITE_WHATSAPP_PHONE=234XXXXXXXXXX
```

---

## Task 3: WhatsApp message utility

**Create** `src/utils/swapMessage.ts`:

```ts
import type { SwapConditionSelections, SwapEvaluationResult } from '../types/domain'
import formatPrice from './formatPrice'

export interface SwapMessageParams {
  targetProductName: string
  targetCapacity?: string
  targetPrice: number
  tradeInModel: string
  tradeInStorage: string
  conditionSelections: SwapConditionSelections
  evaluation: SwapEvaluationResult
}

export const buildSwapWhatsAppMessage = (params: SwapMessageParams): string => {
  const lines = [
    `Hi, I'd like to swap my device.`,
    ``,
    `*Device I want:*`,
    `${params.targetProductName}${params.targetCapacity ? ` (${params.targetCapacity})` : ''}`,
    `Price: ${formatPrice(params.targetPrice)}`,
    ``,
    `*My trade-in device:*`,
    `${params.tradeInModel} — ${params.tradeInStorage}`,
    `Overall: ${params.conditionSelections.overallCondition}`,
    `Screen: ${params.conditionSelections.screenCondition}`,
    `Battery: ${params.conditionSelections.batteryCondition}`,
    `Face ID: ${params.conditionSelections.faceIdStatus}`,
    `Camera: ${params.conditionSelections.cameraStatus}`,
    ``,
    `*Estimate:*`,
    `Trade-in credit: ${formatPrice(params.evaluation.customerEstimateMin)} – ${formatPrice(params.evaluation.customerEstimateMax)}`,
    `Balance to pay: ${formatPrice(params.evaluation.estimatedBalanceMin)} – ${formatPrice(params.evaluation.estimatedBalanceMax)}`,
  ]

  return lines.join('\n')
}

export const buildSwapWhatsAppUrl = (phoneNumber: string, params: SwapMessageParams): string => {
  const text = encodeURIComponent(buildSwapWhatsAppMessage(params))
  const cleanPhone = phoneNumber.replace(/[^0-9]/g, '')
  return `https://wa.me/${cleanPhone}?text=${text}`
}
```

Note: `formatPrice` formats in Nigerian Naira (NGN). It's at `src/utils/formatPrice.ts`:
```ts
const formatPrice = (price: number): string => {
    return new Intl.NumberFormat("en-NG", {
      style: "currency",
      currency: "NGN",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    })
      .format(price)
      .replace("NGN", "NGN ");
  };
export default formatPrice;
```

---

## Task 4: Build sub-components

### 4a. `src/component/swap/SwapProductCarousel.tsx`

A horizontal Swiper carousel of product cards. The user taps a card to select a product.

**Props:**
```ts
interface SwapProductCarouselProps {
  selectedProductId: string | null
  onSelectProduct: (productId: string) => void
}
```

**Behavior:**
- Call `useGetProductsQuery()` from `src/redux/shopApi.ts` — returns `Product[]`
- Render a `Swiper` with `freeMode: true`, `slidesPerView: 'auto'`, `spaceBetween: 12`
- Each `SwiperSlide` is a card showing: product `image`, `name`, and "From" price (use `product.storageOptions?.[0]?.price ?? product.price` with `formatPrice`)
- Selected card gets a ring highlight: `ring-2 ring-primary` class
- Unselected card: neutral background
- Do NOT reuse `ProductCard.tsx` — it has cart/navigate behavior baked in. Build a simple card.

**Swiper imports** (already installed as dependency):
```ts
import { Swiper, SwiperSlide } from 'swiper/react'
import { FreeMode } from 'swiper/modules'
import 'swiper/css'
import 'swiper/css/free-mode'
```

**Design tokens to use:** `ios-card`, `ios-card-title`, `ios-meta`, `ios-caption`, rounded corners `rounded-[22px]`, backgrounds like `bg-white/58`.

### 4b. `src/component/swap/SwapCapacityPicker.tsx`

Shows after a product is selected. Displays the product summary and capacity pills.

**Props:**
```ts
import type { Product } from '../../types/domain'

interface SwapCapacityPickerProps {
  product: Product
  selectedCapacity: string
  onSelectCapacity: (capacity: string) => void
}
```

**Behavior:**
- Only render if `product.storageOptions` has entries
- Show product image (small), name, and price for selected capacity
- Render capacity pills using the exact styling pattern:
  ```tsx
  <button
    className={`ios-pill ${selectedCapacity === capacity ? 'ios-pill-active' : ''}`}
  >
    {capacity}
  </button>
  ```

### 4c. `src/component/swap/SwapTradeInForm.tsx`

The trade-in device selection form. Same UI as `SwapDevice.tsx` lines 239–345.

**Props:**
```ts
import type { SwapConditionSelections, SwapMetadata } from '../../types/domain'

interface SwapTradeInFormProps {
  swapMetadata: SwapMetadata
  selectedModel: string
  selectedStorage: string
  conditionSelections: SwapConditionSelections
  showAdvancedChecks: boolean
  onModelChange: (model: string) => void
  onStorageChange: (storage: string) => void
  onConditionChange: <K extends keyof SwapConditionSelections>(key: K, value: SwapConditionSelections[K]) => void
  onToggleAdvancedChecks: () => void
}
```

**Behavior — port the exact UI from SwapDevice.tsx:**
1. Section "Choose your trade-in iPhone" with model `<select>` dropdown
2. Storage capacity pills (shown when model is selected)
3. Section "Tell us about your iPhone" with first 2 condition factors
4. "More details" toggle button
5. Remaining 3 condition factors (shown when toggled)
- Import `ConditionSelector` and `getConditionSummaryLabel` from `./ConditionSelector`
- Import `MdKeyboardArrowDown` from `react-icons/md` for the dropdown arrow

**Derived data needed inside the component:**
```ts
const swapModels = useMemo(
  () => swapMetadata.models.map((entry) => entry.model).reverse(),
  [swapMetadata.models],
)

const availableCapacities = useMemo(
  () => (selectedModel ? swapMetadata.models.find((entry) => entry.model === selectedModel)?.capacities ?? [] : []),
  [selectedModel, swapMetadata.models],
)
```

### 4d. `src/component/swap/SwapEstimateCard.tsx`

The estimate display section. Same UI as `SwapDevice.tsx` lines 348–420, but the CTA says "Continue on WhatsApp".

**Props:**
```ts
import type { SwapEvaluationResult } from '../../types/domain'

interface SwapEstimateCardProps {
  evaluation: SwapEvaluationResult | undefined
  isEvaluating: boolean
  hasError: boolean
  selectedModel: string
  selectedStorage: string
  targetProductName: string
  onOpenWhatsApp: () => void
}
```

**Behavior:**
- When `evaluation` exists: show balance range, trade-in credit range, trade-in device summary, and two buttons:
  - "Continue on WhatsApp" (`ios-primary-button`) — calls `onOpenWhatsApp`
  - "Review device details" (`ios-secondary-button`) — scrolls to top
- When no evaluation: show placeholder text "Pick a model and storage to estimate your swap."
- Footer with "Final credit is confirmed after inspection." + loading/error indicators

### 4e. `src/component/swap/SwapWhatsAppSheet.tsx`

Bottom sheet overlay with WhatsApp message preview. Follow the exact bottom sheet pattern from `ProductDetails.tsx` lines 296–354.

**Props:**
```ts
interface SwapWhatsAppSheetProps {
  isOpen: boolean
  onClose: () => void
  whatsAppUrl: string
  messagePreview: string
}
```

**Behavior:**
- When `isOpen` is false, render nothing
- Overlay: `fixed inset-0 z-50 flex items-end bg-slate-950/28`
- Backdrop button to close
- Sheet container: `ios-sheet` class with drag handle
- Read-only message preview in a styled container (use `whitespace-pre-wrap` for line breaks)
- Primary button: "Open WhatsApp" → `window.open(whatsAppUrl, '_blank')`
- Secondary button: "Copy message" → `navigator.clipboard.writeText(messagePreview)`

**Bottom sheet pattern to follow** (from ProductDetails.tsx):
```tsx
<div className="fixed inset-0 z-50 flex items-end bg-slate-950/28">
  <button
    type="button"
    aria-label="Close"
    className="absolute inset-0"
    onClick={onClose}
  />
  <div className="relative mx-auto w-full max-w-screen-md">
    <div className="ios-sheet">
      <div className="mx-auto h-1.5 w-16 rounded-full bg-slate-300/80" />
      {/* Content here */}
    </div>
  </div>
</div>
```

---

## Task 5: Assemble SwapPage.tsx

**Create** `src/pages/SwapPage.tsx`

This is the main page that composes all sub-components from Task 4.

**Local state:**
```ts
const [selectedProductId, setSelectedProductId] = useState<string | null>(null)
const [selectedCapacity, setSelectedCapacity] = useState('')
const [selectedModel, setSelectedModel] = useState('')
const [selectedStorage, setSelectedStorage] = useState('')
const [conditionSelections, setConditionSelections] = useState<SwapConditionSelections | null>(null)
const [showAdvancedChecks, setShowAdvancedChecks] = useState(false)
const [isWhatsAppSheetOpen, setIsWhatsAppSheetOpen] = useState(false)
```

**RTK Query hooks** (all imported from `src/redux/shopApi.ts`):
```ts
const { data: products, isLoading: isProductsLoading } = useGetProductsQuery()
const { data: swapMetadata, isLoading: isSwapMetadataLoading } = useGetSwapMetadataQuery()
```

**Selected product derived:**
```ts
const selectedProduct = useMemo(
  () => products?.find((p) => p._id === selectedProductId) ?? null,
  [products, selectedProductId],
)
```

**Capacity handling:**
- When `selectedProduct` changes, auto-select first capacity from `storageOptions`
- Resolve `targetPrice` from selected capacity or fallback to `selectedProduct.price`

**Debounced evaluation** — port this exact pattern from `SwapDevice.tsx` lines 121–174:
```ts
const [debouncedEstimateInput, setDebouncedEstimateInput] = useState<{...} | null>(null)

const {
  currentData: evaluation,
  isFetching: isSwapEvaluationFetching,
  isError: hasSwapEvaluationError,
} = useEvaluateSwapQuery(debouncedEstimateInput as NonNullable<typeof debouncedEstimateInput>, {
  skip: debouncedEstimateInput === null,
})

useEffect(() => {
  if (!selectedProduct || !conditionSelections || !selectedModel || !selectedStorage) {
    setDebouncedEstimateInput(null)
    return
  }

  const timer = window.setTimeout(() => {
    setDebouncedEstimateInput({
      targetProductId: selectedProduct._id,
      targetCapacity: selectedCapacity || undefined,
      tradeInModel: selectedModel,
      tradeInStorage: selectedStorage,
      conditionSelections,
    })
  }, 250)

  return () => window.clearTimeout(timer)
}, [conditionSelections, selectedModel, selectedProduct, selectedStorage, selectedCapacity])
```

**Assistant integration** — port from `SwapDevice.tsx` lines 78–119:
```ts
const { tradeInDraft } = useAssistant()
// ... same useEffect blocks that sync tradeInDraft into selectedModel, selectedStorage, conditionSelections
```

**URL params for pre-selection:**
```ts
const [searchParams] = useSearchParams()

useEffect(() => {
  const preselectedProductId = searchParams.get('productId')
  const preselectedCapacity = searchParams.get('capacity')
  if (preselectedProductId) setSelectedProductId(preselectedProductId)
  if (preselectedCapacity) setSelectedCapacity(preselectedCapacity.trim().toUpperCase())
}, [searchParams])
```

**WhatsApp handling:**
```ts
import { buildSwapWhatsAppUrl, buildSwapWhatsAppMessage } from '../utils/swapMessage'

const whatsAppPhone = import.meta.env.VITE_WHATSAPP_PHONE ?? ''

// When user clicks "Continue on WhatsApp":
const handleOpenWhatsApp = () => {
  if (evaluation && selectedProduct) {
    setIsWhatsAppSheetOpen(true)
  }
}

// Build URL and message for the sheet:
const whatsAppUrl = (evaluation && selectedProduct)
  ? buildSwapWhatsAppUrl(whatsAppPhone, { ... })
  : ''
const whatsAppMessage = (evaluation && selectedProduct)
  ? buildSwapWhatsAppMessage({ ... })
  : ''
```

**Page layout** (use `ios-mobile-shell` and `ios-page-tight` wrapper classes):
```tsx
<div className='ios-mobile-shell'>
  <div className='ios-page-tight'>
    <header className='ios-topbar'>
      <div className='min-w-0 flex-1'>
        <p className='ios-overline'>Trade-in</p>
        <span className='ios-nav-title block truncate'>Estimate</span>
      </div>
    </header>

    <div className='space-y-4 pb-6'>
      <SwapProductCarousel selectedProductId={selectedProductId} onSelectProduct={setSelectedProductId} />
      {selectedProduct && <SwapCapacityPicker product={selectedProduct} selectedCapacity={selectedCapacity} onSelectCapacity={setSelectedCapacity} />}
      {swapMetadata && conditionSelections && <SwapTradeInForm ... />}
      <SwapEstimateCard ... onOpenWhatsApp={handleOpenWhatsApp} />
    </div>
  </div>

  <SwapWhatsAppSheet
    isOpen={isWhatsAppSheetOpen}
    onClose={() => setIsWhatsAppSheetOpen(false)}
    whatsAppUrl={whatsAppUrl}
    messagePreview={whatsAppMessage}
  />
</div>
```

---

## Task 6: Create minimal app shell

**Create** `src/layout/SwapShell.tsx`

A minimal layout for swap-only mode. No nav, no footer — just branding + content.

```tsx
import React from 'react'
import { Outlet } from 'react-router-dom'
import { AssistantProvider } from '../context/AssistantContext'
import AssistantChat from '../component/common/AssistantChat'
import GlobalLoadingOverlay from '../component/common/GlobalLoadingOverlay'

const SwapShell: React.FC = () => (
  <AssistantProvider>
    <header className='ios-topbar mx-auto max-w-screen-md px-4 py-3'>
      <span className='text-lg font-bold text-textPrimary'>Melvin's Store</span>
    </header>
    <div className='mx-auto max-w-screen-md'>
      <Outlet />
    </div>
    <GlobalLoadingOverlay />
    <AssistantChat />
  </AssistantProvider>
)

export default SwapShell
```

Note: This wraps content in `AssistantProvider` so the AI assistant chat still works in swap-only mode. No `AuthSessionManager` because swap-only mode doesn't require login. No `Footer` component. Adjust the header branding text/style as needed.

---

## Task 7: Gated routing

**Modify** `src/routes/AllRoutes.tsx`

This is the critical change. The router checks the feature flag at build time and returns a completely different route tree.

**Current file** (for reference):
```tsx
/* eslint-disable react-refresh/only-export-components */
import React, { Suspense, lazy } from "react"
import { RouteObject, createBrowserRouter } from "react-router-dom"
import { RequireAuth, RequireGuest } from "../component/common/RouteGuards"
import AppShell from "../layout/AppShell"
import WebLayout from "../layout/WebLayout"
import ErrorBoundaryPage from "../pages/ErrorBoundaryPage"
import NotFoundPage from "../pages/NotFoundPage"

const Home = lazy(() => import("../pages/Home"))
const Cart = lazy(() => import("../pages/Cart"))
const Login = lazy(() => import("../pages/Login"))
const Register = lazy(() => import("../pages/Register"))
const Product = lazy(() => import("../pages/Product"))
const ProductDetails = lazy(() => import("../pages/ProductDetails"))
const EasyBuy = lazy(() => import("../pages/EasyBuy"))
const History = lazy(() => import("../pages/History"))
const Account = lazy(() => import("../pages/Account"))
const Admin = lazy(() => import("../pages/Admin"))
const SwapDevice = lazy(() => import("../pages/SwapDevice"))
const Checkout = lazy(() => import("../pages/Checkout"))
const OrderConfirmation = lazy(() => import("../pages/OrderConfirmation"))

const withSuspense = (Component: React.ComponentType)=>(
    <Suspense fallback={null}>
        <Component />
    </Suspense>
)

const routesConfig: RouteObject[] = [
    {
      element: <AppShell />,
      errorElement: <ErrorBoundaryPage />,
      children: [
        {
            path: "/",
            element: <WebLayout/>,
            children: [
                {index: true, element: withSuspense(Home)},
                {path: "/cart", element: withSuspense(Cart)},
                {path: "/product", element: withSuspense(Product)},
                {
                  element: <RequireAuth />,
                  children: [
                    {path: "/account", element: withSuspense(Account)},
                    {path: "/settings", element: withSuspense(Account)},
                    {path: "/admin", element: withSuspense(Admin)},
                    {path: "/menu", element: withSuspense(Admin)},
                    {path: "/history", element: withSuspense(History)},
                  ]
                },
            ]
        },
        {
          element: <RequireGuest />,
          children: [
            { path: "login", element: withSuspense(Login) },
            { path: "register", element: withSuspense(Register) },
          ]
        },
      { path: "orderconfirm", element: withSuspense(OrderConfirmation) },
      { path: "checkout", element: withSuspense(Checkout) },
      { path: "/product/:id/easybuy", element: withSuspense(EasyBuy) },
      { path: "/product/:id/swap", element: withSuspense(SwapDevice) },
      {path: "/product/:id", element: withSuspense(ProductDetails)},
      { path: "*", element: <NotFoundPage /> },
      ]
    },
]

export const router = createBrowserRouter(routesConfig)
```

**New version:**

Add these imports at the top:
```ts
import { Navigate } from "react-router-dom"
import { isNewSwapEnabled } from "../lib/featureFlags"
import SwapShell from "../layout/SwapShell"
const SwapPage = lazy(() => import("../pages/SwapPage"))
```

Replace the `routesConfig` and `router` export with:
```ts
const fullAppRoutes: RouteObject[] = [
    // ... exact same content as the current routesConfig (unchanged)
]

const swapOnlyRoutes: RouteObject[] = [
    {
      element: <SwapShell />,
      errorElement: <ErrorBoundaryPage />,
      children: [
        { path: "/swap", element: withSuspense(SwapPage) },
        { path: "*", element: <Navigate to="/swap" replace /> },
      ],
    },
]

export const router = createBrowserRouter(
  isNewSwapEnabled() ? swapOnlyRoutes : fullAppRoutes
)
```

**Key points:**
- When flag is ON: only `/swap` exists, everything else redirects to `/swap`
- When flag is OFF: the app is exactly as it is today. The new `/swap` route does NOT exist.
- `isNewSwapEnabled()` is evaluated at build time (Vite statically replaces `import.meta.env.*`), so unused routes are tree-shaken in production.

---

## Types Reference

These types from `src/types/domain.ts` are used across the new components:

```ts
export interface Product {
  _id: string;
  name: string;
  desc: string;
  qty: number;
  price: number;
  image: string;
  storageOptions?: ProductStorageOption[];
  category?: Category | string;
  createdBy?: Pick<User, "_id" | "userName" | "email"> | string;
}

export interface ProductStorageOption {
  capacity: string;
  price: number;
  qty: number;
}

export interface SwapConditionSelections {
  overallCondition: OverallCondition;
  screenCondition: ScreenCondition;
  batteryCondition: BatteryCondition;
  faceIdStatus: FaceIdStatus;
  cameraStatus: CameraStatus;
}

export interface SwapMetadata {
  models: SwapModelCatalogEntry[];
  defaultConditionSelections: SwapConditionSelections;
  conditionFactors: SwapConditionFactor[];
}

export interface SwapEvaluationResult {
  targetPrice: number;
  referencePrice: number;
  swapRate: number;
  totalDeductionRate: number;
  baseInternalResaleValue: number;
  internalAdjustedResaleValue: number;
  customerEstimateMin: number;
  customerEstimateMax: number;
  estimatedBalanceMin: number;
  estimatedBalanceMax: number;
}

export interface SwapModelCatalogEntry {
  model: string;
  capacities: string[];
}

export interface SwapConditionFactor<
  TKey extends SwapConditionFactorKey = SwapConditionFactorKey,
  TValue extends string = string,
> {
  key: TKey;
  label: string;
  compact?: boolean;
  options: SwapConditionOption<TValue>[];
}

export interface SwapConditionOption<TValue extends string = string> {
  label: string;
  value: TValue;
}
```

---

## RTK Query Hooks Reference

From `src/redux/shopApi.ts` — these hooks are already defined and exported:

```ts
useGetProductsQuery()        // Returns Product[]
useGetSwapMetadataQuery()    // Returns SwapMetadata
useEvaluateSwapQuery(args)   // POST to /swap/evaluate, returns SwapEvaluationResult
```

The evaluate query accepts:
```ts
{
  targetProductId: string;
  targetCapacity?: string;
  tradeInModel: string;
  tradeInStorage: string;
  conditionSelections: SwapConditionSelections;
}
```

---

## Design System Reference

The app uses an iOS-inspired design system via TailwindCSS custom classes defined in `src/index.css`:

- **Layout**: `ios-mobile-shell`, `ios-page-tight`
- **Cards**: `ios-card`, `ios-card-soft`
- **Typography**: `ios-page-title`, `ios-section-title`, `ios-card-title`, `ios-overline`, `ios-caption`, `ios-meta`, `ios-body-muted`
- **Pricing**: `ios-price`, `ios-price-inline`
- **Buttons**: `ios-primary-button`, `ios-secondary-button`, `ios-icon-button`
- **Pills**: `ios-pill`, `ios-pill-active`
- **Inputs**: `ios-input`
- **Navigation**: `ios-topbar`, `ios-nav-title`
- **Sheets**: `ios-sheet`
- **Colors**: `text-textPrimary`, `text-secondaryText`, `bg-primary`
- **Rounded corners**: `rounded-[20px]`, `rounded-[22px]`, `rounded-[24px]`, `rounded-[26px]`, `rounded-[28px]`
- **Glass backgrounds**: `bg-white/42`, `bg-white/50`, `bg-white/54`, `bg-white/56`, `bg-white/58`, `bg-white/62`, `bg-white/72`

---

## Files Summary

| File | Action |
|------|--------|
| `src/component/swap/ConditionSelector.tsx` | CREATE |
| `src/component/swap/SwapProductCarousel.tsx` | CREATE |
| `src/component/swap/SwapCapacityPicker.tsx` | CREATE |
| `src/component/swap/SwapTradeInForm.tsx` | CREATE |
| `src/component/swap/SwapEstimateCard.tsx` | CREATE |
| `src/component/swap/SwapWhatsAppSheet.tsx` | CREATE |
| `src/pages/SwapPage.tsx` | CREATE |
| `src/layout/SwapShell.tsx` | CREATE |
| `src/lib/featureFlags.ts` | CREATE |
| `src/utils/swapMessage.ts` | CREATE |
| `src/pages/SwapDevice.tsx` | MODIFY — extract ConditionSelector, update imports |
| `src/routes/AllRoutes.tsx` | MODIFY — gated route tree |
| `src/vite-env.d.ts` | MODIFY — add env types |
| `.env` | MODIFY — add new vars |
| `.env.example` | MODIFY — add new vars |

---

## Acceptance Criteria

1. `VITE_ENABLE_NEW_SWAP=true` → app shows ONLY the swap page with minimal branded header, no nav
2. `VITE_ENABLE_NEW_SWAP=true` → navigating to `/`, `/product`, `/cart`, or any other URL redirects to `/swap`
3. `VITE_ENABLE_NEW_SWAP=false` → full app works normally, all routes accessible
4. `VITE_ENABLE_NEW_SWAP=false` → `/swap` returns 404 / not found — the new page does not exist
5. On `/swap`: product carousel loads and is scrollable
6. Tapping a product card selects it, capacity pills appear
7. Selecting trade-in model + storage + conditions triggers live estimate (debounced 250ms)
8. Clicking "Continue on WhatsApp" opens a bottom sheet with message preview
9. "Open WhatsApp" button opens correct `wa.me` URL with full swap summary
10. Old swap page at `/product/:id/swap` works exactly as before (when flag is OFF)
11. `npm run build` succeeds with zero TypeScript errors
