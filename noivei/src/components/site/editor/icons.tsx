// Ícones do editor do site (traço, herdam currentColor).
type IconProps = { size?: number }

function Svg({ size = 18, strokeWidth = 1.8, children }: { size?: number; strokeWidth?: number; children: React.ReactNode }) {
  return (
    <svg aria-hidden width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      {children}
    </svg>
  )
}

export const ImageIcon = ({ size }: IconProps) => <Svg size={size}><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" /></Svg>
export const HeartIcon = ({ size }: IconProps) => <Svg size={size}><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" /></Svg>
export const MapPinIcon = ({ size }: IconProps) => <Svg size={size}><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" /></Svg>
export const MailCheckIcon = ({ size }: IconProps) => <Svg size={size}><path d="M22 13V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h9" /><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" /><path d="m16 19 2 2 4-4" /></Svg>
export const GiftIcon = ({ size }: IconProps) => <Svg size={size}><polyline points="20 12 20 22 4 22 4 12" /><rect x="2" y="7" width="20" height="5" /><path d="M12 22V7M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7zM12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z" /></Svg>
export const CameraIcon = ({ size }: IconProps) => <Svg size={size}><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" /><circle cx="12" cy="13" r="4" /></Svg>
export const GlobeIcon = ({ size = 16 }: IconProps) => <Svg size={size}><circle cx="12" cy="12" r="10" /><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" /></Svg>
export const EyeIcon = ({ size = 16 }: IconProps) => <Svg size={size}><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></Svg>
export const ShareIcon = ({ size = 16 }: IconProps) => <Svg size={size}><circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><path d="m8.59 13.51 6.83 3.98M15.41 6.51l-6.82 3.98" /></Svg>
export const CopyIcon = ({ size = 16 }: IconProps) => <Svg size={size}><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></Svg>
export const DownloadIcon = ({ size = 16 }: IconProps) => <Svg size={size}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></Svg>
export const UploadIcon = ({ size = 16 }: IconProps) => <Svg size={size} ><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" /></Svg>
export const PlusIcon = ({ size = 15 }: IconProps) => <Svg size={size} strokeWidth={2}><path d="M12 5v14M5 12h14" /></Svg>
export const TrashIcon = ({ size = 14 }: IconProps) => <Svg size={size}><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" /></Svg>
export const CropIcon = ({ size = 14 }: IconProps) => <Svg size={size}><path d="M6 2v14a2 2 0 0 0 2 2h14" /><path d="M18 22V8a2 2 0 0 0-2-2H2" /></Svg>
export const ArrowUpIcon = ({ size = 14 }: IconProps) => <Svg size={size} strokeWidth={2}><line x1="12" y1="19" x2="12" y2="5" /><polyline points="5 12 12 5 19 12" /></Svg>
export const ArrowDownIcon = ({ size = 14 }: IconProps) => <Svg size={size} strokeWidth={2}><line x1="12" y1="5" x2="12" y2="19" /><polyline points="19 12 12 19 5 12" /></Svg>
export const ArrowLeftIcon = ({ size = 14 }: IconProps) => <Svg size={size} strokeWidth={2}><line x1="19" y1="12" x2="5" y2="12" /><polyline points="12 19 5 12 12 5" /></Svg>
export const ArrowRightIcon = ({ size = 14 }: IconProps) => <Svg size={size} strokeWidth={2}><line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" /></Svg>
export const CheckIcon = ({ size = 14 }: IconProps) => <Svg size={size} strokeWidth={2.4}><polyline points="20 6 9 17 4 12" /></Svg>
export const XIcon = ({ size = 14 }: IconProps) => <Svg size={size} strokeWidth={2.4}><path d="M18 6 6 18M6 6l12 12" /></Svg>
export const ChevronDownIcon = ({ size = 16 }: IconProps) => <Svg size={size} strokeWidth={2}><polyline points="6 9 12 15 18 9" /></Svg>
export const MonitorIcon = ({ size = 15 }: IconProps) => <Svg size={size}><rect x="2" y="3" width="20" height="14" rx="2" /><path d="M8 21h8M12 17v4" /></Svg>
export const PhoneIcon = ({ size = 15 }: IconProps) => <Svg size={size}><rect x="6" y="2" width="12" height="20" rx="2" /><path d="M11 18h2" /></Svg>
export const WhatsAppIcon = ({ size = 16 }: IconProps) => (
  <svg aria-hidden width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38a9.9 9.9 0 0 0 4.74 1.21h.01c5.46 0 9.91-4.45 9.91-9.91A9.85 9.85 0 0 0 12.04 2zm5.8 14.03c-.24.68-1.42 1.32-1.96 1.37-.5.05-1.13.07-1.82-.11-.42-.13-.96-.31-1.65-.61-2.9-1.25-4.79-4.17-4.94-4.36-.14-.19-1.18-1.57-1.18-3s.75-2.13 1.02-2.42c.27-.29.58-.36.78-.36h.56c.18 0 .42-.07.66.5.24.58.82 2 .89 2.15.07.14.12.31.02.5-.1.19-.14.31-.29.48-.14.17-.3.37-.43.5-.14.14-.29.3-.13.59.17.29.74 1.22 1.58 1.97 1.09.97 2 1.27 2.29 1.41.29.14.46.12.63-.07.17-.19.72-.84.92-1.13.19-.29.38-.24.65-.14.27.1 1.7.8 1.99.95.29.14.48.22.55.34.07.12.07.7-.17 1.38z" />
  </svg>
)
export const PaletteIcon = ({ size }: IconProps) => <Svg size={size}><path d="M12 3a9 9 0 1 0 0 18c1.1 0 1.8-.8 1.8-1.8 0-.5-.2-.9-.5-1.2-.3-.3-.5-.7-.5-1.2 0-1 .8-1.8 1.8-1.8H17a4 4 0 0 0 4-4c0-4.4-4-8-9-8Z" /><circle cx="7.5" cy="11" r="1" /><circle cx="10" cy="7" r="1" /><circle cx="15" cy="7.5" r="1" /></Svg>
export const LayersIcon = ({ size }: IconProps) => <Svg size={size}><polygon points="12 3 21 8 12 13 3 8 12 3" /><polyline points="3 13 12 18 21 13" /></Svg>
export const HelpIcon = ({ size }: IconProps) => <Svg size={size}><circle cx="12" cy="12" r="9" /><path d="M9.5 9.2a2.6 2.6 0 0 1 5 .9c0 1.7-2.5 2.3-2.5 3.9" /><circle cx="12" cy="17" r=".6" fill="currentColor" /></Svg>
