/*
  bounty-3d.js — interactive 3D "Vault Core" for the bug bounty matrix cell.
  A wireframe vault, three orbiting findings, drag to inspect. Runs plain with
  THREE (r149 global build) — no addons, no build step.
*/
(function () {
    var host = document.getElementById('bounty3d');
    if (!host) return;

    var reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var isMobile = window.matchMedia('(max-width: 768px)').matches;

    function fail(msg) {
        host.innerHTML = '<div style="padding:10px;font-size:.6rem;letter-spacing:.18em;color:#ff9e5e;text-transform:uppercase">' + msg + '</div>';
    }

    if (typeof THREE === 'undefined') { fail('3d needs internet (three.js)'); return; }

    var renderer;
    try {
        renderer = new THREE.WebGLRenderer({ alpha: true, antialias: !isMobile });
    } catch (e) { fail('no webgl'); return; }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    host.appendChild(renderer.domElement);

    var scene = new THREE.Scene();
    var camera = new THREE.PerspectiveCamera(46, 1, 0.1, 100);
    camera.position.set(0, 1.2, 6.2);
    camera.lookAt(0, 0, 0);

    // ---- vault core: acid-yellow wireframe icosahedron over an onyx body ----
    var icoGeo = new THREE.IcosahedronGeometry(1.45, 0);
    var coreLine = new THREE.LineSegments(
        new THREE.WireframeGeometry(icoGeo),
        new THREE.LineBasicMaterial({ color: 0xd0ff00, transparent: true, opacity: 0.85 })
    );
    var coreFill = new THREE.Mesh(
        icoGeo,
        new THREE.MeshBasicMaterial({ color: 0x08080a, transparent: true, opacity: 0.35, wireframe: false })
    );

    // orbit ring: soft-orange torus, tilted
    var ring = new THREE.Mesh(
        new THREE.TorusGeometry(2.35, 0.03, 8, 72),
        new THREE.MeshBasicMaterial({ color: 0xff9e5e, transparent: true, opacity: 0.55 })
    );
    ring.rotation.x = Math.PI / 2.2;
    ring.rotation.z = 0.4;

    var band = new THREE.Mesh(
        new THREE.TorusGeometry(1.85, 0.015, 6, 60),
        new THREE.MeshBasicMaterial({ color: 0xd0ff00, transparent: true, opacity: 0.3 })
    );
    band.rotation.x = Math.PI / 2.6;
    band.rotation.y = 0.9;

    // ---- three findings orbit the vault ------------------------------------
    var RED = 0xff5d4e, YELLOW = 0xd0ff00, ORANGE = 0xff9e5e;
    var findings = [];
    [YELLOW, ORANGE, RED].forEach(function (c, i) {
        var g = new THREE.Group();
        var orb = new THREE.Mesh(
            new THREE.IcosahedronGeometry(0.16, 0),
            new THREE.MeshBasicMaterial({ color: c })
        );
        var glow = new THREE.Mesh(
            new THREE.SphereGeometry(0.34, 16, 12),
            new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.18 })
        );
        g.add(glow);
        g.add(orb);
        g.position.x = Math.cos(i * 2.094 + 0.5) * 2.7;
        g.position.z = Math.sin(i * 2.094 + 0.5) * 2.7;
        g.position.y = (i - 1) * 0.7;
        scene.add(g);
        findings.push({ g: g, o: i * 0.8, pos: g.position.clone() });
    });

    var root = new THREE.Group();
    root.add(coreFill, coreLine, ring, band, findings[0].g, findings[1].g, findings[2].g);
    // findings orbit added to root via their transform; keep original offset
    scene.add(root);

    // manual drag state (no OrbitControls — dependency-free)
    var dragging = false, moved = false, suppressClick = false;
    var rx = 0, ry = 0, vx = 0, vy = 0, tx = 0, ty = 0;

    function onDown(e) {
        dragging = true; moved = false; suppressClick = false;
        tx = e.clientX; ty = e.clientY;
        host.style.pointerEvents = 'auto';
    }
    function onMove(e) {
        if (!dragging) return;
        var dx = e.clientX - tx, dy = e.clientY - ty;
        if (Math.abs(dx) + Math.abs(dy) > 4) { moved = true; suppressClick = true; }
        vy = dx * 0.008;
        vx = dy * 0.008;
        rx += vx; ry += vy;
        tx = e.clientX; ty = e.clientY;
    }
    function onUp() {
        dragging = false;
        if (suppressClick) {
            // a drag is a drag — don't let it also toggle the matrix cell
            document.addEventListener('click', killOnce, { capture: true, once: true });
        }
    }
    function killOnce(e) { e.stopPropagation(); }
    host.addEventListener('pointerdown', onDown);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    host.addEventListener('click', function (e) { e.stopPropagation(); });

    // resize to fill the matrix cell
    function resize() {
        var r = host.getBoundingClientRect();
        if (r.width < 4 || r.height < 4) return;
        renderer.setSize(r.width, r.height, false);
        camera.aspect = r.width / r.height;
        camera.updateProjectionMatrix();
    }
    resize();
    if (window.ResizeObserver) new ResizeObserver(resize).observe(host);
    window.addEventListener('resize', resize);

    var t = 0, visible = true;
    document.addEventListener('visibilitychange', function () {
        visible = !document.hidden;
    });

    function frame() {
        requestAnimationFrame(frame);
        if (!visible) return;

        // idle inertia + gentle autorotate (skipped under reduced-motion)
        if (!dragging) {
            if (!reducedMotion) { ry += 0.0035; rx += 0.0012; }
            ry += vy; rx += vx; vy *= 0.94; vx *= 0.94;
        }
        // ease back to the idle tilt so it never drifts awkward
        rx = rx * 0.5 + (reducedMotion ? 0.35 : 0.32) * 0.5;

        root.rotation.y = ry;
        root.rotation.x = rx;

        t += 0.016;
        // findings slowly swarm around the vault
        findings.forEach(function (f, i) {
            var a = t * (0.5 + i * 0.18) + f.o;
            f.g.position.set(
                Math.cos(a) * 2.7,
                f.pos.y + Math.sin(t * 1.4 + f.o) * 0.25,
                Math.sin(a) * 2.7
            );
            f.g.rotation.y = -a;
            f.g.rotation.z = t * 0.4;
        });
        ring.rotation.z = t * 0.15;
        band.rotation.z = -t * 0.22;

        renderer.render(scene, camera);
    }
    frame();
})();