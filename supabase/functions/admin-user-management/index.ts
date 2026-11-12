// Admin user management: create, resetPassword, delete
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

function response(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });

  try {
    const authorization = req.headers.get("Authorization");
    if (!authorization?.startsWith("Bearer ")) return response({ error: "Unauthorized" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !anonKey || !serviceRoleKey) return response({ error: "Service unavailable" }, 503);

    const token = authorization.slice("Bearer ".length);
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authorization } },
    });
    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const { data: userData, error: userError } = await userClient.auth.getUser(token);
    if (userError || !userData.user) return response({ error: "Unauthorized" }, 401);

    const { data: caller, error: callerError } = await adminClient
      .from("profiles")
      .select("id, role")
      .eq("id", userData.user.id)
      .maybeSingle();
    if (callerError || !caller || !["admin", "md"].includes(caller.role)) {
      return response({ error: "Not authorized" }, 403);
    }

    const body = await req.json();
    const action = body?.action;

    if (action === "create") {
      const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
      const password = typeof body.password === "string" ? body.password : "";
      const fullName = typeof body.fullName === "string" ? body.fullName.trim() : "";
      const role = typeof body.role === "string" ? body.role : "";
      const department = typeof body.department === "string" ? body.department : "";
      const title = typeof body.title === "string" ? body.title.trim() : "";
      const allowedRoles = ["md", "manager", "supervisor", "assistant", "storekeeper", "staff"];

      if (!email || !fullName || !department || !allowedRoles.includes(role) || password.length < 8) {
        return response({ error: "Please check the account details." }, 400);
      }
      if (role === "md" && caller.role !== "admin") return response({ error: "Not authorized" }, 403);
      if (role === "md") {
        const { count } = await adminClient.from("profiles").select("id", { count: "exact", head: true }).eq("role", "md");
        if ((count ?? 0) > 0) return response({ error: "An MD account already exists." }, 409);
      }

      const { data: created, error: createError } = await adminClient.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name: fullName },
      });
      if (createError || !created.user) return response({ error: "Could not create the user." }, 400);

      const { data: profile, error: profileError } = await adminClient
        .from("profiles")
        .insert({
          id: created.user.id,
          full_name: fullName,
          email,
          role,
          department,
          title: title || role,
          active: true,
        })
        .select("*")
        .maybeSingle();
      if (profileError || !profile) {
        await adminClient.auth.admin.deleteUser(created.user.id);
        return response({ error: "Could not create the user." }, 400);
      }
      return response({ profile });
    }

    if (action === "resetPassword") {
      const profileId = typeof body.profileId === "string" ? body.profileId : "";
      const newPassword = typeof body.password === "string" ? body.password : "";
      if (!profileId || newPassword.length < 8) {
        return response({ error: "The new password must be at least 8 characters." }, 400);
      }
      if (profileId === userData.user.id) {
        return response({ error: "Use your own account settings to change your own password." }, 400);
      }
      const { data: target, error: targetError } = await adminClient
        .from("profiles")
        .select("id, role")
        .eq("id", profileId)
        .maybeSingle();
      if (targetError || !target) return response({ error: "That account could not be found." }, 400);
      if (target.role === "md" && caller.role !== "admin") {
        return response({ error: "Not authorized" }, 403);
      }
      const { error: updateError } = await adminClient.auth.admin.updateUserById(profileId, {
        password: newPassword,
      });
      if (updateError) return response({ error: "Could not reset the password." }, 400);
      return response({ ok: true });
    }

    if (action === "delete") {
      const profileId = typeof body.profileId === "string" ? body.profileId : "";
      if (!profileId || profileId === userData.user.id) return response({ error: "That account cannot be deleted." }, 400);
      const { data: target, error: targetError } = await adminClient
        .from("profiles")
        .select("id, role")
        .eq("id", profileId)
        .maybeSingle();
      if (targetError || !target || target.role === "admin") return response({ error: "That account cannot be deleted." }, 400);
      if (target.role === "md" && caller.role !== "admin") return response({ error: "Not authorized" }, 403);
      const { error: deleteError } = await adminClient.auth.admin.deleteUser(profileId);
      if (deleteError) return response({ error: "Could not delete the account." }, 400);
      return response({ ok: true });
    }

    return response({ error: "Invalid request." }, 400);
  } catch (error) {
    console.error("admin-user-management failed", error);
    return response({ error: "Service unavailable" }, 500);
  }
});
