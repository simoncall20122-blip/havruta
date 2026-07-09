@import "tailwindcss";
@config "../tailwind.config.js";

body, html {
  margin: 0;
  padding: 0;
  height: 100%;
  width: 100%;
  direction: rtl; /* חובה לעברית */
}

/* סקרולבר דק וברור לפאנל טקסט הגמרא - כדי שיהיה ברור שיש עוד תוכן למטה */
.scroll-parchment {
  scrollbar-width: thin;
  scrollbar-color: #A9834A transparent;
}
.scroll-parchment::-webkit-scrollbar {
  width: 10px;
}
.scroll-parchment::-webkit-scrollbar-track {
  background: transparent;
}
.scroll-parchment::-webkit-scrollbar-thumb {
  background-color: #A9834A;
  border-radius: 8px;
  border: 2px solid #FBF6EA;
}

/* יצוא PDF - כשבאמת מדפיסים (או שומרים כ-PDF מדיאלוג ההדפסה), מציגים רק את #print-area */
@media print {
  body * {
    visibility: hidden;
  }
  #print-area, #print-area * {
    visibility: visible;
  }
  #print-area {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
  }
}