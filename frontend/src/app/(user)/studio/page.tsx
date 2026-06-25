import { Suspense } from "react";

import { StudioPageClient } from "./studio-page-client";

function StudioFallback(): React.JSX.Element {
  return <div className="h-screen w-screen bg-[#0B0D14]" />;
}

export default function StudioPage(): React.JSX.Element {
  return (
    <Suspense fallback={<StudioFallback />}>
      <StudioPageClient />
    </Suspense>
  );
}
