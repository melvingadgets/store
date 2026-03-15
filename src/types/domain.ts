export interface ApiResponse<T> {
  success: number;
  message: string;
  data: T;
}

export interface Profile {
  _id: string;
  firstName: string;
  lastName: string;
  phoneNumber: string;
  DOB: string;
  avatar: string;
  user?: string;
}

export interface User {
  _id: string;
  userName: string;
  email: string;
  role?: "user" | "admin" | "superadmin";
  profile?: Profile | string;
  verify?: boolean;
}

export interface Category {
  _id: string;
  name: string;
  slug: string;
  parent: string;
  user?: Pick<User, "_id" | "userName" | "email"> | string;
  products?: string[];
}

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

export type OverallCondition = "excellent" | "good" | "fair" | "poor";
export type ScreenCondition = "original" | "scratched" | "cracked" | "changed-screen";
export type BatteryCondition = "90-plus" | "80-89" | "79-75" | "changed-battery";
export type FaceIdStatus = "original" | "no-face-id";
export type CameraStatus = "original" | "changed" | "rear-fault" | "front-fault" | "both-faulty";

export interface SwapConditionSelections {
  overallCondition: OverallCondition;
  screenCondition: ScreenCondition;
  batteryCondition: BatteryCondition;
  faceIdStatus: FaceIdStatus;
  cameraStatus: CameraStatus;
}

export type SwapConditionFactorKey =
  | "overallCondition"
  | "screenCondition"
  | "batteryCondition"
  | "faceIdStatus"
  | "cameraStatus";

export interface SwapConditionOption<TValue extends string = string> {
  label: string;
  value: TValue;
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

export interface SwapModelCatalogEntry {
  model: string;
  capacities: string[];
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

export interface CartItemRecord {
  products: Product | string;
  capacity?: string;
  quantity: number;
  price: number;
}

export interface CartRecord {
  _id?: string;
  user: string;
  cartItem: CartItemRecord[];
  bill: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface CartLine {
  id: string;
  productId: string;
  name: string;
  price: number;
  image: string;
  quantity: number;
  capacity?: string;
  availableQuantity?: number;
}

export interface OrderRecord {
  _id: string;
  user: string;
  orderItem: CartItemRecord[];
  bill: number;
  paymentStatus: "pending" | "paid";
  orderStatus: "created" | "processing" | "completed" | "cancelled";
  paymentReference: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface GuestCheckoutGuest {
  fullName: string;
  email: string;
  whatsappPhoneNumber: string;
  callPhoneNumber?: string;
  address: string;
  state: string;
}

export interface GuestCheckoutRecord {
  _id: string;
  guest: GuestCheckoutGuest;
  orderItem: CartItemRecord[];
  bill: number;
  paymentStatus: "pending" | "paid";
  orderStatus: "created" | "processing" | "completed" | "cancelled";
  paymentReference: string;
  createdAt?: string;
  updatedAt?: string;
}

export type CheckoutRecord = OrderRecord | GuestCheckoutRecord;

export type UserSessionStatus = "online" | "idle" | "offline" | "logged_out" | "expired";

export interface UserSessionScreen {
  width: number;
  height: number;
  pixelRatio: number;
}

export interface UserSessionUtm {
  source: string;
  medium: string;
  campaign: string;
  term: string;
  content: string;
}

export interface UserSessionRecord {
  sessionId: string;
  loginAt: string | null;
  lastSeenAt: string | null;
  logoutAt: string | null;
  tokenExpiresAt: string | null;
  status: UserSessionStatus;
  lastEvent: string;
  lastPath: string;
  lastVisibilityState: string;
  lastOnlineState: boolean;
  ipAddress: string;
  userAgent: string;
  deviceType: string;
  browser: string;
  os: string;
  platform: string;
  language: string;
  timezone: string;
  referrer: string;
  screen: UserSessionScreen;
  utm: UserSessionUtm;
  user?: Pick<User, "_id" | "userName" | "email" | "role">;
}

export interface UserSessionSummaryBreakdownEntry {
  label: string;
  count: number;
}

export interface UserSessionSummary {
  overview: {
    totalSessions: number;
    onlineCount: number;
    idleCount: number;
    offlineCount: number;
    loggedOutCount: number;
    expiredCount: number;
    activeUsers: number;
  };
  breakdowns: {
    browsers: UserSessionSummaryBreakdownEntry[];
    deviceTypes: UserSessionSummaryBreakdownEntry[];
    operatingSystems: UserSessionSummaryBreakdownEntry[];
  };
  recentSessions: UserSessionRecord[];
}

export interface UserSessionClientContext {
  userAgent?: string;
  platform?: string;
  language?: string;
  timezone?: string;
  referrer?: string;
  path?: string;
  visibilityState?: "visible" | "hidden" | "prerender";
  online?: boolean;
  screen?: Partial<UserSessionScreen>;
  utm?: Partial<UserSessionUtm>;
}

export interface AuthPayload {
  token: string;
  user: User;
  session: UserSessionRecord;
}

export type AssistantIntent = "trade_in" | "product" | "general" | "unknown";

export interface AssistantMessageRequest {
  sessionId?: string;
  message: string;
  userContext?: {
    productId?: string;
    route?: string;
  };
}

export interface AssistantToolUsage {
  name: string;
  ok: boolean;
}

export interface AssistantMessageResponse {
  sessionId: string;
  reply: string;
  intent: AssistantIntent;
  usedTools: AssistantToolUsage[];
}

export interface AssistantTimingStageStats {
  count: number;
  avgMs: number;
  maxMs: number;
  p95Ms: number;
  totalMs: number;
  shareOfAvgTotal: number;
}

export interface AssistantTimingStageNode {
  key: string;
  label: string;
  stats: AssistantTimingStageStats;
  children: AssistantTimingStageNode[];
}

export interface AssistantTimingSnapshot {
  sessionId: string;
  intent: AssistantIntent | string;
  source: "model" | "fallback";
  usedTools: string[];
  totalMs: number;
  marks: Array<{
    stage: string;
    durationMs: number;
  }>;
  createdAt: string;
}

export interface AssistantTimingSummary {
  overview: {
    totalRequests: number;
    avgTotalMs: number;
    p95TotalMs: number;
    maxTotalMs: number;
    modelCount: number;
    fallbackCount: number;
  };
  stageHierarchy: AssistantTimingStageNode[];
  recentSlowRequests: AssistantTimingSnapshot[];
}
