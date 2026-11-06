import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../auth/AuthProvider';
import { api } from './client';

export function useProfile() {
  const { userId, authenticated } = useAuth();
  return useQuery({ queryKey: ['me', userId], queryFn: ({ signal }) => api.me(signal), enabled: authenticated });
}

export function useOrders() {
  const { userId, authenticated } = useAuth();
  return useQuery({
    queryKey: ['orders', userId], queryFn: ({ signal }) => api.orders(signal),
    enabled: authenticated, refetchInterval: 10_000,
  });
}

export function useActivity() {
  const { userId, authenticated } = useAuth();
  return useQuery({
    queryKey: ['activity', userId], queryFn: ({ signal }) => api.activity(signal),
    enabled: authenticated, refetchInterval: 10_000,
  });
}

export function useOrder(id: string | undefined) {
  const { userId, authenticated } = useAuth();
  return useQuery({
    queryKey: ['order', userId, id], queryFn: ({ signal }) => api.order(id!, signal),
    enabled: authenticated && Boolean(id), refetchInterval: 10_000,
  });
}

export function useRefreshData() {
  const queryClient = useQueryClient();
  return async () => {
    await Promise.all(['orders', 'order', 'activity'].map((key) =>
      queryClient.invalidateQueries({ queryKey: [key] })));
  };
}
