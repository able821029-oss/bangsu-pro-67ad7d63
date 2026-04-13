import { useEffect, useRef } from "react";

export interface NotificationItem {
  id: string;
  title: string;
  time: string;
  description?: string;
  href?: string;
  onClick?: () => void;
}

interface NotificationPanelProps {
  open: boolean;
  items: NotificationItem[];
  onClose: () => void;
  /** 버튼 기준 앵커 위치 — 기본값 우측 정렬 */
  anchor?: "right" | "left";
}

/**
 * 헤더 알림 버튼에서 사용하는 드롭다운 패널.
 *
 * - 바깥 클릭 / ESC 키로 닫힘
 * - role="dialog" + aria-label + 포커스 이동으로 접근성 보장
 * - opacity + translateY 트랜지션
 * - 모바일: 좌우 여백 확보한 전체 너비, 데스크톱: max-w-[360px] 우측 정렬
 */
export function NotificationPanel({
  open,
  items,
  onClose,
  anchor = "right",
}: NotificationPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  // ESC 닫기 + 열릴 때 포커스 이동
  useEffect(() => {
    if (!open) return;

    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKey);

    // 접근성 — 열릴 때 닫기 버튼으로 포커스 이동
    const focusTimer = window.setTimeout(() => {
      closeButtonRef.current?.focus();
    }, 50);

    return () => {
      document.removeEventListener("keydown", handleKey);
      window.clearTimeout(focusTimer);
    };
  }, [open, onClose]);

  if (!open) return null;

  const positionClass =
    anchor === "right"
      ? "right-0 sm:right-0"
      : "left-0 sm:left-0";

  return (
    <>
      {/* 바깥 클릭 감지용 투명 오버레이 */}
      <div
        className="fixed inset-0 z-40"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* 드롭다운 패널 */}
      <div
        ref={panelRef}
        role="dialog"
        aria-label="알림 패널"
        aria-modal="false"
        className={[
          "absolute top-full mt-2 z-50",
          // 모바일: 좌우 여백 확보한 전체 너비 / 데스크톱: 360px 고정
          "w-[calc(100vw-2rem)] max-w-[360px]",
          positionClass,
          // 스타일 — gray-800/95 반투명 + backdrop-blur + 2xl 그림자
          "bg-gray-800/95 backdrop-blur-sm rounded-2xl shadow-2xl",
          "border border-white/10 overflow-hidden",
          // 애니메이션 — opacity + translateY
          "transition duration-200 ease-out",
          "animate-in fade-in-0 slide-in-from-top-2",
        ].join(" ")}
      >
        {/* 헤더 */}
        <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-bold text-white">알림</h3>
            {items.length > 0 && (
              <span className="min-w-[20px] h-5 px-1.5 rounded-full bg-red-500 text-[10px] text-white font-bold flex items-center justify-center">
                {items.length}
              </span>
            )}
          </div>
          <button
            ref={closeButtonRef}
            onClick={onClose}
            aria-label="알림 패널 닫기"
            className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-300 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4C8EFF] transition-colors"
          >
            <span aria-hidden="true" className="material-symbols-outlined text-[20px]">
              close
            </span>
          </button>
        </div>

        {/* 본문 */}
        {items.length === 0 ? (
          <div className="px-6 py-8 flex flex-col items-center justify-center gap-3 text-center">
            <span
              aria-hidden="true"
              className="material-symbols-outlined text-[48px] text-gray-500"
            >
              notifications_none
            </span>
            <p className="text-sm font-semibold text-white">새로운 알림이 없습니다</p>
            <p className="text-xs text-gray-400 leading-relaxed">
              발행 완료, 일정 알림 등이<br />여기에 표시됩니다
            </p>
          </div>
        ) : (
          <ul
            className="max-h-[400px] overflow-y-auto divide-y divide-white/5"
            style={{ WebkitOverflowScrolling: "touch" }}
          >
            {items.map((n) => {
              const interactive = Boolean(n.onClick || n.href);
              const body = (
                <>
                  <p className="text-sm text-white font-medium">{n.title}</p>
                  {n.description && (
                    <p className="text-xs text-gray-400 mt-1 line-clamp-2">{n.description}</p>
                  )}
                  <p className="text-[11px] text-gray-500 mt-1">{n.time}</p>
                </>
              );
              return (
                <li key={n.id}>
                  {interactive ? (
                    <button
                      onClick={() => {
                        n.onClick?.();
                        if (n.href) window.location.href = n.href;
                        onClose();
                      }}
                      className="w-full text-left px-5 py-3 hover:bg-white/5 focus-visible:outline-none focus-visible:bg-white/5 transition-colors"
                    >
                      {body}
                    </button>
                  ) : (
                    <div className="px-5 py-3">{body}</div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </>
  );
}
