import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/AuthProvider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, ChevronLeft, ChevronRight, X, MapPin, Clock, Edit2, Trash2, Check, AlertCircle } from "lucide-react";
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays, addMonths, subMonths, isSameMonth, isSameDay, parseISO } from "date-fns";
import { ko } from "date-fns/locale";
import { cn } from "@/lib/utils";

interface Schedule {
  id: string;
  title: string;
  schedule_date: string;
  schedule_time: string | null;
  memo: string;
  location: string;
  image_url: string | null;
  google_synced: boolean;
}

type ViewMode = "month" | "week" | "day";

export function CalendarTab() {
  const { user } = useAuth();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<ViewMode>("month");
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<Schedule | null>(null);
  const [formData, setFormData] = useState({ title: "", schedule_date: "", schedule_time: "", memo: "", location: "" });

  const fetchSchedules = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase.from("schedules").select("*").eq("user_id", user.id).order("schedule_date", { ascending: true });
    if (data) setSchedules(data as Schedule[]);
  }, [user]);

  useEffect(() => { fetchSchedules(); }, [fetchSchedules]);

  const openNewForm = () => {
    setEditingSchedule(null);
    setFormData({ title: "", schedule_date: format(selectedDate, "yyyy-MM-dd"), schedule_time: "", memo: "", location: "" });
    setShowForm(true);
  };

  const openEditForm = (s: Schedule) => {
    setEditingSchedule(s);
    setFormData({ title: s.title, schedule_date: s.schedule_date, schedule_time: s.schedule_time || "", memo: s.memo, location: s.location });
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!formData.title.trim()) { toast.error("제목을 입력해주세요"); return; }
    if (!user) return;

    const payload = {
      user_id: user.id,
      title: formData.title,
      schedule_date: formData.schedule_date,
      schedule_time: formData.schedule_time || null,
      memo: formData.memo,
      location: formData.location,
    };

    if (editingSchedule) {
      const { error } = await supabase.from("schedules").update(payload).eq("id", editingSchedule.id);
      if (error) { toast.error("수정 실패"); return; }
      toast.success("일정이 수정되었습니다");
    } else {
      const { error } = await supabase.from("schedules").insert(payload);
      if (error) { toast.error("등록 실패"); return; }
      toast.success("일정이 등록되었습니다");
    }

    setShowForm(false);
    fetchSchedules();

    // Sync to Google Calendar
    try {
      const { data: profile } = await supabase.from("profiles").select("google_refresh_token").eq("user_id", user.id).single();
      if (profile?.google_refresh_token) {
        await supabase.functions.invoke("google-calendar-sync", {
          body: { ...payload, action: editingSchedule ? "update" : "create", google_event_id: editingSchedule?.google_event_id },
        });
      }
    } catch { /* silent */ }
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("schedules").delete().eq("id", id);
    if (error) { toast.error("삭제 실패"); return; }
    toast.success("일정이 삭제되었습니다");
    fetchSchedules();
  };

  const daySchedules = schedules.filter((s) => s.schedule_date === format(selectedDate, "yyyy-MM-dd"));

  // Calendar grid
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const calStart = startOfWeek(monthStart, { weekStartsOn: 0 });
  const calEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });

  const calendarDays: Date[] = [];
  let day = calStart;
  while (day <= calEnd) { calendarDays.push(day); day = addDays(day, 1); }

  const hasSchedule = (date: Date) => schedules.some((s) => s.schedule_date === format(date, "yyyy-MM-dd"));

  return (
    <div className="pb-24 min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b border-border px-4 py-3">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <button onClick={() => setCurrentDate(subMonths(currentDate, 1))}><ChevronLeft className="w-5 h-5 text-muted-foreground" /></button>
            <h2 className="text-lg font-bold">{format(currentDate, "yyyy년 M월", { locale: ko })}</h2>
            <button onClick={() => setCurrentDate(addMonths(currentDate, 1))}><ChevronRight className="w-5 h-5 text-muted-foreground" /></button>
          </div>
          <div className="flex gap-1">
            {(["month", "week", "day"] as ViewMode[]).map((m) => (
              <button key={m} onClick={() => setViewMode(m)}
                className={cn("px-2.5 py-1 rounded-full text-xs font-medium transition-colors",
                  viewMode === m ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted")}>
                {m === "month" ? "월" : m === "week" ? "주" : "일"}
              </button>
            ))}
          </div>
        </div>

        {/* Weekday headers */}
        <div className="grid grid-cols-7 gap-0">
          {["일", "월", "화", "수", "목", "금", "토"].map((d, i) => (
            <div key={d} className={cn("text-center text-xs font-medium py-1",
              i === 0 ? "text-destructive" : i === 6 ? "text-primary" : "text-muted-foreground")}>{d}</div>
          ))}
        </div>
      </div>

      {/* Calendar Grid */}
      {viewMode === "month" && (
        <div className="grid grid-cols-7 gap-0 px-1">
          {calendarDays.map((d, idx) => {
            const isToday = isSameDay(d, new Date());
            const isSelected = isSameDay(d, selectedDate);
            const isCurrentMonth = isSameMonth(d, currentDate);
            const has = hasSchedule(d);
            return (
              <button key={idx} onClick={() => setSelectedDate(d)}
                className={cn("relative flex flex-col items-center py-2 min-h-[44px] transition-colors rounded-lg",
                  !isCurrentMonth && "opacity-30",
                  isSelected && "bg-primary/10",
                  isToday && !isSelected && "bg-muted")}>
                <span className={cn("text-sm", isSelected && "font-bold text-primary", isToday && !isSelected && "font-bold")}>{format(d, "d")}</span>
                {has && <div className="w-1.5 h-1.5 rounded-full bg-primary mt-0.5" />}
              </button>
            );
          })}
        </div>
      )}

      {/* Selected date schedules */}
      <div className="px-4 mt-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-sm">{format(selectedDate, "M월 d일 (EEEE)", { locale: ko })}</h3>
          <span className="text-xs text-muted-foreground">{daySchedules.length}개 일정</span>
        </div>

        {daySchedules.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground text-sm">일정이 없습니다</div>
        ) : (
          <div className="space-y-2">
            {daySchedules.map((s) => (
              <div key={s.id} className="bg-card border border-border rounded-xl p-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h4 className="font-medium text-sm">{s.title}</h4>
                      {s.google_synced && <Check className="w-3.5 h-3.5 text-green-500" />}
                    </div>
                    {s.schedule_time && (
                      <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1"><Clock className="w-3 h-3" />{s.schedule_time}</p>
                    )}
                    {s.location && (
                      <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5"><MapPin className="w-3 h-3" />{s.location}</p>
                    )}
                    {s.memo && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{s.memo}</p>}
                  </div>
                  <div className="flex gap-1">
                    <button onClick={() => openEditForm(s)} className="p-1.5 rounded-lg hover:bg-muted"><Edit2 className="w-3.5 h-3.5 text-muted-foreground" /></button>
                    <button onClick={() => handleDelete(s.id)} className="p-1.5 rounded-lg hover:bg-muted"><Trash2 className="w-3.5 h-3.5 text-destructive" /></button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* FAB */}
      <button onClick={openNewForm}
        className="fixed bottom-24 right-4 w-14 h-14 rounded-full bg-brand-gradient text-white shadow-lg flex items-center justify-center z-40 hover:scale-105 transition-transform">
        <Plus className="w-6 h-6" />
      </button>

      {/* Schedule Form Dialog */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-sm mx-auto">
          <DialogHeader>
            <DialogTitle>{editingSchedule ? "일정 수정" : "새 일정"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Input placeholder="제목" value={formData.title} onChange={(e) => setFormData({ ...formData, title: e.target.value })} />
            <Input type="date" value={formData.schedule_date} onChange={(e) => setFormData({ ...formData, schedule_date: e.target.value })} />
            <Input type="time" value={formData.schedule_time} onChange={(e) => setFormData({ ...formData, schedule_time: e.target.value })} />
            <Input placeholder="위치 (선택)" value={formData.location} onChange={(e) => setFormData({ ...formData, location: e.target.value })} />
            <Textarea placeholder="메모" value={formData.memo} onChange={(e) => setFormData({ ...formData, memo: e.target.value })} rows={3} />
            <Button onClick={handleSave} className="w-full bg-brand-gradient text-white">
              {editingSchedule ? "수정" : "등록"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
