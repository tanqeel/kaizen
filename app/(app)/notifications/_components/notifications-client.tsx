'use client';

import { useCallback, useEffect, useState } from 'react';
import { Badge, Button, Card, CardContent, EmptyState, PageHeader, Tabs } from '@/components/ui';
import { Icon, type IconName } from '@/components/icons';
import { pktDateTime } from '@/lib/format';
import { safeJson } from '@/lib/api-client';

interface NotificationItem {
  id: string;
  type: string;
  message: string;
  sentAt: string;
  readAt: string | null;
}

const TYPE_META: Record<string, { label: string; icon: IconName }> = {
  ARRIVAL: { label: 'Arrival', icon: 'arrow-left' },
  DEPARTURE: { label: 'Departure', icon: 'arrow-left' },
  LECTURE_ABSENCE: { label: 'Absence', icon: 'alert-triangle' },
  FEE_REMINDER: { label: 'Fee reminder', icon: 'receipt-text' },
  ANNOUNCEMENT: { label: 'Announcement', icon: 'megaphone' },
};

export function NotificationsClient() {
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [tab, setTab] = useState('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [marking, setMarking] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/notifications', { cache: 'no-store' });
      if (!res.ok) throw new Error('Could not load notifications.');
      const data = await safeJson(res);
      setItems(Array.isArray(data.notifications) ? data.notifications : []);
      setUnreadCount(typeof data.unreadCount === 'number' ? data.unreadCount : 0);
    } catch {
      setError('Could not load notifications. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const markRead = async (id: string) => {
    setMarking(id);
    try {
      const res = await fetch(`/api/notifications/${id}/read`, { method: 'POST' });
      if (!res.ok) throw new Error();
      await load();
    } catch {
      setError('Could not mark the notification as read. Please try again.');
    } finally {
      setMarking(null);
    }
  };

  const markAllRead = async () => {
    try {
      const res = await fetch('/api/notifications/read-all', { method: 'POST' });
      if (!res.ok) throw new Error();
      await load();
    } catch {
      setError('Could not mark notifications as read. Please try again.');
    }
  };

  const remove = async (id: string) => {
    try {
      const res = await fetch(`/api/notifications/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error();
      await load();
    } catch {
      setError('Could not delete the notification. Please try again.');
    }
  };

  const visible = tab === 'unread' ? items.filter((n) => n.readAt === null) : items;

  return (
    <div>
      <PageHeader
        title="Notifications"
        subtitle={
          unreadCount > 0
            ? `${unreadCount} unread notification${unreadCount === 1 ? '' : 's'}.`
            : 'Your latest school updates.'
        }
        actions={
          unreadCount > 0 ? (
            <Button variant="secondary" size="sm" onClick={markAllRead}>
              <Icon name="check" size={14} /> Mark all read
            </Button>
          ) : undefined
        }
      />

      <Tabs
        tabs={[
          { id: 'all', label: 'All', icon: 'bell' },
          { id: 'unread', label: `Unread${unreadCount > 0 ? ` (${unreadCount})` : ''}`, icon: 'info' },
        ]}
        value={tab}
        onChange={setTab}
        className="mb-6"
      />

      {loading ? (
        <div className="space-y-3" aria-busy="true">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="h-24 animate-pulse rounded-xl bg-slate-100 dark:bg-slate-800"
            />
          ))}
        </div>
      ) : error ? (
        <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-300">
          <p>{error}</p>
          <Button variant="secondary" size="sm" onClick={load} className="mt-3">
            <Icon name="refresh-cw" size={14} /> Retry
          </Button>
        </div>
      ) : visible.length === 0 ? (
        <EmptyState
          icon="check"
          title="You're all caught up"
          guidance={
            tab === 'unread'
              ? 'No unread notifications. Switch to the All tab to see what you have read.'
              : 'Nothing here yet. Arrivals, fee reminders, and announcements will appear here.'
          }
        />
      ) : (
        <ul className="space-y-3">
          {visible.map((n) => {
            const unread = n.readAt === null;
            const meta = TYPE_META[n.type] ?? { label: n.type, icon: 'bell' as IconName };
            return (
              <li key={n.id}>
                <Card
                  className={
                    unread
                      ? 'border-l-4 border-l-brand-500 border-brand-200 bg-brand-50/50 dark:border-brand-500/40 dark:bg-brand-500/5'
                      : ''
                  }
                >
                  <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:gap-4">
                    <span
                      className={
                        'flex h-10 w-10 shrink-0 items-center justify-center rounded-full ' +
                        (unread
                          ? 'bg-brand-100 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300'
                          : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400')
                      }
                      aria-hidden="true"
                    >
                      <Icon name={meta.icon} size={18} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant={unread ? 'info' : 'neutral'}>{meta.label}</Badge>
                        <span className="text-xs text-slate-500 dark:text-slate-400">
                          {pktDateTime(n.sentAt)}
                        </span>
                      </div>
                      <p
                        className={
                          'mt-1 text-sm ' +
                          (unread
                            ? 'font-semibold text-slate-900 dark:text-white'
                            : 'text-slate-600 dark:text-slate-300')
                        }
                      >
                        {n.message}
                      </p>
                    </div>
                    {unread && (
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => markRead(n.id)}
                        disabled={marking === n.id}
                        className="shrink-0 self-start sm:self-center"
                      >
                        <Icon name="check" size={14} />
                        {marking === n.id ? 'Marking…' : 'Mark read'}
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => remove(n.id)}
                      aria-label="Delete notification"
                      title="Delete notification"
                      className="shrink-0 self-start text-slate-400 hover:text-rose-600 sm:self-center"
                    >
                      <Icon name="trash" size={14} />
                    </Button>
                  </CardContent>
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
