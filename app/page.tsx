import CrmApp from '@/components/crm-app'
import { createClient } from '@/lib/supabase/server'

export default async function Page() {
  const supabase = await createClient()
  const { data } = await supabase.auth.getClaims()
  return <CrmApp email={data?.claims.email ?? ''} />
}
