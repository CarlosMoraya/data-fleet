import React from 'react';
import { Link } from 'react-router-dom';

interface LinkedRecordLinkProps {
  to: string;
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}

export default function LinkedRecordLink({ to, title, icon, children }: LinkedRecordLinkProps) {
  return (
    <Link
      to={to}
      title={title}
      className="group inline-flex items-start gap-1.5 rounded-lg text-left transition-colors hover:text-orange-600 focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:outline-none"
    >
      {icon}
      <span className="underline decoration-dotted underline-offset-2 group-hover:decoration-solid">{children}</span>
    </Link>
  );
}
