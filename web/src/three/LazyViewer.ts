import { lazy } from 'react';

// three.js + react-three-fiber are heavy: load them only when a 3D view is first shown.
export const Viewer3D = lazy(() => import('./Viewer3D'));
