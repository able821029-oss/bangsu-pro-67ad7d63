import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/AuthProvider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  Plus, ChevronLeft, ChevronRight, MapPin, Clock,
  Edit2, Trash2, Mic, MicOff, Download, Camera,
  CloudSun, Hammer, FileText, X, Check
} from "lucide-react";
import {
  format, startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  addDays, addMonths, subMonths, isSameMonth, isSameDay
} from "date-fns";
import { ko } from "date-fns/locale";
import { cn } from "@/lib/utils";

interface Schedule {
  id: string;
  title: string;
  schedule_date: string;
  schedule_time: string | null;
  memo: string;
  location: string;
  work_type: string;
  workers: number;
  weather: string;
  completed: boolean;
}

const workTypes = ["방수", "도배", "타일", "페인트", "인테리어", "철거", "전기", "설비", "기타"];
const weatherOptions = [
  { icon: "☀️", label: "맑음" },
  { icon: "⛅", label: "흐림" },
  { icon: "🌧️", label: "비" },
  { icon: "❄️", label: "눈" },
];

export function CalendarTab() {
  const { user } = useAuth();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    title: "", schedule_date: "", schedule_time: "",
    memo: "", location: "", work_type: "", workers: 1,
    weather: "맑음", completed: false,
  });
  const [isRecording, setIsRecording] = useState(false);
  const [recordingField, setRecordingField] = useState<"title" | "memo" | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recognitionRef = useRef<any>(null);

  const fetchSchedules = useCallback(async () => {
    if (!user) return;
    // 로컬 스토리지 fallback (Supabase 테이블 없을 경우)
    try {
      const { data } = await supabase
        .from("schedules").select("*")
        .eq("user_id", user.id)
        .order("schedule_date", { ascending: true });
      if (data) { setSchedules(data as Schedule[]); return; }
    } catch {}
    // 로컬 스토리지
    const local = JSON.parse(localStorage.getItem("sms_schedules") || "[]");
    setSchedules(local.filter((s: any) => s.user_id === user.id));
  }, [user]);

  useEffect(() => { fetchSchedules(); }, [fetchSchedules]);

  // 음성 인식 (Web Speech API - API키 불필요)
  const startVoiceMemo = (field: "title" | "memo") => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      toast.error("이 브라우저는 음성 인식을 지원하지 않습니다");
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.lang = "ko-KR";
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.onstart = () => { setIsRecording(true); setRecordingField(field); };
    recognition.onresult = (e: any) => {
      const text = e.results[0][0].transcript;
      setFormData(prev => ({
        ...prev,
        [field]: field === "memo" ? (prev.memo ? prev.memo + "\n" + text : text) : text,
      }));
      toast.success(`음성 인식: "${text}"`);
    };
    recognition.onerror = () => toast.error("음성 인식 실패. 다시 시도해 주세요");
    recognition.onend = () => { setIsRecording(false); setRecordingField(null); };
    recognitionRef.current = recognition;
    recognition.start();
  };

  const stopVoice = () => {
    recognitionRef.current?.stop();
    setIsRecording(false);
    setRecordingField(null);
  };

  const openNew = () => {
    setEditingId(null);
    setFormData({
      title: "", schedule_date: format(selectedDate, "yyyy-MM-dd"),
      schedule_time: "", memo: "", location: "",
      work_type: "", workers: 1, weather: "맑음", completed: false,
    });
    setShowForm(true);
  };

  const openEdit = (s: Schedule) => {
    setEditingId(s.id);
    setFormData({
      title: s.title, schedule_date: s.schedule_date,
      schedule_time: s.schedule_time || "", memo: s.memo,
      location: s.location, work_type: s.work_type || "",
      workers: s.workers || 1, weather: s.weather || "맑음",
      completed: s.completed || false,
    });
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!formData.title.trim()) { toast.error("현장명을 입력해주세요"); return; }
    if (!user) return;

    const payload: any = {
      user_id: user.id,
      title: formData.title,
      schedule_date: formData.schedule_date,
      schedule_time: formData.schedule_time || null,
      memo: formData.memo,
      location: formData.location,
      work_type: formData.work_type,
      workers: formData.workers,
      weather: formData.weather,
      completed: formData.completed,
    };

    try {
      if (editingId) {
        await supabase.from("schedules").update(payload).eq("id", editingId);
      } else {
        await supabase.from("schedules").insert(payload);
      }
    } catch {
      // 로컬 스토리지 저장
      const local: any[] = JSON.parse(localStorage.getItem("sms_schedules") || "[]");
      if (editingId) {
        const idx = local.findIndex(s => s.id === editingId);
        if (idx >= 0) local[idx] = { ...payload, id: editingId };
      } else {
        local.push({ ...payload, id: Date.now().toString() });
      }
      localStorage.setItem("sms_schedules", JSON.stringify(local));
    }

    toast.success(editingId ? "일정이 수정되었습니다" : "일정이 등록되었습니다");
    setShowForm(false);
    fetchSchedules();
  };

  const handleDelete = async (id: string) => {
    try {
      await supabase.from("schedules").delete().eq("id", id);
    } catch {
      const local = JSON.parse(localStorage.getItem("sms_schedules") || "[]");
      localStorage.setItem("sms_schedules", JSON.stringify(local.filter((s: any) => s.id !== id)));
    }
    toast.success("삭제되었습니다");
    fetchSchedules();
  };

  const toggleComplete = async (s: Schedule) => {
    try {
      await supabase.from("schedules").update({ completed: !s.completed }).eq("id", s.id);
    } catch {
      const local = JSON.parse(localStorage.getItem("sms_schedules") || "[]");
      const idx = local.findIndex((item: any) => item.id === s.id);
      if (idx >= 0) local[idx].completed = !s.completed;
      localStorage.setItem("sms_schedules", JSON.stringify(local));
    }
    fetchSchedules();
  };

  // ICS 파일로 구글 캘린더 내보내기 (API 없이)
  const exportToICS = () => {
    const lines = [
      "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//SMS//KR",
      "CALSCALE:GREGORIAN", "METHOD:PUBLISH",
    ];
    schedules.forEach(s => {
      const dt = s.schedule_date.replace(/-/g, "");
      lines.push("BEGIN:VEVENT");
      lines.push(`UID:sms-${s.id}@sms-app`);
      lines.push(`DTSTART:${dt}`);
      lines.push(`DTEND:${dt}`);
      lines.push(`SUMMARY:${s.title}${s.work_type ? ` [${s.work_type}]` : ""}`);
      if (s.location) lines.push(`LOCATION:${s.location}`);
      if (s.memo) lines.push(`DESCRIPTION:${s.memo.replace(/\n/g, "\\n")}`);
      lines.push("END:VEVENT");
    });
    lines.push("END:VCALENDAR");

    const blob = new Blob([lines.join("\r\n")], { type: "text/calendar" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "sms_schedule.ics";
    a.click();
    toast.success("ICS 파일 다운로드 완료!\n구글 캘린더 → 다른 캘린더 가져오기에서 업로드하세요");
  };

  // 캘린더 그리드
  const monthStart = startOfMonth(currentDate);
  const calStart = startOfWeek(monthStart, { weekStartsOn: 0 });
  const calEnd = endOfWeek(endOfMonth(currentDate), { weekStartsOn: 0 });
  const calDays: Date[] = [];
  let d = calStart;
  while (d <= calEnd) { calDays.push(d); d = addDays(d, 1); }

  const hasSchedule = (date: Date) => schedules.some(s => s.schedule_date === format(date, "yyyy-MM-dd"));
  const isCompleted = (date: Date) => schedules
    .filter(s => s.schedule_date === format(date, "yyyy-MM-dd"))
    .every(s => s.completed);
  const daySchedules = schedules.filter(s => s.schedule_date === format(selectedDate, "yyyy-MM-dd"));

  // 이번달 통계
  const thisMonth = format(currentDate, "yyyy-MM");
  const monthSchedules = schedules.filter(s => s.schedule_date.startsWith(thisMonth));
  const completedCount = monthSchedules.filter(s => s.completed).length;
  const totalWorkers = monthSchedules.reduce((sum, s) => sum + (s.workers || 0), 0);

  return (
    <div className="pb-24 min-h-screen bg-background">
      {/* 헤더 */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b border-border px-4 py-3">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <button onClick={() => setCurrentDate(subMonths(currentDate, 1))}>
              <ChevronLeft className="w-5 h-5 text-muted-foreground" />
            </button>
            <h2 className="text-lg font-bold">{format(currentDate, "yyyy년 M월", { locale: ko })}</h2>
            <button onClick={() => setCurrentDate(addMonths(currentDate, 1))}>
              <ChevronRight className="w-5 h-5 text-muted-foreground" />
            </button>
          </div>
          <button onClick={exportToICS}
            className="flex items-center gap-1.5 text-xs text-primary font-semibold bg-primary/10 px-3 py-1.5 rounded-full">
            <Download className="w-3.5 h-3.5" /> 구글 내보내기
          </button>
        </div>

        {/* 이달 통계 */}
        <div className="flex gap-3 text-xs">
          <span className="text-muted-foreground">이달 현장 <b className="text-foreground">{monthSchedules.length}건</b></span>
          <span className="text-muted-foreground">완료 <b className="text-green-500">{completedCount}건</b></span>
          <span className="text-muted-foreground">총 인부 <b className="text-primary">{totalWorkers}명</b></span>
        </div>

        {/* 요일 헤더 */}
        <div className="grid grid-cols-7 mt-2">
          {["일","월","화","수","목","금","토"].map((d, i) => (
            <div key={d} className={cn("text-center text-xs font-medium py-1",
              i === 0 ? "text-red-500" : i === 6 ? "text-blue-500" : "text-muted-foreground")}>{d}</div>
          ))}
        </div>
      </div>

      {/* 캘린더 그리드 */}
      <div className="grid grid-cols-7 gap-0 px-1 pt-1">
        {calDays.map((day, i) => {
          const isToday = isSameDay(day, new Date());
          const isSelected = isSameDay(day, selectedDate);
          const isCurrMonth = isSameMonth(day, currentDate);
          const has = hasSchedule(day);
          const done = has && isCompleted(day);
          return (
            <button key={i} onClick={() => setSelectedDate(day)}
              className={cn("relative flex flex-col items-center py-2 min-h-[46px] rounded-lg transition-colors",
                !isCurrMonth && "opacity-25",
                isSelected && "bg-primary/10",
                isToday && !isSelected && "bg-muted"
              )}>
              <span className={cn("text-sm w-7 h-7 flex items-center justify-center rounded-full",
                isSelected && "bg-primary text-white font-bold",
                isToday && !isSelected && "font-bold"
              )}>{format(day, "d")}</span>
              {has && (
                <div className={cn("w-1.5 h-1.5 rounded-full mt-0.5",
                  done ? "bg-green-500" : "bg-primary")} />
              )}
            </button>
          );
        })}
      </div>

      {/* 선택 날짜 일지 */}
      <div className="px-4 mt-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="font-bold text-sm">{format(selectedDate, "M월 d일 (EEEE)", { locale: ko })}</h3>
            <p className="text-xs text-muted-foreground">{daySchedules.length}개 현장</p>
          </div>
        </div>

        {daySchedules.length === 0 ? (
          <div className="text-center py-10 space-y-2">
            <p className="text-3xl">📋</p>
            <p className="text-sm text-muted-foreground">이날 등록된 현장이 없습니다</p>
            <button onClick={openNew}
              className="text-xs text-primary font-semibold underline">
              현장 일지 추가하기
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {daySchedules.map(s => (
              <div key={s.id} className={cn(
                "bg-card border rounded-2xl p-4 space-y-2 transition-all",
                s.completed ? "border-green-500/30 bg-green-500/5" : "border-border"
              )}>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className={cn("font-bold text-sm", s.completed && "line-through text-muted-foreground")}>
                        {s.title}
                      </p>
                      {s.work_type && (
                        <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-md font-semibold">
                          {s.work_type}
                        </span>
                      )}
                      {s.weather && (
                        <span className="text-xs">{weatherOptions.find(w => w.label === s.weather)?.icon}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-1 flex-wrap">
                      {s.schedule_time && (
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Clock className="w-3 h-3" />{s.schedule_time}
                        </span>
                      )}
                      {s.location && (
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <MapPin className="w-3 h-3" />{s.location}
                        </span>
                      )}
                      {s.workers > 0 && (
                        <span className="text-xs text-muted-foreground">👷 {s.workers}명</span>
                      )}
                    </div>
                    {s.memo && (
                      <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed bg-secondary/50 rounded-lg px-2 py-1.5">
                        {s.memo}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <button onClick={() => toggleComplete(s)}
                      className={cn("p-1.5 rounded-lg transition-colors",
                        s.completed ? "bg-green-500/20 text-green-500" : "hover:bg-muted text-muted-foreground")}>
                      <Check className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => openEdit(s)} className="p-1.5 rounded-lg hover:bg-muted">
                      <Edit2 className="w-3.5 h-3.5 text-muted-foreground" />
                    </button>
                    <button onClick={() => handleDelete(s.id)} className="p-1.5 rounded-lg hover:bg-muted">
                      <Trash2 className="w-3.5 h-3.5 text-destructive" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* FAB */}
      <button onClick={openNew}
        className="fixed bottom-24 right-4 w-14 h-14 rounded-full text-white shadow-xl flex items-center justify-center z-40 hover:scale-105 transition-transform"
        style={{ background: "linear-gradient(135deg,#237FFF,#AB5EBE)" }}>
        <Plus className="w-6 h-6" />
      </button>

      {/* 일지 입력 다이얼로그 */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-sm mx-auto max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Hammer className="w-4 h-4" />
              {editingId ? "현장 일지 수정" : "현장 일지 작성"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {/* 현장명 + 음성 */}
            <div className="flex gap-2">
              <div className="flex-1">
                <Input
                  placeholder="현장명 (예: 강남구 방수 시공)"
                  value={formData.title}
                  onChange={e => setFormData({ ...formData, title: e.target.value })}
                />
              </div>
              <button
                onClick={() => isRecording && recordingField === "title" ? stopVoice() : startVoiceMemo("title")}
                className={cn("w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-colors",
                  isRecording && recordingField === "title"
                    ? "bg-red-500 text-white animate-pulse"
                    : "bg-secondary text-muted-foreground hover:bg-primary/10 hover:text-primary"
                )}>
                {isRecording && recordingField === "title" ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
              </button>
            </div>

            {/* 날짜 + 시간 */}
            <div className="grid grid-cols-2 gap-2">
              <Input type="date" value={formData.schedule_date}
                onChange={e => setFormData({ ...formData, schedule_date: e.target.value })} />
              <Input type="time" value={formData.schedule_time}
                onChange={e => setFormData({ ...formData, schedule_time: e.target.value })} />
            </div>

            {/* 위치 */}
            <Input placeholder="📍 위치 (선택)"
              value={formData.location}
              onChange={e => setFormData({ ...formData, location: e.target.value })} />

            {/* 공종 선택 */}
            <div>
              <p className="text-xs text-muted-foreground mb-1.5">공종</p>
              <div className="flex flex-wrap gap-1.5">
                {workTypes.map(w => (
                  <button key={w} onClick={() => setFormData({ ...formData, work_type: w })}
                    className={cn("px-2.5 py-1 rounded-full text-xs font-medium transition-colors",
                      formData.work_type === w
                        ? "bg-primary text-white"
                        : "bg-secondary text-muted-foreground hover:bg-primary/10"
                    )}>{w}</button>
                ))}
              </div>
            </div>

            {/* 날씨 */}
            <div>
              <p className="text-xs text-muted-foreground mb-1.5">날씨</p>
              <div className="flex gap-2">
                {weatherOptions.map(w => (
                  <button key={w.label} onClick={() => setFormData({ ...formData, weather: w.label })}
                    className={cn("flex-1 py-2 rounded-xl text-center text-lg transition-all border",
                      formData.weather === w.label
                        ? "border-primary bg-primary/10"
                        : "border-border hover:border-primary/30"
                    )}>
                    {w.icon}
                    <p className="text-[10px] text-muted-foreground mt-0.5">{w.label}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* 인부 수 */}
            <div className="flex items-center gap-3">
              <p className="text-xs text-muted-foreground">👷 인부</p>
              <div className="flex items-center gap-2 bg-secondary rounded-lg px-3 py-1.5">
                <button onClick={() => setFormData({ ...formData, workers: Math.max(0, formData.workers - 1) })}
                  className="text-primary font-bold text-lg w-5">-</button>
                <span className="text-sm font-semibold w-5 text-center">{formData.workers}</span>
                <button onClick={() => setFormData({ ...formData, workers: formData.workers + 1 })}
                  className="text-primary font-bold text-lg w-5">+</button>
              </div>
              <span className="text-xs text-muted-foreground">명</span>
            </div>

            {/* 메모 + 음성 */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <p className="text-xs text-muted-foreground">작업 메모</p>
                <button
                  onClick={() => isRecording && recordingField === "memo" ? stopVoice() : startVoiceMemo("memo")}
                  className={cn("flex items-center gap-1 text-xs px-2 py-1 rounded-lg transition-colors",
                    isRecording && recordingField === "memo"
                      ? "bg-red-500 text-white animate-pulse"
                      : "bg-secondary text-muted-foreground hover:text-primary"
                  )}>
                  {isRecording && recordingField === "memo" ? <MicOff className="w-3 h-3" /> : <Mic className="w-3 h-3" />}
                  {isRecording && recordingField === "memo" ? "중지" : "음성 메모"}
                </button>
              </div>
              <Textarea
                placeholder="오늘 작업 내용, 특이사항 등을 입력하거나 음성으로 말씀해 주세요"
                value={formData.memo}
                onChange={e => setFormData({ ...formData, memo: e.target.value })}
                rows={3}
              />
            </div>

            {/* 완료 체크 */}
            <div className="flex items-center gap-3 bg-secondary/50 rounded-xl px-3 py-2.5">
              <button onClick={() => setFormData({ ...formData, completed: !formData.completed })}
                className={cn("w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors",
                  formData.completed ? "bg-green-500 border-green-500" : "border-muted-foreground"
                )}>
                {formData.completed && <Check className="w-3 h-3 text-white" />}
              </button>
              <span className="text-sm">현장 작업 완료</span>
            </div>

            <Button onClick={handleSave} className="w-full" style={{ background: "linear-gradient(135deg,#237FFF,#AB5EBE)", color: "white" }}>
              {editingId ? "수정 완료" : "일지 저장"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
