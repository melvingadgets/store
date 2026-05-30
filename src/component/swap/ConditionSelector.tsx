import type { SwapConditionOption, SwapConditionSelections } from '../../types/domain'

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

export const getConditionSummaryLabel = (
  factorKey: string,
  selections: SwapConditionSelections,
  options: SwapConditionOption<string>[],
) => {
  const selectedLabel = options.find((option) => option.value === selections[factorKey as keyof SwapConditionSelections])?.label
  return selectedLabel
}
