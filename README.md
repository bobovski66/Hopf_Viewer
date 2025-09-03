# Hopf Viewer — Stereographic & Softmax Coordinates

This tiny, dependency-free viewer renders Hopf fibers as circles in S³ and projects them to 3D in two ways:

1. **Stereographic:** 

   	\((x_1,x_2,x_3,x_4) \mapsto (x_1,x_2,x_3)/(1-x_4)\in\mathbb{R}^3\).

2. **Softmax coordinates:** 

   	Given \(v\in\mathbb{R}^4\), compute \(p_i = \operatorname{softmax}_\alpha(v_i)\) and embed the 3-simplex \(\Delta^3\) into \(\mathbb{R}^3\) via barycentric coordinates of a regular tetrahedron.

## Controls

- Projection mode: *Stereographic* or *Softmax*.
- Softmax temperature \(\alpha\) (visibility of “probability corners”).
- Number of latitude rings and longitudes per ring (basepoint sampling on \(S^2\)).
- Segments per fiber (sampling along the circle fiber).  
- Line width, and an option to show the tetrahedron outline (softmax).

**Mouse:** drag to rotate; **wheel:** zoom; click **Regenerate** after changing counts.

## How fibers are generated

For a chosen basepoint \(n=(n_x,n_y,n_z)\in S^2\), let \(\eta = \tfrac12\arccos(n_z)\) and \(\delta = \mathrm{arg}(n_x + i n_y)\). We parametrize the fiber by \(\theta\in[0,2\pi]\) with

\[ z_1 = \cos\eta\,e^{i(\delta+\theta)},\qquad z_2 = \sin\eta\,e^{i\theta}, \]

and then \( (x_1,x_2,x_3,x_4)=(\Re z_1,\Im z_1,\Re z_2,\Im z_2)\in S^3\subset\mathbb{R}^4\).

## License

MIT.


## S² Base Panel

A clickable orthographic S² panel is included in the sidebar. Choose the hemisphere (north/south), then click inside the circle to add a custom Hopf fiber at the corresponding basepoint. You can toggle visibility of the sampled grid fibers vs your custom fibers, and clear or undo custom additions.

Orthographic inverse: a click at normalized disk coords \((x,y)\) with \(x^2+y^2\le 1\) maps to \(n=(x,y,\pm\sqrt{1-x^2-y^2})\) on \(S^2\), where the sign is chosen by the hemisphere selector.
