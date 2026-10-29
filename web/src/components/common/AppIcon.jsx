import {
  Squares2X2Icon, MagnifyingGlassIcon, ArchiveBoxIcon, SparklesIcon,
  ClipboardDocumentListIcon, ChartBarIcon, TagIcon, UsersIcon, MapPinIcon,
  ChatBubbleLeftRightIcon, ClockIcon, StarIcon, Cog6ToothIcon, Bars3Icon,
  XMarkIcon, ChevronRightIcon, ChevronDownIcon, ArrowRightIcon, ArrowLeftIcon,
  ArrowPathIcon, PlusIcon, PencilSquareIcon, TrashIcon, CheckIcon,
  CheckCircleIcon, ExclamationTriangleIcon, InformationCircleIcon, XCircleIcon,
  SunIcon, MoonIcon, AdjustmentsHorizontalIcon, ArrowRightOnRectangleIcon,
  ShieldCheckIcon, EnvelopeIcon, LockClosedIcon, EyeIcon, EyeSlashIcon,
  PhotoIcon, ArrowUpTrayIcon, ArrowDownTrayIcon, PrinterIcon, DocumentTextIcon,
  PaperAirplaneIcon, BoltIcon, BuildingOffice2Icon, BellIcon, LinkIcon,
} from '@heroicons/react/24/outline';

const icons = {
  dashboard: Squares2X2Icon, search: MagnifyingGlassIcon, box: ArchiveBoxIcon,
  matching: SparklesIcon, activity: ClipboardDocumentListIcon, chart: ChartBarIcon,
  tag: TagIcon, users: UsersIcon, location: MapPinIcon, messages: ChatBubbleLeftRightIcon,
  clock: ClockIcon, star: StarIcon, settings: Cog6ToothIcon, menu: Bars3Icon,
  close: XMarkIcon, chevron: ChevronRightIcon, down: ChevronDownIcon,
  arrow: ArrowRightIcon, back: ArrowLeftIcon, refresh: ArrowPathIcon, plus: PlusIcon,
  edit: PencilSquareIcon, delete: TrashIcon, check: CheckIcon, success: CheckCircleIcon,
  warning: ExclamationTriangleIcon, info: InformationCircleIcon, error: XCircleIcon,
  sun: SunIcon, moon: MoonIcon, contrast: AdjustmentsHorizontalIcon,
  logout: ArrowRightOnRectangleIcon, shield: ShieldCheckIcon, email: EnvelopeIcon,
  lock: LockClosedIcon, eye: EyeIcon, eyeOff: EyeSlashIcon, image: PhotoIcon,
  upload: ArrowUpTrayIcon, download: ArrowDownTrayIcon, print: PrinterIcon,
  document: DocumentTextIcon, send: PaperAirplaneIcon, bolt: BoltIcon,
  building: BuildingOffice2Icon, bell: BellIcon, link: LinkIcon,
};
export default function AppIcon({ name, className = '', ...props }) {
  const Icon = icons[name] || ArchiveBoxIcon;
  return <Icon className={`app-icon ${className}`} aria-hidden="true" {...props} />;
}
