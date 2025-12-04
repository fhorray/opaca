import './index.css';
import React from 'react';
import { DevtoolsPanel } from 'opaca-devtools';

const Layout = ({ children }: { children: React.ReactNode }) => {
  return (
    <>
      {children}
      <DevtoolsPanel />
    </>
  );
};

export default Layout;
