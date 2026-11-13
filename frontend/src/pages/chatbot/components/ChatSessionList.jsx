import { MessageSquarePlus, Trash2, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export default function ChatSessionList({ sessions, activeSessionId, onSelect, onNew, onDelete, open, onClose }) {
  const { t } = useTranslation();
  return (
    <>
      {open && (
        <div className="fixed inset-0 z-40 bg-black/40 md:hidden" onClick={onClose} />
      )}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-72 shrink-0 border-r bg-card transition-transform md:static md:z-auto md:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex items-center justify-between border-b p-3">
          <h2 className="font-display text-lg">{t("chatbot.conversations")}</h2>
          <button onClick={onClose} className="md:hidden">
            <X className="h-5 w-5 text-muted-foreground" />
          </button>
        </div>

        <div className="p-3">
          <Button variant="outline" className="w-full justify-start gap-2" onClick={onNew}>
            <MessageSquarePlus className="h-4 w-4" />
            {t("chatbot.newConversation")}
          </Button>
        </div>

        <div className="flex flex-col gap-1 overflow-y-auto px-2 pb-4" style={{ maxHeight: "calc(100vh - 130px)" }}>
          {sessions.length === 0 && (
            <p className="px-2 py-4 text-center text-sm text-muted-foreground">
              {t("chatbot.noConversations")}
            </p>
          )}

          {sessions.map((session) => (
            <button
              key={session.id}
              onClick={() => onSelect(session.id)}
              className={cn(
                "group flex items-center justify-between rounded-xl px-3 py-2.5 text-left text-sm transition-colors",
                session.id === activeSessionId ? "bg-primary/10 text-primary" : "hover:bg-muted"
              )}
            >
              <span className="truncate">{session.title}</span>
              <span
                role="button"
                tabIndex={-1}
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(session.id);
                }}
                className="ml-2 shrink-0 rounded-md p-1 text-muted-foreground opacity-0 hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </span>
            </button>
          ))}
        </div>
      </aside>
    </>
  );
}
