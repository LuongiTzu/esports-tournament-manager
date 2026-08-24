"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { io, type Socket } from "socket.io-client";
import { useAuth } from "@/features/auth/store";
import type { NotificationRecord } from "@/features/notifications/types";
import {
  TOURNAMENT_REALTIME_EVENTS,
  type NotificationRealtimeListener,
  type TournamentRealtimeEvent,
  type TournamentRealtimeListener,
} from "@/features/realtime/types";
import { API_BASE_URL } from "@/lib/api/client";
import { tokenStore } from "@/lib/api/token-store";

interface RealtimeContextValue {
  subscribeNotifications: (
    listener: NotificationRealtimeListener,
  ) => () => void;
  subscribeTournament: (
    tournamentId: string,
    listener: TournamentRealtimeListener,
  ) => () => void;
}

const RealtimeContext = createContext<RealtimeContextValue | null>(null);

function getAccessTokenSnapshot() {
  return tokenStore.accessToken;
}

function getSocketOrigin() {
  return new URL(API_BASE_URL, window.location.origin).origin;
}

export function RealtimeProvider({ children }: { children: ReactNode }) {
  const { ready } = useAuth();
  const accessToken = useSyncExternalStore(
    tokenStore.subscribeAccessToken,
    getAccessTokenSnapshot,
    () => null,
  );
  const socketRef = useRef<Socket | null>(null);
  const notificationListeners = useRef(new Set<NotificationRealtimeListener>());
  const tournamentListeners = useRef(
    new Map<string, Set<TournamentRealtimeListener>>(),
  );
  const deliveredNotificationIds = useRef(new Set<string>());

  const joinActiveTournamentRooms = useCallback((socket: Socket) => {
    tournamentListeners.current.forEach((_listeners, tournamentId) => {
      socket.emit("joinTournament", { tournamentId });
    });
  }, []);

  useEffect(() => {
    if (!ready) return;

    const socket = io(`${getSocketOrigin()}/tournaments`, {
      autoConnect: false,
      auth: accessToken ? { token: accessToken } : {},
      reconnection: true,
    });
    socketRef.current = socket;
    const deliveredNotificationIdsForSession = deliveredNotificationIds.current;

    const onConnect = () => joinActiveTournamentRooms(socket);
    const onNotification = (notification: NotificationRecord) => {
      if (!notification?.id) return;
      const delivered = deliveredNotificationIdsForSession;
      if (delivered.has(notification.id)) return;
      delivered.add(notification.id);
      if (delivered.size > 200) {
        const oldest = delivered.values().next().value;
        if (oldest) delivered.delete(oldest);
      }
      notificationListeners.current.forEach((listener) =>
        listener(notification),
      );
    };
    const tournamentHandlers = TOURNAMENT_REALTIME_EVENTS.map((event) => {
      const handler = () => {
        // Gateway payloads do not carry their room id. Only mounted tournament
        // subscribers are notified, then each view refetches its own read model.
        tournamentListeners.current.forEach((listeners) => {
          listeners.forEach((listener) => listener(event));
        });
      };
      socket.on(event, handler);
      return [event, handler] as const;
    });

    socket.on("connect", onConnect);
    socket.on("notification", onNotification);
    socket.connect();

    return () => {
      socket.off("connect", onConnect);
      socket.off("notification", onNotification);
      tournamentHandlers.forEach(([event, handler]) =>
        socket.off(event, handler),
      );
      socket.disconnect();
      if (socketRef.current === socket) socketRef.current = null;
      deliveredNotificationIdsForSession.clear();
    };
  }, [accessToken, joinActiveTournamentRooms, ready]);

  const subscribeNotifications = useCallback(
    (listener: NotificationRealtimeListener) => {
      notificationListeners.current.add(listener);
      return () => notificationListeners.current.delete(listener);
    },
    [],
  );

  const subscribeTournament = useCallback(
    (tournamentId: string, listener: TournamentRealtimeListener) => {
      const listeners =
        tournamentListeners.current.get(tournamentId) ??
        new Set<TournamentRealtimeListener>();
      const firstSubscriber = listeners.size === 0;
      listeners.add(listener);
      tournamentListeners.current.set(tournamentId, listeners);
      if (firstSubscriber && socketRef.current?.connected) {
        socketRef.current.emit("joinTournament", { tournamentId });
      }
      return () => {
        const current = tournamentListeners.current.get(tournamentId);
        current?.delete(listener);
        if (current?.size === 0)
          tournamentListeners.current.delete(tournamentId);
      };
    },
    [],
  );

  const value = useMemo<RealtimeContextValue>(
    () => ({ subscribeNotifications, subscribeTournament }),
    [subscribeNotifications, subscribeTournament],
  );

  return (
    <RealtimeContext.Provider value={value}>
      {children}
    </RealtimeContext.Provider>
  );
}

function useRealtime() {
  const context = useContext(RealtimeContext);
  if (!context)
    throw new Error("useRealtime must be used within RealtimeProvider");
  return context;
}

export function useNotificationRealtime(
  listener: NotificationRealtimeListener,
) {
  const { subscribeNotifications } = useRealtime();
  const listenerRef = useRef(listener);

  useEffect(() => {
    listenerRef.current = listener;
  }, [listener]);

  useEffect(
    () =>
      subscribeNotifications((notification) =>
        listenerRef.current(notification),
      ),
    [subscribeNotifications],
  );
}

export function useTournamentRealtime(
  tournamentId: string | undefined,
  listener: (event: TournamentRealtimeEvent) => void,
) {
  const { subscribeTournament } = useRealtime();
  const listenerRef = useRef(listener);

  useEffect(() => {
    listenerRef.current = listener;
  }, [listener]);

  useEffect(() => {
    if (!tournamentId) return;
    return subscribeTournament(tournamentId, (event) =>
      listenerRef.current(event),
    );
  }, [subscribeTournament, tournamentId]);
}
