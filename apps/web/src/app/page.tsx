// apps/web/src/app/page.tsx
import { createClient } from "@/lib/supabase/server";

export default async function Home() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getSession();

  return (
    <div>
      <h1>Accomplete</h1>
      <p>Supabase connected: {error ? "❌ " + error.message : "✅"}</p>
    </div>
  );
}