const Icon = ({ children, size = 20, ...props }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>{children}</svg>
)

export const SearchIcon = (props) => <Icon {...props}><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></Icon>
export const EditIcon = (props) => <Icon {...props}><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4Z"/></Icon>
export const TrashIcon = (props) => <Icon {...props}><path d="M3 6h18M8 6V4h8v2m3 0-1 15H6L5 6m5 4v7m4-7v7"/></Icon>
export const PlusIcon = (props) => <Icon {...props}><path d="M12 5v14M5 12h14"/></Icon>
export const SaveIcon = (props) => <Icon {...props}><path d="M5 3h12l3 3v15H4V3Z"/><path d="M8 3v6h8V3M8 21v-8h8v8"/></Icon>
export const CalendarIcon = (props) => <Icon {...props}><path d="M4 5h16v15H4zM8 3v4m8-4v4M4 10h16"/></Icon>
export const UploadIcon = (props) => <Icon {...props}><path d="M12 16V4m0 0L7 9m5-5 5 5"/><path d="M5 14v6h14v-6"/></Icon>
export const ArrowLeftIcon = (props) => <Icon {...props}><path d="m15 18-6-6 6-6"/></Icon>
export const UsersIcon = (props) => <Icon {...props}><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm13 10v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></Icon>
export const CheckIcon = (props) => <Icon {...props}><path d="m5 12 4 4L19 6"/></Icon>
export const CloseIcon = (props) => <Icon {...props}><path d="M6 6l12 12M18 6 6 18"/></Icon>
