import type { ReactNode } from "react";
import { Navbar } from "./Navbar";

type MainLayoutProps = {
  children: ReactNode;
};

function MainLayout({ children }: MainLayoutProps) {
  return (
    <div className="app-shell">
      <Navbar />

      <main className="mx-auto max-w-7xl px-3 pb-8 pt-4 md:px-5 md:pt-6">
        {children}
      </main>
    </div>
  );
}

export default MainLayout;