'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ONBOARDING_STEPS } from '@/features/onboarding/content/onboarding-steps';
import { useOnboardingStore } from '@/store/onboarding-store';
import { useAuthStore } from '@/store/auth-store';
import { cn } from '@/lib/utils';

export function OnboardingWalkthrough() {
  const pathname = usePathname();
  const user = useAuthStore((s) => s.user);
  const hydrated = useAuthStore((s) => s.hydrated);
  const isOpen = useOnboardingStore((s) => s.isOpen);
  const currentStep = useOnboardingStore((s) => s.currentStep);
  const nextStep = useOnboardingStore((s) => s.nextStep);
  const prevStep = useOnboardingStore((s) => s.prevStep);
  const dismissOnboarding = useOnboardingStore((s) => s.dismissOnboarding);
  const completeOnboarding = useOnboardingStore((s) => s.completeOnboarding);

  const isAdminRoute = pathname.startsWith('/admin');
  const isAuthRoute =
    pathname.startsWith('/login') ||
    pathname.startsWith('/register') ||
    pathname.startsWith('/admin/login') ||
    pathname.startsWith('/admin/register');

  const shouldRender =
    hydrated &&
    Boolean(user) &&
    user?.role !== 'ADMIN' &&
    !isAdminRoute &&
    !isAuthRoute;

  if (!shouldRender) {
    return null;
  }

  const step = ONBOARDING_STEPS[currentStep] ?? ONBOARDING_STEPS[0];
  const StepIcon = step.icon;
  const isLastStep = currentStep >= ONBOARDING_STEPS.length - 1;

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) {
          dismissOnboarding();
        }
      }}
    >
      <DialogContent
        data-testid="onboarding-walkthrough"
        showCloseButton={false}
        className="max-w-md sm:max-w-lg"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10">
            <StepIcon className="h-6 w-6 text-primary" />
          </div>
          <DialogTitle className="text-center text-xl">{step.title}</DialogTitle>
          <DialogDescription className="text-center text-sm leading-relaxed">
            {step.description}
          </DialogDescription>
        </DialogHeader>

        <div
          className="flex items-center justify-center gap-2 py-2"
          data-testid="onboarding-step-indicator"
        >
          {ONBOARDING_STEPS.map((_, index) => (
            <span
              key={index}
              className={cn(
                'h-2 w-2 rounded-full transition-colors',
                index === currentStep ? 'bg-primary' : 'bg-muted-foreground/30',
              )}
              aria-hidden
            />
          ))}
        </div>

        {step.ctaHref && step.ctaLabel ? (
          <div className="flex justify-center">
            <Button variant="outline" size="sm" asChild>
              <Link href={step.ctaHref}>{step.ctaLabel}</Link>
            </Button>
          </div>
        ) : null}

        <DialogFooter className="flex-row justify-between gap-2 sm:justify-between">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            data-testid="onboarding-skip"
            onClick={() => dismissOnboarding()}
          >
            Skip tour
          </Button>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              data-testid="onboarding-back"
              disabled={currentStep === 0}
              onClick={() => prevStep()}
            >
              Back
            </Button>
            <Button
              type="button"
              size="sm"
              data-testid="onboarding-next"
              onClick={() => {
                if (isLastStep) {
                  completeOnboarding();
                } else {
                  nextStep();
                }
              }}
            >
              {isLastStep ? 'Get started' : 'Next'}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
