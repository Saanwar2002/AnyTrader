import * as lucide from 'lucide-react';
const icons = ['LogOut', 'User', 'Mail', 'MapPin', 'Calendar', 'Shield', 'Edit2', 'Check', 'X', 'Loader2', 'Download', 'FileCheck', 'Upload', 'Clock', 'Star', 'Image', 'Trash2', 'Briefcase', 'ChevronRight', 'Plus', 'Bell', 'Layout', 'Home', 'CreditCard', 'Bot', 'BarChart3', 'Search', 'History', 'Zap', 'HelpCircle', 'FileText', 'Pencil', 'Camera', 'GripVertical', 'Info', 'BookOpen', 'AlertCircle', 'Users', 'ChevronDown', 'ShieldCheck', 'CheckCircle', 'CheckCircle2', 'Heart', 'Moon', 'Award', 'RefreshCw', 'Pause', 'Play', 'XCircle'];
icons.forEach(i => {
  if (!(lucide as any)[i]) console.log('Missing:', i);
});
