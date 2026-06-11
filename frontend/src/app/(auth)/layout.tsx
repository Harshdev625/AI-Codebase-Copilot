'use client';

import * as React from 'react';
import { AuthLayout } from '@/features/auth/components/auth-layout';

export default function AuthRouteLayout({ children }: { children: React.ReactNode }) {
  return <AuthLayout>{children}</AuthLayout>;
}
