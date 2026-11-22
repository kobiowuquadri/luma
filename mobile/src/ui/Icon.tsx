import Svg, { Circle, Path, Rect } from 'react-native-svg';

/**
 * LUMA's icon set: simple stroke drawings on a 24-unit grid. Icons are
 * always paired with a visible text label or an accessibilityLabel.
 */
export type IconName =
  | 'camera' | 'image' | 'board' | 'book' | 'eye' | 'sun' | 'globe' | 'speaker' | 'stop' | 'mic'
  | 'send' | 'question' | 'explain' | 'textSize' | 'back' | 'more' | 'trash' | 'pencil' | 'check'
  | 'close' | 'warning' | 'offline' | 'play' | 'zoomIn' | 'zoomOut' | 'photo' | 'bell' | 'info'
  | 'chevron' | 'plus' | 'minus' | 'refresh' | 'lock' | 'line';

interface Props {
  name: IconName;
  size?: number;
  color: string;
  strokeWidth?: number;
}

export function Icon({ name, size = 24, color, strokeWidth = 2 }: Props) {
  const p = { stroke: color, strokeWidth, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, fill: 'none' };
  const f = { fill: color };
  let body: React.ReactNode;
  switch (name) {
    case 'camera':
      body = (<><Path {...p} d="M4 8h3l2-3h6l2 3h3v11H4z" /><Circle {...p} cx={12} cy={13} r={3.5} /></>);
      break;
    case 'image':
      body = (<><Rect {...p} x={3.5} y={4.5} width={17} height={15} rx={2} /><Circle {...p} cx={9} cy={10} r={1.8} /><Path {...p} d="M4 18l5-5 4 4 3-3 4 4" /></>);
      break;
    case 'board':
      body = (<><Rect {...p} x={3} y={4} width={18} height={12} rx={1} /><Path {...p} d="M7 9h6M7 12h9M9 16l-2 4M15 16l2 4" /></>);
      break;
    case 'book':
      body = (<><Path {...p} d="M5 4h10a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3z" /><Path {...p} d="M5 17a3 3 0 0 1 3-3h10" /></>);
      break;
    case 'eye':
      body = (<><Path {...p} d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" /><Circle {...p} cx={12} cy={12} r={3} /></>);
      break;
    case 'sun':
      body = (<><Circle {...p} cx={12} cy={12} r={4} /><Path {...p} d="M12 2.5v2.5M12 19v2.5M2.5 12H5M19 12h2.5M5.2 5.2 7 7M17 17l1.8 1.8M5.2 18.8 7 17M17 7l1.8-1.8" /></>);
      break;
    case 'globe':
      body = (<><Circle {...p} cx={12} cy={12} r={9} /><Path {...p} d="M3 12h18M12 3c3 3.2 3 14.8 0 18M12 3c-3 3.2-3 14.8 0 18" /></>);
      break;
    case 'speaker':
      body = (<><Path {...p} d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" /><Path {...p} d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11" /></>);
      break;
    case 'stop':
      body = <Rect x={6} y={6} width={12} height={12} rx={2} {...f} />;
      break;
    case 'play':
      body = <Path d="M8 5.5v13l10.5-6.5z" {...f} />;
      break;
    case 'mic':
      body = (<><Rect {...p} x={9} y={3} width={6} height={11} rx={3} /><Path {...p} d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21" /></>);
      break;
    case 'send':
      body = <Path {...p} d="M4 12 20 4l-5 16-3-7z" />;
      break;
    case 'question':
      body = (<><Path {...p} d="M4 5h16v11H9l-5 4z" /><Path {...p} d="M10 8.5a2 2 0 1 1 2.6 1.9c-.4.2-.6.5-.6 1v.4" /><Circle cx={12} cy={13.6} r={0.9} {...f} /></>);
      break;
    case 'explain':
      body = (<><Path {...p} d="M3 6h8M7 4v2M5 6c0 3 3 6 6 7M9 6c0 2.5-2 5-6 7" /><Path {...p} d="M13 20l4-9 4 9M14.5 17h5" /></>);
      break;
    case 'textSize':
      body = (<><Path {...p} d="M3 18 8 6l5 12M4.8 14h6.4" /><Path {...p} d="M14 18l3.5-8 3.5 8M15.2 15.5h4.6" /></>);
      break;
    case 'back':
      body = <Path {...p} d="M15 5l-7 7 7 7" />;
      break;
    case 'chevron':
      body = <Path {...p} d="M9 5l7 7-7 7" />;
      break;
    case 'more':
      body = (<><Circle cx={5} cy={12} r={1.8} {...f} /><Circle cx={12} cy={12} r={1.8} {...f} /><Circle cx={19} cy={12} r={1.8} {...f} /></>);
      break;
    case 'trash':
      body = <Path {...p} d="M4 7h16M9 7V4.5h6V7M6.5 7l1 13h9l1-13M10 11v5M14 11v5" />;
      break;
    case 'pencil':
      body = <Path {...p} d="M4 20l1-4.5L15.5 5a2 2 0 0 1 3 3L8 18.5zM14 6.5l3 3" />;
      break;
    case 'check':
      body = <Path {...p} d="M5 12.5l4.5 4.5L19 7" />;
      break;
    case 'close':
      body = <Path {...p} d="M6 6l12 12M18 6 6 18" />;
      break;
    case 'warning':
      body = (<><Path {...p} d="M12 3.5 2.5 20h19z" /><Path {...p} d="M12 9.5v5" /><Circle cx={12} cy={17.3} r={1} {...f} /></>);
      break;
    case 'offline':
      body = <Path {...p} d="M3 3l18 18M8.5 16.5a5 5 0 0 1 7 0M5 13a10 10 0 0 1 4.5-2.6M14.5 10.4A10 10 0 0 1 19 13M2 9.5a14.5 14.5 0 0 1 4-2.6M11 5.6A14.5 14.5 0 0 1 22 9.5" />;
      break;
    case 'zoomIn':
      body = (<><Circle {...p} cx={10.5} cy={10.5} r={6.5} /><Path {...p} d="M15.5 15.5 21 21M8 10.5h5M10.5 8v5" /></>);
      break;
    case 'zoomOut':
      body = (<><Circle {...p} cx={10.5} cy={10.5} r={6.5} /><Path {...p} d="M15.5 15.5 21 21M8 10.5h5" /></>);
      break;
    case 'photo':
      body = (<><Path {...p} d="M5 4l13-1.5 1.5 15L6.5 19z" /><Path {...p} d="M8 8.5l7.5-.8M8.3 11.5l7.5-.8M8.6 14.5l5-.5" /></>);
      break;
    case 'bell':
      body = <Path {...p} d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15zM10 20.5a2.2 2.2 0 0 0 4 0" />;
      break;
    case 'info':
      body = (<><Circle {...p} cx={12} cy={12} r={9} /><Path {...p} d="M12 11v6" /><Circle cx={12} cy={7.6} r={1.1} {...f} /></>);
      break;
    case 'plus':
      body = <Path {...p} d="M12 5v14M5 12h14" />;
      break;
    case 'minus':
      body = <Path {...p} d="M5 12h14" />;
      break;
    case 'refresh':
      body = <Path {...p} d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3M19.5 4v4.5H15" />;
      break;
    case 'lock':
      body = (<><Rect {...p} x={5} y={10.5} width={14} height={10} rx={2} /><Path {...p} d="M8 10.5V8a4 4 0 0 1 8 0v2.5" /></>);
      break;
    case 'line':
      // LUMA's mark: a tilted photographed line becoming a straight line of text.
      body = (<><Path {...p} strokeWidth={1.5} d="M3 7.5l9-1.8" opacity={0.55} /><Path {...p} strokeWidth={1.5} d="M3.5 11l9-1.8" opacity={0.55} /><Path {...p} strokeWidth={3} d="M5 17h15" /></>);
      break;
  }
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {body}
    </Svg>
  );
}
