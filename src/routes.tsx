import type { ReactNode } from "react";
import { Routes, Route, Navigate } from "react-router-dom";

import RouteGuard from "@/components/common/RouteGuard";
import MainLayout from "@/components/layouts/MainLayout";

import LoginPage from "@/pages/LoginPage";
import RegisterPage from "@/pages/RegisterPage";
import FeedPage from "@/pages/FeedPage";
import ProfilePage from "@/pages/ProfilePage";
import MessagesPage from "@/pages/MessagesPage";
import NotificationsPage from "@/pages/NotificationsPage";
import SearchPage from "@/pages/SearchPage";
import SettingsPage from "@/pages/SettingsPage";
import GroupsPage from "@/pages/GroupsPage";
import GroupDetailPage from "@/pages/GroupDetailPage";
import CallsPage from "@/pages/CallsPage";

type ProtectedProps = {
  children: ReactNode;
};

function Protected({ children }: ProtectedProps) {
  return (
    <RouteGuard>
      <MainLayout>{children}</MainLayout>
    </RouteGuard>
  );
}

export default function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />

      <Route
        path="/"
        element={
          <Protected>
            <FeedPage />
          </Protected>
        }
      />

      <Route
        path="/profile/:id"
        element={
          <Protected>
            <ProfilePage />
          </Protected>
        }
      />

      <Route
        path="/messages"
        element={
          <Protected>
            <MessagesPage />
          </Protected>
        }
      />

      <Route
        path="/notifications"
        element={
          <Protected>
            <NotificationsPage />
          </Protected>
        }
      />

      <Route
        path="/search"
        element={
          <Protected>
            <SearchPage />
          </Protected>
        }
      />

      <Route
        path="/settings"
        element={
          <Protected>
            <SettingsPage />
          </Protected>
        }
      />

      <Route
        path="/groups"
        element={
          <Protected>
            <GroupsPage />
          </Protected>
        }
      />

      <Route
        path="/groups/:id"
        element={
          <Protected>
            <GroupDetailPage />
          </Protected>
        }
      />

      <Route
        path="/calls"
        element={
          <Protected>
            <CallsPage />
          </Protected>
        }
      />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}