import { AuthScreen } from './components/AuthScreen'
import { Dashboard } from './components/Dashboard'
import { DesignSystemPreview } from './components/DesignSystemPreview'
import { useSession } from './hooks/useSession'

function App() {
  const { session, loading } = useSession()

  // Vista temporal de revisión visual (Paso 1 de 5, ver DesignSystemPreview),
  // sin sesión requerida a propósito para poder enseñarla sin tener que
  // iniciar sesión primero. Se retira cuando el sistema de diseño se aplique
  // a las pantallas reales.
  if (window.location.pathname === '/design-system') {
    return <DesignSystemPreview />
  }

  if (loading) {
    return (
      <main>
        <p>Cargando...</p>
      </main>
    )
  }

  if (!session) {
    return <AuthScreen />
  }

  return <Dashboard userId={session.user.id} />
}

export default App
