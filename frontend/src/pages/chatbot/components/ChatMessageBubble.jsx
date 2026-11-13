import { Bot, User, Volume2, Info } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";

export default function ChatMessageBubble({ message }) {
  const { t } = useTranslation();
  const isUser = message.role === "user";

  return (
    <div className={cn("flex gap-3", isUser ? "flex-row-reverse" : "flex-row")}>
      <div
        className={cn(
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
          isUser ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground"
        )}
      >
        {isUser ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
      </div>

      <div className={cn("flex max-w-[80%] flex-col gap-1", isUser ? "items-end" : "items-start")}>
        <div
          className={cn(
            "whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-sm leading-relaxed shadow-sm",
            isUser
              ? "rounded-tr-sm bg-primary text-primary-foreground"
              : "rounded-tl-sm bg-card text-card-foreground border"
          )}
        >
          {message.content}
        </div>

        <div className="flex items-center gap-2 px-1 text-[11px] text-muted-foreground">
          {message.input_via_voice && <Volume2 className="h-3 w-3" />}
          {!isUser && message.is_stub_response && (
            <span className="flex items-center gap-1 text-warning">
              <Info className="h-3 w-3" /> {t("chatbot.demoMode")}
            </span>
          )}
          {!isUser && !message.is_stub_response && message.llm_provider && (
            <span className="capitalize">{t("chatbot.via", { provider: message.llm_provider })}</span>
          )}
        </div>
      </div>
    </div>
  );
}
