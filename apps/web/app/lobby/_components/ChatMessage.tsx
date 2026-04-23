import type { ChatMessage as ChatMessageType } from "../_hooks/useLobbyChat";

interface Props {
  message: ChatMessageType;
  isOwn: boolean;
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function ChatMessage({ message, isOwn }: Props) {
  const { users, content, created_at } = message;
  const initials = users.username.slice(0, 2).toUpperCase();

  return (
    <div className="flex items-start gap-2 px-3 py-1.5 hover:bg-zinc-800/40 group">
      <div
        className="w-6 h-6 rounded-full shrink-0 flex items-center justify-center text-white text-[10px] font-bold mt-0.5"
        style={{ backgroundColor: users.avatar_color }}
        title={users.username}
      >
        {initials}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2">
          <span
            className="text-sm font-semibold"
            style={{ color: isOwn ? users.avatar_color : "white" }}
          >
            {users.username}
          </span>
          <span className="text-[10px] text-zinc-600 opacity-0 group-hover:opacity-100 transition-opacity">
            {formatTime(created_at)}
          </span>
        </div>
        <p className="text-sm text-zinc-300 break-words whitespace-pre-wrap leading-relaxed">
          {content}
        </p>
      </div>
    </div>
  );
}
