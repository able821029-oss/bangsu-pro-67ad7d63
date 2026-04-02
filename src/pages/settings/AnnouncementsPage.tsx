import { ArrowLeft } from "lucide-react";

const announcements = [
  { id: "1", title: "방수PRO v2.0 업데이트 안내", date: "2026-04-01", content: "인스타그램·틱톡 지원, 페르소나 선택 기능이 추가되었습니다." },
  { id: "2", title: "봄맞이 프로모션 안내", date: "2026-03-15", content: "신규 가입 시 베이직 플랜 첫 달 50% 할인! 쿠폰 코드: SPRING50" },
  { id: "3", title: "시스템 점검 안내", date: "2026-03-01", content: "3월 5일 02:00~06:00 시스템 점검이 예정되어 있습니다." },
];

export function AnnouncementsPage({ onBack }: { onBack: () => void }) {
  return (
    <div className="px-4 pt-6 pb-24 space-y-5 max-w-lg mx-auto">
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="p-2 -ml-2 rounded-lg hover:bg-secondary">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-xl font-bold">📢 공지사항</h1>
      </div>

      <div className="space-y-3">
        {announcements.map((ann) => (
          <div key={ann.id} className="bg-card rounded-xl border border-border p-4">
            <p className="font-semibold text-sm">{ann.title}</p>
            <p className="text-xs text-muted-foreground mt-1">{ann.date}</p>
            <p className="text-sm text-muted-foreground mt-2">{ann.content}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
