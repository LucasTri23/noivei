import AuthBrandPanel from '@/components/auth/auth-brand-panel'

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="flex min-h-screen items-center justify-center"
      style={{ background: '#FAF6F2', padding: 'clamp(0px, 3vw, 40px)' }}
    >
      <div
        className="flex w-full overflow-hidden bg-white"
        style={{
          maxWidth: '1000px',
          borderRadius: 'clamp(0px, 2vw, 28px)',
          boxShadow: '0 30px 70px rgba(30,42,74,0.14)',
          minHeight: '600px',
        }}
      >
        <AuthBrandPanel />
        <div
          className="flex flex-1 flex-col justify-center"
          style={{
            flexBasis: '440px',
            padding: 'clamp(30px, 4.5vw, 56px)',
          }}
        >
          {children}
        </div>
      </div>
    </div>
  )
}
