import RequireAuth from "@/components/auth/RequireAuth";

// Search sits outside the (tabs) group so the bottom nav doesn't crowd
// the keyboard on mobile. RequireAuth has to be re-applied here since
// only the tabs layout supplies it by default.
export default function SearchLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <RequireAuth>{children}</RequireAuth>;
}
