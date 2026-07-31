import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabasePublishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

const missing: string[] = []
if (!supabaseUrl) missing.push('VITE_SUPABASE_URL')
if (!supabasePublishableKey) missing.push('VITE_SUPABASE_PUBLISHABLE_KEY')

if (missing.length > 0) {
  throw new Error(
    `Faltan variables de entorno de Supabase: ${missing.join(', ')}. ` +
      'Copia /app/.env.example a /app/.env y rellena los valores reales.',
  )
}

export const supabase = createClient(supabaseUrl, supabasePublishableKey)
