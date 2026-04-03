import { useRef, useState } from "react";
import { ImagePlus, Download, Share2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAppStore } from "@/stores/appStore";
import { toast } from "sonner";

export function BeforeAfterComparator() {
  const { settings } = useAppStore();
  const [beforeImg, setBeforeImg] = useState<string | null>(null);
  const [afterImg, setAfterImg] = useState<string | null>(null);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const beforeRef = useRef<HTMLInputElement>(null);
  const afterRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const handleSelect = (type: "before" | "after") => (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const url = ev.target?.result as string;
      if (type === "before") setBeforeImg(url);
      else setAfterImg(url);
      setResultUrl(null);
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const generate = async () => {
    if (!beforeImg || !afterImg) {
      toast.error("시공 전/후 사진을 모두 선택해주세요");
      return;
    }
    setIsGenerating(true);

    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    const W = 1080, H = 720;
    canvas.width = W;
    canvas.height = H;

    const loadImg = (src: string): Promise<HTMLImageElement> =>
      new Promise((res, rej) => {
        const img = new Image();
        img.onload = () => res(img);
        img.onerror = rej;
        img.src = src;
      });

    try {
      const [bImg, aImg] = await Promise.all([loadImg(beforeImg), loadImg(afterImg)]);
      const half = W / 2;
      const barH = 48;
      const contentH = H - barH;

      // Draw before (left half)
      const bRatio = Math.max(half / bImg.width, contentH / bImg.height);
      const bW = bImg.width * bRatio, bH = bImg.height * bRatio;
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, half, contentH);
      ctx.clip();
      ctx.drawImage(bImg, (half - bW) / 2, (contentH - bH) / 2, bW, bH);
      ctx.restore();

      // Draw after (right half)
      const aRatio = Math.max(half / aImg.width, contentH / aImg.height);
      const aW = aImg.width * aRatio, aH = aImg.height * aRatio;
      ctx.save();
      ctx.beginPath();
      ctx.rect(half, 0, half, contentH);
      ctx.clip();
      ctx.drawImage(aImg, half + (half - aW) / 2, (contentH - aH) / 2, aW, aH);
      ctx.restore();

      // Center divider
      ctx.strokeStyle = "#FFFFFF";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(half, 0);
      ctx.lineTo(half, contentH);
      ctx.stroke();

      // Labels
      ctx.font = "bold 28px 'Noto Sans KR', sans-serif";
      const labels = [
        { text: "BEFORE", x: 16, y: 16 },
        { text: "AFTER", x: half + 16, y: 16 },
      ];
      labels.forEach(({ text, x, y }) => {
        const tw = ctx.measureText(text).width;
        ctx.fillStyle = "rgba(0,0,0,0.55)";
        ctx.beginPath();
        ctx.roundRect(x, y, tw + 24, 40, 8);
        ctx.fill();
        ctx.fillStyle = "#FFFFFF";
        ctx.fillText(text, x + 12, y + 30);
      });

      // Bottom bar
      ctx.fillStyle = "#1A2B4A";
      ctx.fillRect(0, contentH, W, barH);
      ctx.fillStyle = "#FFFFFF";
      ctx.font = "bold 20px 'Noto Sans KR', sans-serif";
      const company = settings.companyName || "업체명";
      const phone = settings.phoneNumber || "";
      const bottomText = phone ? `${company}  |  ${phone}` : company;
      const btw = ctx.measureText(bottomText).width;
      ctx.fillText(bottomText, (W - btw) / 2, contentH + 32);

      const url = canvas.toDataURL("image/png", 1.0);
      setResultUrl(url);
      toast.success("비교 이미지가 생성됐습니다");
    } catch {
      toast.error("이미지 생성 실패");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownload = () => {
    if (!resultUrl) return;
    const a = document.createElement("a");
    a.href = resultUrl;
    a.download = `before-after-${Date.now()}.png`;
    a.click();
    toast.success("비교 이미지가 갤러리에 저장됐습니다");
  };

  const handleShare = async () => {
    if (!resultUrl) return;
    try {
      const res = await fetch(resultUrl);
      const blob = await res.blob();
      const file = new File([blob], "before-after.png", { type: "image/png" });
      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: "시공 전후 비교" });
      } else {
        handleDownload();
      }
    } catch {
      handleDownload();
    }
  };

  return (
    <div className="bg-card rounded-[--radius] border border-border p-4 space-y-4">
      <p className="text-sm font-semibold">Before / After 비교 이미지</p>

      <div className="grid grid-cols-2 gap-3">
        {/* Before */}
        <div>
          <p className="text-xs text-muted-foreground mb-1">시공 전</p>
          {beforeImg ? (
            <div className="relative w-full aspect-[3/2] rounded-lg overflow-hidden border border-border">
              <img src={beforeImg} alt="before" className="w-full h-full object-cover" />
              <button onClick={() => { setBeforeImg(null); setResultUrl(null); }} className="absolute top-1 right-1 bg-destructive rounded-full p-0.5">
                <X className="w-3 h-3 text-destructive-foreground" />
              </button>
            </div>
          ) : (
            <Button variant="outline" className="w-full aspect-[3/2] flex-col gap-1" onClick={() => beforeRef.current?.click()}>
              <ImagePlus className="w-6 h-6" />
              <span className="text-xs">시공 전 선택</span>
            </Button>
          )}
        </div>

        {/* After */}
        <div>
          <p className="text-xs text-muted-foreground mb-1">시공 후</p>
          {afterImg ? (
            <div className="relative w-full aspect-[3/2] rounded-lg overflow-hidden border border-border">
              <img src={afterImg} alt="after" className="w-full h-full object-cover" />
              <button onClick={() => { setAfterImg(null); setResultUrl(null); }} className="absolute top-1 right-1 bg-destructive rounded-full p-0.5">
                <X className="w-3 h-3 text-destructive-foreground" />
              </button>
            </div>
          ) : (
            <Button variant="outline" className="w-full aspect-[3/2] flex-col gap-1" onClick={() => afterRef.current?.click()}>
              <ImagePlus className="w-6 h-6" />
              <span className="text-xs">시공 후 선택</span>
            </Button>
          )}
        </div>
      </div>

      <input ref={beforeRef} type="file" accept="image/*" className="hidden" onChange={handleSelect("before")} />
      <input ref={afterRef} type="file" accept="image/*" className="hidden" onChange={handleSelect("after")} />

      <Button className="w-full" onClick={generate} disabled={!beforeImg || !afterImg || isGenerating}>
        {isGenerating ? "생성 중..." : "비교 이미지 생성"}
      </Button>

      {resultUrl && (
        <div className="space-y-3">
          <img src={resultUrl} alt="비교 이미지" className="w-full rounded-lg border border-border" />
          <div className="grid grid-cols-2 gap-2">
            <Button variant="secondary" onClick={handleDownload}>
              <Download className="w-4 h-4" /> 저장
            </Button>
            <Button variant="secondary" onClick={handleShare}>
              <Share2 className="w-4 h-4" /> 공유
            </Button>
          </div>
        </div>
      )}

      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
}
