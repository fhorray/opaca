import './index.css';
import React, { useEffect } from 'react';
import { DevtoolsPanel } from 'opaca-devtools';
import { useDevtools } from 'opaca-devtools';
const Layout = ({ children }: { children: React.ReactNode }) => {
  return (
    <>
      {children}
      <DevtoolsPanel />
    </>
  );
};

export default Layout;
