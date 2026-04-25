'use client';

import { useEffect, useState } from 'react';
import { getAuth } from '@/app/lib/auth';
import LifaiCat from '@/components/LifaiCat';

export default function LifaiCatGlobal() {
  const [loginId, setLoginId] = useState<string>('');

  useEffect(() => {
    const auth = getAuth();
    const id =
      (auth as any)?.id ||
      (auth as any)?.loginId ||
      (auth as any)?.login_id ||
      '';
    setLoginId(id);
  }, []);

  return <LifaiCat loginId={loginId} />;
}
