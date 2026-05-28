'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

/** Shimmer skeleton loader — uses the CSS shimmer animation from globals.css */
function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'rounded-xl shimmer',
        className
      )}
      {...props}
    />
  );
}

export { Skeleton };
