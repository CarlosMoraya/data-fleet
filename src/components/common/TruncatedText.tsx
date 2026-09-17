import React from 'react';

import { cn } from '../../lib/utils';

interface TruncatedTextProps {
  text: string;
  maxLength: number;
  className?: string;
}

export default function TruncatedText({ text, maxLength, className }: TruncatedTextProps): React.ReactElement {
  const [expanded, setExpanded] = React.useState(false);

  if (text.length <= maxLength) {
    return <span className={className}>{text}</span>;
  }

  return (
    <button
      type="button"
      title={text}
      aria-label={text}
      aria-expanded={expanded}
      onClick={() => setExpanded((v) => !v)}
      className={cn('cursor-pointer text-left', expanded && 'break-all', className)}
    >
      {expanded ? text : `${text.slice(0, maxLength)}…`}
    </button>
  );
}
