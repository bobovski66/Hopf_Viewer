# Hopf Viewer — Mobile + S² Panel

Interactive Hopf fibers viewer with:
- **Two projections:** stereographic \(S^3\to\mathbb{R}^3\) and **softmax** \(\mathbb{R}^4\xrightarrow{\mathrm{softmax}_\alpha}\Delta^3\hookrightarrow\mathbb{R}^3\).
- **S² base panel:** tap/click in the disk to add custom fibers; choose North/South hemisphere.
- **Mobile-ready:** one-finger rotate, two-finger pinch to zoom, double-tap reset, collapsible controls.

## Files
- `index.html` — UI + layout
- `style.css` — dark theme + responsive panel
- `hopf.js` — math, rendering, mobile gestures
- `README.md` — quick notes

## Controls
- Projection: **Stereographic** or **Softmax** (Δ³ via tetrahedron).
- α (softmax temperature), latitude rings, longitudes per ring, segments per fiber, line width.
- Show/hide the tetrahedron scaffold in softmax mode.
- S² panel: hemisphere selector, show/hide grid vs custom fibers, remove last/clear custom fibers.

## Gestures (Mobile)
- **One-finger drag:** rotate
- **Two-finger pinch:** zoom
- **Double-tap:** reset view
- **☰ button:** open/close the control panel

## Math
For basepoint \(n=(n_x,n_y,n_z)\in S^2\), let \(\eta=\tfrac12\arccos(n_z)\) and \(\delta=\arg(n_x+i n_y)\).
Fiber: \(z_1=\cos\eta\,e^{i(\delta+\theta)},\; z_2=\sin\eta\,e^{i\theta},\; \theta\in[0,2\pi]\).  
Embed \(S^3\subset\mathbb{R}^4\) via \((x_1,x_2,x_3,x_4)=(\Re z_1,\Im z_1,\Re z_2,\Im z_2)\).  
Projections: stereographic \((x_1,x_2,x_3)/(1-x_4)\), or softmax \(p_i\propto e^{\alpha x_i}\) then barycentric map of \(\Delta^3\) to a regular tetrahedron.
