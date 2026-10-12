type P = { className?: string };
const base = {
  width: 18,
  height: 18,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

export const IconGrid = (p: P) => (
  <svg {...base} {...p}>
    <rect x="3" y="3" width="7" height="7" rx="2" />
    <rect x="14" y="3" width="7" height="7" rx="2" />
    <rect x="3" y="14" width="7" height="7" rx="2" />
    <rect x="14" y="14" width="7" height="7" rx="2" />
  </svg>
);
export const IconPlus = (p: P) => (
  <svg {...base} {...p}>
    <path d="M12 5v14M5 12h14" />
  </svg>
);
export const IconDoc = (p: P) => (
  <svg {...base} {...p}>
    <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
    <path d="M14 3v5h5M9 13h6M9 17h4" />
  </svg>
);
export const IconTags = (p: P) => (
  <svg {...base} {...p}>
    <path d="M4 6h10M4 12h16M4 18h7" />
    <circle cx="17" cy="6" r="2" />
    <circle cx="14" cy="18" r="2" />
  </svg>
);
export const IconGear = (p: P) => (
  <svg {...base} {...p}>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
  </svg>
);
export const IconInfo = (p: P) => (
  <svg {...base} {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 11v5M12 8h.01" />
  </svg>
);
export const IconChevron = (p: P) => (
  <svg {...base} {...p}>
    <path d="m9 6 6 6-6 6" />
  </svg>
);
export const IconSearch = (p: P) => (
  <svg {...base} {...p}>
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-3.5-3.5" />
  </svg>
);
export const IconMenu = (p: P) => (
  <svg {...base} {...p}>
    <path d="M4 7h16M4 12h16M4 17h16" />
  </svg>
);
export const IconClose = (p: P) => (
  <svg {...base} {...p}>
    <path d="M6 6l12 12M18 6 6 18" />
  </svg>
);
export const IconDownload = (p: P) => (
  <svg {...base} {...p}>
    <path d="M12 4v11M7 10l5 5 5-5M5 20h14" />
  </svg>
);
export const IconPulse = (p: P) => (
  <svg {...base} {...p}>
    <path d="M3 12h4l2-6 4 12 2-6h6" />
  </svg>
);
export const IconThumbUp = (p: P) => (
  <svg {...base} {...p}>
    <path d="M7 10v11H4V10zM7 10l4-7a2 2 0 0 1 3 2l-1 5h6a2 2 0 0 1 2 2.3l-1.4 7A2 2 0 0 1 17.6 21H7" />
  </svg>
);
export const IconThumbDown = (p: P) => (
  <svg {...base} {...p}>
    <path d="M17 14V3h3v11zM17 14l-4 7a2 2 0 0 1-3-2l1-5H5a2 2 0 0 1-2-2.3l1.4-7A2 2 0 0 1 6.4 3H17" />
  </svg>
);

/* Duotone stat-card icons: a soft filled layer under a crisp outline. */
const duo = { ...base, width: 22, height: 22, strokeWidth: 1.6 };
const soft = { fill: "currentColor", fillOpacity: 0.2, stroke: "none" } as const;

export const DuoDocs = (p: P) => (
  <svg {...duo} {...p}>
    <rect x="7" y="2.5" width="12" height="15" rx="2.5" {...soft} />
    <path d="M7 6.5V5a2.5 2.5 0 0 1 2.5-2.5h7A2.5 2.5 0 0 1 19 5v10a2.5 2.5 0 0 1-2.5 2.5H17" />
    <rect x="4" y="6.5" width="12" height="15" rx="2.5" />
    <path d="M7.5 12h5M7.5 15.5h5M7.5 19h3" />
  </svg>
);
export const DuoStar = (p: P) => (
  <svg {...duo} {...p}>
    <path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z" {...soft} />
    <path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z" />
  </svg>
);
export const DuoClock = (p: P) => (
  <svg {...duo} {...p}>
    <circle cx="12" cy="12" r="9" {...soft} />
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 2" />
  </svg>
);
export const DuoDomains = (p: P) => (
  <svg {...duo} {...p}>
    <rect x="3" y="3" width="8" height="8" rx="2" {...soft} />
    <rect x="13" y="13" width="8" height="8" rx="2" {...soft} />
    <rect x="3" y="3" width="8" height="8" rx="2" />
    <rect x="13" y="3" width="8" height="8" rx="2" />
    <rect x="3" y="13" width="8" height="8" rx="2" />
    <rect x="13" y="13" width="8" height="8" rx="2" />
  </svg>
);

/** Empty-state illustration: a magnifying glass over a document, in soft violet. */
export const EmptySearchArt = (p: P) => (
  <svg width="120" height="96" viewBox="0 0 120 96" fill="none" aria-hidden {...p}>
    <rect x="24" y="10" width="56" height="72" rx="8" fill="#6c5ce7" fillOpacity="0.12" stroke="#8b5cf6" strokeOpacity="0.45" strokeWidth="1.5" />
    <path d="M36 28h32M36 38h32M36 48h20" stroke="#8b5cf6" strokeOpacity="0.45" strokeWidth="1.5" strokeLinecap="round" />
    <circle cx="74" cy="56" r="17" fill="#0a0a14" fillOpacity="0.6" stroke="#a78bfa" strokeWidth="2.5" />
    <circle cx="74" cy="56" r="17" fill="#8b5cf6" fillOpacity="0.14" />
    <path d="m86.5 68.5 11 11" stroke="#a78bfa" strokeWidth="4" strokeLinecap="round" />
    <path d="M67 51a9 9 0 0 1 7-4" stroke="#c4b5fd" strokeOpacity="0.8" strokeWidth="2" strokeLinecap="round" />
  </svg>
);
