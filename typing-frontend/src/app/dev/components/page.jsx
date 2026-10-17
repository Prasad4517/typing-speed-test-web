import { notFound } from 'next/navigation';

import { ComponentGallery } from '@/features/dev-components/component-gallery';

export default function ComponentsPage() {
  if (process.env.NODE_ENV === 'production') notFound();
  return <ComponentGallery />;
}
