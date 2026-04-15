"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

export default function HomePage(): React.JSX.Element {
  const router = useRouter();

  React.useEffect(() => {
    const token = window.localStorage.getItem("aicc_token");
    router.replace(token ? "/dashboard" : "/login");
  }, [router]);

  return <></>;
}
