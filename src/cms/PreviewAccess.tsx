import { useEffect, useState } from 'react';
import { Link, useRouterState } from '@tanstack/react-router';
import { Settings } from 'lucide-react';
import { Button } from '../components/ui/button.tsx';
import { showPreviewAccess } from './preview-access.ts';

export function PreviewAccess() {
  const location = useRouterState({ select: state => state.location });
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setVisible(showPreviewAccess(import.meta.env.DEV, window.location.hostname, location.pathname, new URLSearchParams(window.location.search).get('cms')));
  }, [location.href, location.pathname]);

  if (!visible) return null;
  return (
    <div className="dark sw-admin fixed bottom-5 right-5 z-40">
      <Button variant="brand" asChild title="CMS Beheer">
        <Link to="/smart-websites"><Settings className="mr-2 h-4 w-4" />CMS Beheer</Link>
      </Button>
    </div>
  );
}