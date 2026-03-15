import React from 'react'
import { Link, useLocation } from 'react-router-dom'

const NotFoundPage: React.FC = () => {
  const location = useLocation()

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
                <p className='ios-overline'>404</p>
                <h1 className='mt-3 text-[2.4rem] font-black leading-[0.95] tracking-[-0.04em] text-primaryText sm:text-[3.4rem]'>
                  Page not found
                </h1>
                <p className='ios-body-muted mt-4 max-w-xl text-[1rem] leading-7'>
                  The page you tried to open does not exist or is no longer available in this app.
                </p>
              </div>

              <div className='self-start rounded-[24px] border border-white/60 bg-white/60 px-4 py-3 text-left shadow-[0_12px_24px_rgba(17,33,62,0.08)]'>
                <p className='ios-caption uppercase'>Requested path</p>
                <p className='mt-2 break-all text-sm font-semibold text-primaryText'>{location.pathname}</p>
                <p className='ios-meta mt-1'>Status 404</p>
              </div>
            </div>

            <div className='grid gap-4 lg:grid-cols-[1.35fr_0.95fr]'>
              <div className='rounded-[28px] border border-white/60 bg-white/68 p-5 shadow-[0_14px_30px_rgba(17,33,62,0.08)]'>
                <p className='ios-card-title'>Where to go next</p>
                <div className='mt-4 flex flex-col gap-3 sm:flex-row'>
                  <Link to='/' className='ios-primary-button w-full justify-center sm:w-auto'>
                    Go home
                  </Link>
                  <Link to='/product' className='ios-secondary-button w-full justify-center sm:w-auto'>
                    Browse products
                  </Link>
                </div>
                <p className='ios-meta mt-4'>
                  If you followed an old bookmark or link, start again from the home page or product list.
                </p>
              </div>

              <div className='rounded-[28px] border border-white/60 bg-[rgba(11,33,58,0.92)] p-5 text-white shadow-[0_14px_30px_rgba(17,33,62,0.18)]'>
                <p className='text-xs font-semibold uppercase tracking-[0.18em] text-white/60'>Navigation help</p>
                <p className='mt-3 text-sm leading-6 text-white/82'>
                  Signed-in users can still access account, history, and admin routes from valid links. Public routes include home, products, login, and register.
                </p>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}

export default NotFoundPage
