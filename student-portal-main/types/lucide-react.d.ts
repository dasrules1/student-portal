declare module 'lucide-react' {
  import { ComponentType } from 'react';
  
  interface IconProps extends React.SVGProps<SVGSVGElement> {
    size?: number | string;
    absoluteStrokeWidth?: boolean;
  }

  export const BookOpen: ComponentType<IconProps>;
  export const FileQuestion: ComponentType<IconProps>;
  export const FileText: ComponentType<IconProps>;
  export const CheckCircle2: ComponentType<IconProps>;
  export const Clock: ComponentType<IconProps>;
  export const Pencil: ComponentType<IconProps>;
  export const Calculator: ComponentType<IconProps>;
  export const Loader2: ComponentType<IconProps>;
  export const Send: ComponentType<IconProps>;
  export const ArrowLeft: ComponentType<IconProps>;
  export const ArrowRight: ComponentType<IconProps>;
  export const Video: ComponentType<IconProps>;
  export const AlertCircle: ComponentType<IconProps>;
}
