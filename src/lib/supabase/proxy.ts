import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PROTECTED = [
  "/dashboard",
  "/resumes",
  "/versions",
  "/history",
  "/billing",
  "/settings",
];

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll(list) {
          list.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          list.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // Validates the JWT with Supabase Auth and refreshes the session cookies.
  const { data } = await supabase.auth.getClaims();
  const signedIn = Boolean(data?.claims);
  const path = request.nextUrl.pathname;

  if (
    !signedIn &&
    PROTECTED.some((p) => path === p || path.startsWith(`${p}/`))
  ) {
    const url = request.nextUrl.clone();
    url.pathname = "/auth/login";
    url.search = "";
    return NextResponse.redirect(url);
  }
  if (signedIn && (path === "/auth/login" || path === "/auth/signup")) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }
  return response;
}
