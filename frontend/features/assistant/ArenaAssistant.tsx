"use client";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  ArrowUpIcon,
  ArrowCounterClockwiseIcon,
  XIcon,
  SparkleIcon,
} from "@phosphor-icons/react";
import Link from "@/components/navigation/Link";
import { useAuth } from "@/features/auth/store";
import { useLocale } from "@/features/locale/store";
import { ApiError } from "@/lib/api/client";
import { chatWithArena, type ChatMessage } from "./api";
import { assistantPage, greetings } from "./context";
import ProposalCard from "./ProposalCard";
import styles from "./assistant.module.css";

const avatar = "/images/global/arena-assistant.png";
export default function ArenaAssistant() {
  const pathname = usePathname();
  const { user, ready } = useAuth();
  const context = assistantPage(pathname);
  if (!ready) return null;
  return (
    <AssistantChat
      key={`${user?.id ?? "guest"}:${context.slug ?? context.page}`}
      context={context}
    />
  );
}
function AssistantChat({
  context,
}: {
  context: ReturnType<typeof assistantPage>;
}) {
  const { locale } = useLocale();
  const vi = locale === "vi";
  const copy = greetings[locale][context.page];
  const [open, setOpen] = useState(false);
  const [hint, setHint] = useState(true);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const active = useRef<AbortController | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const launcherRef = useRef<HTMLButtonElement>(null);
  useEffect(() => () => active.current?.abort(), []);
  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, pending, open, error]);
  function close() {
    setOpen(false);
    launcherRef.current?.focus();
  }
  function reset() {
    active.current?.abort();
    active.current = null;
    setPending(false);
    setMessages([]);
    setError("");
    setInput("");
    inputRef.current?.focus();
  }
  async function send(value = input) {
    const text = value.trim();
    if (!text || active.current) return;
    const controller = new AbortController();
    active.current = controller;
    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: text,
    };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setError("");
    setPending(true);
    try {
      const reply = await chatWithArena(
        text,
        messages,
        context,
        locale,
        controller.signal,
      );
      if (!controller.signal.aborted)
        setMessages((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            role: "assistant",
            content: reply.message,
            reply,
          },
        ]);
    } catch (e) {
      if (!controller.signal.aborted) {
        setError(
          e instanceof ApiError
            ? e.status === 429
              ? vi
                ? "Arena đang bận hoặc hết lượt tạm thời. Bạn chờ một chút nhé."
                : "Arena is busy or temporarily out of quota. Please try shortly."
              : e.status === 401
                ? vi
                  ? "Bạn cần đăng nhập để thực hiện yêu cầu này."
                  : "Please sign in to continue."
                : e.message
            : vi
              ? "Không kết nối được với Arena. Bạn thử lại nhé."
              : "Unable to reach Arena. Please retry.",
        );
        setInput(text);
      }
    } finally {
      if (active.current === controller) {
        active.current = null;
        setPending(false);
      }
    }
  }
  function submit(e: FormEvent) {
    e.preventDefault();
    void send();
  }
  return (
    <aside
      className={styles.root}
      aria-label={vi ? "Trợ lý Arena" : "Arena assistant"}
    >
      {open && (
        <section
          role="dialog"
          aria-modal="false"
          aria-labelledby="arena-chat-title"
          className={styles.panel}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              e.stopPropagation();
              close();
            }
          }}
        >
          <header className={styles.header}>
            <div className={styles.avatar}>
              <Image src={avatar} alt="" width={52} height={52} />
              <span />
            </div>
            <div className={styles.identity}>
              <h2 id="arena-chat-title">
                Arena <span>AI</span>
              </h2>
              <p>
                {vi
                  ? "Đồng đội của bạn trên ArenaVerse"
                  : "Your ArenaVerse companion"}
              </p>
            </div>
            <button
              title={vi ? "Cuộc trò chuyện mới" : "New conversation"}
              aria-label={vi ? "Cuộc trò chuyện mới" : "New conversation"}
              onClick={reset}
            >
              <ArrowCounterClockwiseIcon size={18} />
            </button>
            <button
              aria-label={vi ? "Đóng chat" : "Close chat"}
              onClick={close}
            >
              <XIcon size={20} />
            </button>
          </header>
          <div className={styles.context}>
            <SparkleIcon size={14} />
            {context.page === "discover"
              ? vi
                ? "Cùng tìm giải phù hợp"
                : "Find your next tournament"
              : context.page === "create"
                ? vi
                  ? "Biến ý tưởng thành giải đấu"
                  : "Turn ideas into tournaments"
                : context.slug
                  ? vi
                    ? "Đang hỗ trợ giải bạn đang xem"
                    : "Helping with this tournament"
                  : vi
                    ? "Tìm giải · Hỏi đáp · Tạo giải"
                    : "Discover · Ask · Create"}
          </div>
          <div
            ref={scrollRef}
            className={styles.messages}
            role="log"
            aria-label={vi ? "Nội dung trò chuyện" : "Conversation"}
            aria-live="polite"
            aria-busy={pending}
          >
            <div className={styles.welcome}>
              <Image src={avatar} alt="Arena" width={88} height={88} />
              <h3>{vi ? "Chào bạn, mình là Arena!" : "Hi, I’m Arena!"}</h3>
              <p>{copy.intro}</p>
            </div>
            {!messages.length && (
              <div className={styles.suggestions}>
                {copy.suggestions.map((text) => (
                  <button key={text} onClick={() => void send(text)}>
                    {text}
                    <span>↗</span>
                  </button>
                ))}
              </div>
            )}
            {messages.map((m, index) => (
              <div
                key={m.id}
                className={`${styles.message} ${m.role === "user" ? styles.user : styles.assistant}`}
              >
                {m.role === "assistant" && (
                  <span className={styles.speaker}>Arena</span>
                )}
                <p>{m.content}</p>
                {m.reply?.tournaments?.map((t) => (
                  <Link
                    key={t.id}
                    href={`/tournaments/${encodeURIComponent(t.slug)}`}
                    className={styles.tournament}
                  >
                    <span>
                      {t.game} ·{" "}
                      {t.mode === "ONLINE"
                        ? vi
                          ? "Trực tuyến"
                          : "Online"
                        : t.mode === "OFFLINE"
                          ? vi
                            ? "Trực tiếp"
                            : "Offline"
                          : vi
                            ? "Kết hợp"
                            : "Hybrid"}
                    </span>
                    <strong>
                      {t.name} <span>↗</span>
                    </strong>
                    {t.startDate && (
                      <small>
                        {new Intl.DateTimeFormat(
                          locale === "vi" ? "vi-VN" : "en-GB",
                          { dateStyle: "medium", timeZone: "Asia/Ho_Chi_Minh" },
                        ).format(new Date(t.startDate))}
                      </small>
                    )}
                  </Link>
                ))}
                {m.reply?.proposal && (
                  <ProposalCard
                    proposal={m.reply.proposal}
                    enabled={!pending && index === messages.length - 1}
                    locale={locale}
                    onApplied={(text) =>
                      setMessages((prev) => [
                        ...prev,
                        {
                          id: crypto.randomUUID(),
                          role: "assistant",
                          content: text,
                        },
                      ])
                    }
                  />
                )}
                {!!m.reply?.sources?.length && (
                  <div className={styles.sources}>
                    {m.reply.sources.map((s) =>
                      s.href.startsWith("https://") ? (
                        <a
                          key={s.href}
                          href={s.href}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          {vi ? "Nguồn: " : "Source: "}
                          {s.label} ↗
                        </a>
                      ) : (
                        <Link key={s.href} href={s.href}>
                          {vi ? "Nguồn: " : "Source: "}
                          {s.label} ↗
                        </Link>
                      ),
                    )}
                  </div>
                )}
                {m.reply?.checkedAt && (
                  <p className={styles.checkedAt}>
                    {vi ? "Tra cứu lúc: " : "Checked: "}
                    {new Intl.DateTimeFormat(
                      locale === "vi" ? "vi-VN" : "en-GB",
                      {
                        dateStyle: "short",
                        timeStyle: "short",
                        timeZone: "Asia/Ho_Chi_Minh",
                      },
                    ).format(new Date(m.reply.checkedAt))}{" "}
                    (UTC+7)
                  </p>
                )}
                {m.reply?.searchSuggestionsHtml && (
                  <iframe
                    title={
                      vi ? "Gợi ý tìm kiếm Google" : "Google Search suggestions"
                    }
                    className={styles.searchSuggestions}
                    sandbox="allow-popups allow-popups-to-escape-sandbox"
                    referrerPolicy="no-referrer"
                    srcDoc={`<!doctype html><html><head><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src https: data:; base-uri 'none'; form-action 'none'"><base target="_blank"></head><body style="margin:0">${m.reply.searchSuggestionsHtml}</body></html>`}
                  />
                )}
              </div>
            ))}
            {pending && (
              <div className={styles.thinking} role="status">
                <span />
                <span />
                <span />
                {vi ? "Arena đang xem giúp bạn…" : "Arena is looking into it…"}
              </div>
            )}
            {error && (
              <p role="alert" className={styles.error}>
                {error}
              </p>
            )}
          </div>
          <form onSubmit={submit} className={styles.composer}>
            <label className="sr-only" htmlFor="arena-message">
              {vi ? "Nhắn cho Arena" : "Message Arena"}
            </label>
            <textarea
              ref={inputRef}
              id="arena-message"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              maxLength={1500}
              rows={2}
              placeholder={
                vi
                  ? "Hỏi về giải đấu, game hoặc esports…"
                  : "Ask about tournaments, games or esports…"
              }
              disabled={pending}
              onKeyDown={(e) => {
                if (
                  e.key === "Enter" &&
                  !e.shiftKey &&
                  !e.nativeEvent.isComposing
                ) {
                  e.preventDefault();
                  void send();
                }
              }}
            />
            <button
              type="submit"
              disabled={pending || !input.trim()}
              aria-label={vi ? "Gửi tin nhắn" : "Send message"}
            >
              <ArrowUpIcon size={21} weight="bold" />
            </button>
          </form>
          <p className={styles.disclaimer}>
            {vi
              ? "Arena dùng Gemini. Hãy kiểm tra thông tin trước khi xác nhận."
              : "Powered by Gemini. Review details before confirming."}
          </p>
        </section>
      )}
      {!open && hint && (
        <div className={styles.hint}>
          <button
            onClick={() => {
              setOpen(true);
              setHint(false);
            }}
          >
            {copy.hint}
          </button>
          <button
            aria-label={vi ? "Ẩn gợi ý" : "Dismiss suggestion"}
            onClick={() => setHint(false)}
          >
            <XIcon size={14} />
          </button>
        </div>
      )}
      <button
        ref={launcherRef}
        className={styles.launcher}
        onClick={() => {
          setOpen(!open);
          setHint(false);
        }}
        aria-label={
          open
            ? vi
              ? "Thu nhỏ Arena"
              : "Minimize Arena"
            : vi
              ? "Mở chat với Arena"
              : "Chat with Arena"
        }
        aria-expanded={open}
        aria-haspopup="dialog"
      >
        <Image src={avatar} alt="" width={68} height={68} />
        <span className={styles.badge}>
          <SparkleIcon size={13} weight="fill" />
        </span>
      </button>
    </aside>
  );
}
