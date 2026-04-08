export default function AuthLayout({ children }: { children: React.ReactNode }): React.JSX.Element {
  return (
    <div className="relative min-h-screen overflow-hidden bg-background">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_12%_8%,hsl(var(--primary)/0.2),transparent_32%),radial-gradient(circle_at_92%_92%,hsl(var(--secondary)/0.3),transparent_38%)]" />
      <div className="absolute inset-0 bg-[linear-gradient(to_bottom,transparent_0%,hsl(var(--background))_100%)]" />
      <div className="relative mx-auto flex min-h-screen w-full max-w-6xl items-center justify-center px-4 py-10">
        {children}
      </div>
    </div>
  );
}
