import React, { useMemo } from 'react'
import { Link, isRouteErrorResponse, useRouteError } from 'react-router-dom'

type ErrorPresentation = {
  title: string
  summary: string
  detail?: string
  statusLabel?: string
}

const toErrorPresentation = (error: unknown): ErrorPresentation => {
  if (isRouteErrorResponse(error)) {
    return {
      title: error.status === 404 ? 'Page not found' : 'Something went wrong',
      summary: typeof error.statusText === 'string' && error.statusText.trim()
        ? error.statusText
        : 'The app hit an unexpected route error.',
      detail: typeof error.data === 'string' ? error.data : undefined,
      statusLabel: `${error.status}`,
    }
  }

  if (error instanceof Error) {
    return {
      title: 'Unexpected application error',
      summary: 'A screen crashed before it could finish rendering.',
      detail: error.message,
    }
  }

  return {
    title: 'Unexpected application error',
    summary: 'A screen crashed before it could finish rendering.',
  }
}

const ErrorBoundaryPage: React.FC = () => {
  const routeError = useRouteError()
  const error = useMemo(() => toErrorPresentation(routeError), [routeError])
  const incidentCode = useMemo(
    () => `ERR-${new Date().toISOString().slice(0, 19).replace(/[-:T]/g, '')}`,
    [],
  )

  return (
    <div className='ios-mobile-shell min-h-screen px-4 py-8'>
      <div className='mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-4xl items-center justify-center'>
        <section className='relative w-full overflow-hidden rounded-[36px] border border-white/65 bg-[linear-gradient(145deg,rgba(255,255,255,0.92),rgba(228,238,248,0.74))] p-6 shadow-[0_24px_70px_rgba(17,33,62,0.16)] sm:p-9'>
          <div className='pointer-events-none absolute inset-0 opacity-90'>
            <div className='absolute -left-20 top-0 h-52 w-52 rounded-full bg-[rgba(8,96,164,0.12)] blur-3xl' />
            <div className='absolute bottom-0 right-0 h-56 w-56 rounded-full bg-[rgba(240,122,66,0.12)] blur-3xl' />
          </div>

          <div className='relative space-y-8'>
            <div className='flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between'>
              <div className='max-w-2xl'>
                <p className='ios-overline'>System fallback</p>
                <h1 className='mt-3 text-[2.4rem] font-black leading-[0.95] tracking-[-0.04em] text-primaryText sm:text-[3.4rem]'>
                  {error.title}
                </h1>
                <p className='ios-body-muted mt-4 max-w-xl text-[1rem] leading-7'>
                  {error.summary}
                </p>
              </div>

              <div className='self-start rounded-[24px] border border-white/60 bg-white/60 px-4 py-3 text-left shadow-[0_12px_24px_rgba(17,33,62,0.08)]'>
                <p className='ios-caption uppercase'>Incident</p>
                <p className='mt-2 text-lg font-bold tracking-[0.08em] text-primaryText'>{incidentCode}</p>
                {error.statusLabel ? (
                  <p className='ios-meta mt-1'>Status {error.statusLabel}</p>
                ) : null}
              </div>
            </div>

            <div className='grid gap-4 lg:grid-cols-[1.35fr_0.95fr]'>
              <div className='rounded-[28px] border border-white/60 bg-white/68 p-5 shadow-[0_14px_30px_rgba(17,33,62,0.08)]'>
                <p className='ios-card-title'>What you can do now</p>
                <div className='mt-4 flex flex-col gap-3 sm:flex-row'>
                  <button
                    type='button'
                    onClick={() => window.location.reload()}
                    className='ios-primary-button w-full justify-center sm:w-auto'
                  >
                    Reload page
                  </button>
                  <Link to='/' className='ios-secondary-button w-full justify-center sm:w-auto'>
                    Go home
                  </Link>
                </div>
                <p className='ios-meta mt-4'>
                  If this keeps happening, reopen the flow from the home page and note the incident code above.
                </p>
              </div>

              <div className='rounded-[28px] border border-white/60 bg-[rgba(11,33,58,0.92)] p-5 text-white shadow-[0_14px_30px_rgba(17,33,62,0.18)]'>
                <p className='text-xs font-semibold uppercase tracking-[0.18em] text-white/60'>Debug context</p>
                <p className='mt-3 text-sm leading-6 text-white/82'>
                  {error.detail ?? 'No extra error detail was exposed for this failure.'}
                </p>
                {import.meta.env.DEV && routeError instanceof Error && routeError.stack ? (
                  <pre className='mt-4 overflow-x-auto rounded-[20px] bg-white/8 p-3 text-[0.72rem] leading-5 text-white/70'>
                    {routeError.stack}
                  </pre>
                ) : null}
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}

export default ErrorBoundaryPage
