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

export const defaultSwapConditionSelections: SwapConditionSelections = {
  overallCondition: "excellent",
  screenCondition: "original",
  batteryCondition: "90-plus",
  faceIdStatus: "original",
  cameraStatus: "original",
};

export const overallConditionOptions = ["excellent", "good", "fair", "poor"] as const;
export const screenConditionOptions = ["original", "scratched", "cracked", "changed-screen"] as const;
export const batteryConditionOptions = ["90-plus", "80-89", "79-75", "changed-battery"] as const;
export const faceIdStatusOptions = ["original", "no-face-id"] as const;
export const cameraStatusOptions = ["original", "changed", "rear-fault", "front-fault", "both-faulty"] as const;

export const resolveSwapConditionSelections = (
  selections: Partial<SwapConditionSelections> | null | undefined,
): SwapConditionSelections | null => {
  const resolvedSelections: SwapConditionSelections = {
    ...defaultSwapConditionSelections,
    ...(selections ?? {}),
  };

  if (!overallConditionOptions.includes(resolvedSelections.overallCondition)) {
    return null;
  }

  if (!screenConditionOptions.includes(resolvedSelections.screenCondition)) {
    return null;
  }

  if (!batteryConditionOptions.includes(resolvedSelections.batteryCondition)) {
    return null;
  }

  if (!faceIdStatusOptions.includes(resolvedSelections.faceIdStatus)) {
    return null;
  }

  if (!cameraStatusOptions.includes(resolvedSelections.cameraStatus)) {
    return null;
  }

  return resolvedSelections;
};

export const universalFaultRules = {
  noFaceId: 25,
  changedCamera: 10,
  rearCameraFault: 10,
  frontCameraFault: 10,
  bothCamerasFaulty: 15,
  batteryBelow80: 10,
  batteryBelow75: 15,
  changedBattery: 20,
  scratchedScreen: 8,
  crackedScreen: 15,
  roughBody: 18,
} as const;

export const stackPenaltyRules = {
  majorFaults: [
    "noFaceId",
    "changedBattery",
    "changedScreen",
    "crackedScreen",
    "roughBody",
    "changedCamera",
    "rearCameraFault",
    "frontCameraFault",
    "bothCamerasFaulty",
  ] as const,
  twoMajorFaultsExtraDeductionPercent: 5,
  threeOrMoreMajorFaultsExtraDeductionPercent: 10,
} as const;

export const changedScreenRules = {
  legacy: {
    models: ["iPhone XR", "iPhone XS", "iPhone XS Max", "iPhone 11", "iPhone 12", "iPhone 12 Mini"],
    deductionPercent: 22,
  },
  baseModern: {
    models: [
      "iPhone 13",
      "iPhone 13 Mini",
      "iPhone 14",
      "iPhone 14 Plus",
      "iPhone 15",
      "iPhone 15 Plus",
      "iPhone 16",
      "iPhone 16 Plus",
      "iPhone 17",
    ],
    deductionPercent: 25,
  },
  premium: {
    models: [
      "iPhone 11 Pro",
      "iPhone 11 Pro Max",
      "iPhone 12 Pro",
      "iPhone 12 Pro Max",
      "iPhone 13 Pro",
      "iPhone 13 Pro Max",
      "iPhone 14 Pro",
      "iPhone 14 Pro Max",
      "iPhone 15 Pro",
      "iPhone 15 Pro Max",
      "iPhone 16 Pro",
      "iPhone 16 Pro Max",
      "iPhone 17 Pro",
      "iPhone 17 Pro Max",
    ],
    deductionPercent: 30,
  },
} as const;

export const maxSwapConditionDeductionRate = 0.8;
