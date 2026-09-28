import { requireUser } from '@/lib/auth';
import { requirePagePermission } from '@/lib/rbac';
import { prisma } from '@/lib/db';
import { FOLLOW_UP_CHIPS } from '@/lib/ai/engine';
import { ChatClient, type ChatConversation } from './ChatClient';

function greetingFor(role: string, childNames: string[], firstName: string): string {
  switch (role) {
    case 'PARENT': {
      const names =
        childNames.length === 1
          ? childNames[0]
          : childNames.length === 2
            ? `${childNames[0]} and ${childNames[1]}`
            : childNames.slice(0, 2).join(', ') + ` and ${childNames.length - 2} more`;
      return childNames.length > 0
        ? `Ask me about ${names}'s attendance, arrival time, fees or results — I'll check the school records.`
        : 'Ask me anything — once your children are linked to your account I can look up their records.';
    }
    case 'STUDENT':
      return `Ask about your own attendance, or ask me to explain any study topic.`;
    case 'TEACHER':
      return `Ask about your schedule today or absentees in your classes — straight from the school records.`;
    case 'SUPER_ADMIN':
    case 'PRINCIPAL':
      return `Ask for school stats, open conflicts, fee defaulters or pending submissions — all from live records.`;
    case 'STAFF':
      return `Ask about fee defaulters, or anything I can look up for you, ${firstName}.`;
    default:
      return `Ask me anything — I'll check the school records.`;
  }
}

export default async function AiPage() {
  const user = await requireUser();
  requirePagePermission(user.role, 'ai.use');

  const [conversations, parent] = await Promise.all([
    prisma.aiConversation.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: { _count: { select: { messages: true } } },
    }),
    user.role === 'PARENT'
      ? prisma.parent.findUnique({
          where: { userId: user.id },
          include: { children: { include: { student: true } } },
        })
      : Promise.resolve(null),
  ]);

  const initial: ChatConversation[] = conversations.map((c) => ({
    id: c.id,
    title: c.title,
    createdAt: c.createdAt.toISOString(),
    messageCount: c._count.messages,
  }));

  const childNames = parent ? parent.children.map((c) => c.student.name) : [];
  const firstName = user.name.split(' ')[0] ?? user.name;

  return (
    <ChatClient
      role={user.role}
      greeting={greetingFor(user.role, childNames, firstName)}
      chips={FOLLOW_UP_CHIPS[user.role]}
      initialConversations={initial}
    />
  );
}
