import RequireAuth from "@/components/auth/RequireAuth";

// Onboarding is a top-level route outside the (tabs) group, so it
// doesn't inherit the tabs layout's RequireAuth. Gate it here too so a
// direct link to /onboard can't bypass auth — sign-in always comes
// first, then the wizard sets up the local profile.
export default function OnboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <RequireAuth>{children}</RequireAuth>;
}
