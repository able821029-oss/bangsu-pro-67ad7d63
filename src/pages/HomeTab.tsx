// 기존 — 파란 배경에 파란 S (안 보임)
<rect width="64" height="64" rx="16" fill="hsl(215 100% 50%)"/>
<defs>
  <linearGradient id="hSg" ...>
    <stop offset="0%" stopColor="#237FFF"/>
    <stop offset="52%" stopColor="#6C5CE7"/>
    <stop offset="100%" stopColor="#AB5EBE"/>
  </linearGradient>
</defs>
<text ... fill="url(#hSg)">S</text>

// 교체 — 그라데이션 배경에 흰색 S
<defs>
  <linearGradient id="hSg" x1="0" y1="0" x2="64" y2="64" gradientUnits="userSpaceOnUse">
    <stop offset="0%" stopColor="#237FFF"/>
    <stop offset="100%" stopColor="#AB5EBE"/>
  </linearGradient>
</defs>
<rect width="64" height="64" rx="16" fill="url(#hSg)"/>
<text x="8" y="52" fontFamily="Arial Black, Helvetica Neue, sans-serif" fontWeight="900" fontSize="52" fill="#FFFFFF">S</text>