import React, { createContext, useContext, useEffect, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "./AuthProvider";
import { apiBaseUrl } from "../api/axios";
import { queryKeys } from "../lib/queryKeys";
import type { Notification } from "../features/notifications/api/notifications.api";

type NotificationSocketContextType = {
  /** Most recently received live notification — consumed by NotificationBell for a toast-style flash; not a running log (see the query cache for that). */
  lastNotification: Notification | null;
};

const NotificationSocketContext = createContext<NotificationSocketContextType>({
  lastNotification: null,
});

/**
 * Opens one socket.io connection per logged-in session (cookie-authenticated,
 * same as the axios instance) and keeps every organization's cached
 * notification list current as events arrive — independent of which
 * organization the user is currently viewing, since the server always
 * resolves a concrete recipient user id before emitting (see
 * backend/src/realtime/socket.ts's per-user rooms).
 */
export const NotificationSocketProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { user } = useAuth();
  const userId = user?.id;
  const queryClient = useQueryClient();
  const socketRef = useRef<Socket | null>(null);
  const [lastNotification, setLastNotification] = useState<Notification | null>(null);

  // Depends only on the user id (not the whole `user` object, which gets a
  // fresh identity on every organization switch via the /api/me refetch in
  // AuthProvider.selectOrganization) — otherwise switching organizations
  // would needlessly tear down and reopen the socket connection.
  useEffect(() => {
    if (!userId) {
      socketRef.current?.disconnect();
      socketRef.current = null;
      return;
    }

    const socket = io(apiBaseUrl, {
      withCredentials: true,
      transports: ["websocket", "polling"],
    });
    socketRef.current = socket;

    socket.on("notification:new", (notification: Notification) => {
      setLastNotification(notification);
      const wsId = notification.organizationId;
      if (wsId == null) return;
      queryClient.setQueryData<Notification[]>(queryKeys.notifications(wsId), (prev) =>
        prev ? [notification, ...prev] : [notification],
      );
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [userId, queryClient]);

  return (
    <NotificationSocketContext.Provider value={{ lastNotification }}>
      {children}
    </NotificationSocketContext.Provider>
  );
};

export const useNotificationSocket = () => useContext(NotificationSocketContext);
