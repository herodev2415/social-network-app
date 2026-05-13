import * as React from "react";
import { cn } from "@/lib/utils";

export function Sheet({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

export function SheetTrigger({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

export function SheetContent({ className, children }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("fixed right-0 top-0 z-50 h-full w-72 border-l bg-background p-4 shadow-lg", className)}>
      {children}
    </div>
  );
}

export function SheetHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("mb-4", className)} {...props} />;
}

export function SheetTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h2 className={cn("text-lg font-semibold", className)} {...props} />;
}
