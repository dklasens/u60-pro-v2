import type { ReactNode, SVGProps } from 'react'

type IconProps = SVGProps<SVGSVGElement> & { size?: number }

function make(children: ReactNode) {
  return function Icon({ size = 20, ...props }: IconProps) {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        {...props}
      >
        {children}
      </svg>
    )
  }
}

// ── Navigation ────────────────────────────────────────────────────────────────
export const IHome = make(
  <>
    <path d="M3 11.5 12 4l9 7.5" />
    <path d="M5.5 9.5V20h13V9.5" />
    <path d="M9.5 20v-6h5v6" />
  </>,
)
export const ISignal = make(
  <>
    <path d="M3 8.5a14.5 14.5 0 0 1 18 0" />
    <path d="M6 12a9.5 9.5 0 0 1 12 0" />
    <path d="M9 15.5a5 5 0 0 1 6 0" />
    <circle cx={12} cy={19} r={1.3} fill="currentColor" stroke="none" />
  </>,
)
export const IGlobe = make(
  <>
    <circle cx={12} cy={12} r={9} />
    <path d="M3 12h18" />
    <path d="M12 3c2.5 2.6 3.8 5.7 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.7-3.8-9S9.5 5.6 12 3Z" />
  </>,
)
export const ISim = make(
  <>
    <path d="M6 3h8l4 4v14H6V3Z" />
    <rect x={9} y={11} width={6} height={6} rx={1} />
  </>,
)
export const IGauge = make(
  <>
    <path d="M4.5 19a9 9 0 1 1 15 0" />
    <path d="m12 13 3.5-4.5" />
    <circle cx={12} cy={13.5} r={1} fill="currentColor" stroke="none" />
  </>,
)

// ── Connectivity / data ───────────────────────────────────────────────────────
export const IWifi = make(
  <>
    <path d="M2.5 9a15 15 0 0 1 19 0" />
    <path d="M5.5 12.5a10.5 10.5 0 0 1 13 0" />
    <path d="M8.5 16a6 6 0 0 1 7 0" />
    <circle cx={12} cy={19.5} r={1} fill="currentColor" stroke="none" />
  </>,
)
export const IDownload = make(
  <>
    <path d="M12 4v11" />
    <path d="m7 11 5 5 5-5" />
    <path d="M5 20h14" />
  </>,
)
export const IUpload = make(
  <>
    <path d="M12 20V9" />
    <path d="m7 13 5-5 5 5" />
    <path d="M5 4h14" />
  </>,
)
export const IActivity = make(<path d="M3 12h4l2.5-7 4 14L16 12h5" />)
export const IRadio = make(
  <>
    <circle cx={12} cy={12} r={1.6} />
    <path d="M8.5 15.5a5 5 0 0 1 0-7" />
    <path d="M15.5 8.5a5 5 0 0 1 0 7" />
    <path d="M5.6 18.4a9 9 0 0 1 0-12.8" />
    <path d="M18.4 5.6a9 9 0 0 1 0 12.8" />
  </>,
)
export const IBattery = make(
  <>
    <rect x={2.5} y={8} width={17} height={8} rx={2} />
    <path d="M22 11v2" />
  </>,
)
export const IBolt = make(<path d="M13 2 4.5 13.5H11L9.5 22 18 10.5h-6L13 2Z" />)
export const IUsb = make(
  <>
    <path d="M12 21V7" />
    <path d="m12 7 3-2.5V8L12 7Z" />
    <circle cx={12} cy={3.5} r={1.2} />
    <path d="M12 13H8.5a1.5 1.5 0 0 1-1.5-1.5V9" />
    <circle cx={7} cy={7.5} r={1.3} />
    <path d="M12 16.5h3.5A1.5 1.5 0 0 0 17 15v-1.5" />
    <rect x={15.8} y={10.5} width={2.4} height={2.4} />
  </>,
)
export const ICable = make(
  <>
    <path d="M4 20v-2a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v2" />
    <path d="M8 16v-4h8v4" />
    <path d="M10 12V8h4v4" />
  </>,
)
export const IPhone = make(
  <>
    <rect x={7} y={2.5} width={10} height={19} rx={2.5} />
    <path d="M10.5 18.5h3" />
  </>,
)
export const ILaptop = make(
  <>
    <rect x={5} y={4.5} width={14} height={10} rx={1.5} />
    <path d="M3 18.5h18" />
  </>,
)
export const IUsers = make(
  <>
    <circle cx={9} cy={8} r={3.2} />
    <path d="M3.5 19.5a5.5 5.5 0 0 1 11 0" />
    <path d="M15.5 5.2a3.2 3.2 0 0 1 0 5.9" />
    <path d="M17.5 14.3a5.5 5.5 0 0 1 3 4.9" />
  </>,
)

// ── System ────────────────────────────────────────────────────────────────────
export const ICpu = make(
  <>
    <rect x={6} y={6} width={12} height={12} rx={2} />
    <rect x={9.5} y={9.5} width={5} height={5} rx={1} />
    <path d="M9 3v3M15 3v3M9 18v3M15 18v3M3 9h3M3 15h3M18 9h3M18 15h3" />
  </>,
)
export const IChip = make(
  <>
    <rect x={4.5} y={7} width={15} height={10} rx={2} />
    <path d="M8 7v10M12 7v10M16 7v10" opacity={0.6} />
  </>,
)
export const IThermo = make(
  <>
    <path d="M10 4a2 2 0 1 1 4 0v9.5a4 4 0 1 1-4 0V4Z" />
    <circle cx={12} cy={17} r={1.4} fill="currentColor" stroke="none" />
  </>,
)
export const ISettings = make(
  <>
    <path d="M4 7h9M17 7h3M4 12h3M11 12h9M4 17h9M17 17h3" />
    <circle cx={15} cy={7} r={2} />
    <circle cx={9} cy={12} r={2} />
    <circle cx={15} cy={17} r={2} />
  </>,
)
export const IRefresh = make(
  <>
    <path d="M20 12a8 8 0 1 1-2.3-5.6" />
    <path d="M20 3.5V8h-4.5" />
  </>,
)
export const IPower = make(
  <>
    <path d="M12 3v8" />
    <path d="M7 6a7.5 7.5 0 1 0 10 0" />
  </>,
)
export const IRestart = make(
  <>
    <path d="M4 12a8 8 0 1 1 2.3 5.6" />
    <path d="M4 20.5V16h4.5" />
  </>,
)
export const ITerminal = make(
  <>
    <rect x={3} y={4.5} width={18} height={15} rx={2} />
    <path d="m7 9 3 3-3 3M12.5 15H17" />
  </>,
)
export const IClock = make(
  <>
    <circle cx={12} cy={12} r={9} />
    <path d="M12 7v5l3.5 2" />
  </>,
)
export const IDatabase = make(
  <>
    <ellipse cx={12} cy={5.5} rx={7.5} ry={2.8} />
    <path d="M4.5 5.5v13c0 1.5 3.4 2.8 7.5 2.8s7.5-1.3 7.5-2.8v-13" />
    <path d="M4.5 12c0 1.5 3.4 2.8 7.5 2.8s7.5-1.3 7.5-2.8" />
  </>,
)
export const IShield = make(<path d="M12 3 5 5.8v5.4c0 4.3 3 7.9 7 9.8 4-1.9 7-5.5 7-9.8V5.8L12 3Z" />)
export const IMoon = make(<path d="M20 13.5A8 8 0 0 1 10.5 4 8 8 0 1 0 20 13.5Z" />)
export const ISun = make(
  <>
    <circle cx={12} cy={12} r={4} />
    <path d="M12 2.5V5M12 19v2.5M2.5 12H5M19 12h2.5M5 5l1.8 1.8M17.2 17.2 19 19M19 5l-1.8 1.8M6.8 17.2 5 19" />
  </>,
)
export const ILogout = make(
  <>
    <path d="M14 4H6.5A1.5 1.5 0 0 0 5 5.5v13A1.5 1.5 0 0 0 6.5 20H14" />
    <path d="M10 12h10.5M17 8.5l3.5 3.5-3.5 3.5" />
  </>,
)

// ── Actions / status ──────────────────────────────────────────────────────────
export const IPlus = make(<path d="M12 5v14M5 12h14" />)
export const ITrash = make(
  <>
    <path d="M4.5 6.5h15M9.5 6V4.5A1.5 1.5 0 0 1 11 3h2a1.5 1.5 0 0 1 1.5 1.5V6" />
    <path d="M6.5 6.5 7.4 20a1.5 1.5 0 0 0 1.5 1.4h6.2a1.5 1.5 0 0 0 1.5-1.4l.9-13.5" />
    <path d="M10 10.5v7M14 10.5v7" />
  </>,
)
export const IPencil = make(
  <>
    <path d="m14.5 5 4.5 4.5L8.5 20H4v-4.5L14.5 5Z" />
    <path d="m12.5 7 4.5 4.5" />
  </>,
)
export const IX = make(<path d="m6 6 12 12M18 6 6 18" />)
export const ICheck = make(<path d="m4.5 12.5 5 5L19.5 7" />)
export const IChevronDown = make(<path d="m6 9.5 6 6 6-6" />)
export const IChevronRight = make(<path d="m9.5 6 6 6-6 6" />)
export const ISend = make(
  <>
    <path d="M21 3 10.5 13.5" />
    <path d="M21 3 14 21l-3.5-7.5L3 10 21 3Z" />
  </>,
)
export const IPlay = make(<path d="M7 4.8v14.4L19 12 7 4.8Z" />)
export const IStop = make(<rect x={6} y={6} width={12} height={12} rx={2} />)
export const IFileDown = make(
  <>
    <path d="M6 3h8l4 4v14H6V3Z" />
    <path d="M12 9v6m0 0-2.5-2.5M12 15l2.5-2.5" />
  </>,
)
export const IEye = make(
  <>
    <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" />
    <circle cx={12} cy={12} r={2.8} />
  </>,
)
export const IEyeOff = make(
  <>
    <path d="M4 4.5 20 20" />
    <path d="M9.9 6a9.6 9.6 0 0 1 2.1-.5c6 0 9.5 6.5 9.5 6.5a17 17 0 0 1-2.8 3.6M6.3 7.4A16 16 0 0 0 2.5 12S6 18.5 12 18.5a9 9 0 0 0 3.5-.7" />
    <path d="M9.5 9.8a2.8 2.8 0 0 0 4 3.9" />
  </>,
)
export const ILock = make(
  <>
    <rect x={5.5} y={10.5} width={13} height={9.5} rx={2} />
    <path d="M8.5 10.5V7.5a3.5 3.5 0 0 1 7 0v3" />
  </>,
)
export const IUnlock = make(
  <>
    <rect x={5.5} y={10.5} width={13} height={9.5} rx={2} />
    <path d="M8.5 10.5V7.5a3.5 3.5 0 0 1 6.8-1" />
  </>,
)
export const IAlert = make(
  <>
    <path d="M12 3.5 22 20H2L12 3.5Z" />
    <path d="M12 9.5v4.5" />
    <circle cx={12} cy={17} r={0.9} fill="currentColor" stroke="none" />
  </>,
)
export const IInfo = make(
  <>
    <circle cx={12} cy={12} r={9} />
    <path d="M12 11v5.5" />
    <circle cx={12} cy={7.8} r={0.9} fill="currentColor" stroke="none" />
  </>,
)
export const IMessage = make(
  <path d="M4 5.5h16v11H9l-5 4v-15Z" />
)
export const IInbox = make(
  <>
    <path d="M3.5 13.5 6 5h12l2.5 8.5" />
    <path d="M3.5 13.5h5l1.5 2.5h4l1.5-2.5h5V19h-17v-5.5Z" />
  </>,
)
