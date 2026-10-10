import React from 'react';
export default function PageHeader({ Icon, eyebrow, title, description, children }) {
  return <header className="nexus-page-header"><div><div className="nexus-page-eyebrow"><span><Icon size={18}/></span>{eyebrow}</div><h1>{title}</h1><p>{description}</p></div><div className="nexus-page-actions">{children}</div></header>;
}
