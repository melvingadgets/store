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
    `${params.tradeInModel} - ${params.tradeInStorage}`,
    `Overall: ${params.conditionSelections.overallCondition}`,
    `Screen: ${params.conditionSelections.screenCondition}`,
    `Battery: ${params.conditionSelections.batteryCondition}`,
    `Face ID: ${params.conditionSelections.faceIdStatus}`,
    `Camera: ${params.conditionSelections.cameraStatus}`,
    ``,
    `*Estimate:*`,
    `Trade-in credit: ${formatPrice(params.evaluation.customerEstimateMin)} - ${formatPrice(params.evaluation.customerEstimateMax)}`,
    `Balance to pay: ${formatPrice(params.evaluation.estimatedBalanceMin)} - ${formatPrice(params.evaluation.estimatedBalanceMax)}`,
  ]

  return lines.join('\n')
}

export const buildSwapWhatsAppUrl = (phoneNumber: string, params: SwapMessageParams): string => {
  const text = encodeURIComponent(buildSwapWhatsAppMessage(params))
  const cleanPhone = phoneNumber.replace(/[^0-9]/g, '')
  return `https://wa.me/${cleanPhone}?text=${text}`
}
