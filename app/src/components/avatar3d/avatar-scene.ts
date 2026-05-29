/**
 * Generates a self-contained HTML document with a three.js scene
 * that loads and animates a Wolf3D .glb avatar.
 *
 * Uses inline three.js (passed as parameter) to avoid CDN loading issues
 * in Android/iOS WebView.
 *
 * The scene receives { aiState, amplitude } via window message events
 * from React Native's injectJavaScript.
 *
 * Animation surface: drives ARKit-style blendshapes that ship on the RPM
 * Wolf3D GLB — blinks, eye gaze, brows, and pseudo-visemes — on top of the
 * existing head/spine bone sway. No phoneme detection: viseme shapes cycle
 * pseudo-randomly while `speaking`, intensity scaled by amplitude. Real
 * users aren't lip-reading; the goal is visual aliveness, not accuracy.
 */

export function getAvatarHtml(glbBase64: string, threeJsSrc: string, gltfLoaderSrc: string): string {
  return `<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width,initial-scale=1,user-scalable=no">
<style>
  * { margin: 0; padding: 0; }
  body { background: transparent; overflow: hidden; }
  canvas { display: block; width: 100vw; height: 100vh; }
  #status { position: absolute; top: 50%; left: 50%; transform: translate(-50%,-50%);
    color: rgba(255,255,255,0.5); font: 12px sans-serif; }
</style>
</head>
<body>
<div id="status">Loading 3D...</div>
<script>${threeJsSrc}</script>
<script>${gltfLoaderSrc}</script>
<script>
(function() {
  var statusEl = document.getElementById('status');

  function log(msg) {
    if (window.ReactNativeWebView) {
      window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'log', message: msg }));
    }
  }

  function sendReady() {
    if (window.ReactNativeWebView) {
      window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'ready' }));
    }
  }

  function sendError(msg) {
    if (window.ReactNativeWebView) {
      window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'error', message: msg }));
    }
  }

  if (typeof THREE === 'undefined') {
    sendError('three.js not loaded');
    statusEl.textContent = 'three.js not loaded';
    return;
  }

  if (!THREE.GLTFLoader) {
    sendError('GLTFLoader not loaded');
    statusEl.textContent = 'GLTFLoader not loaded';
    return;
  }

  log('three.js r' + THREE.REVISION);

  var DEG = Math.PI / 180;
  function lerp(a, b, t) { return a + (b - a) * t; }
  function clamp(v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v); }

  var renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setClearColor(0x000000, 0);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.outputEncoding = THREE.sRGBEncoding;
  document.body.appendChild(renderer.domElement);

  var scene = new THREE.Scene();
  var camera = new THREE.PerspectiveCamera(24, window.innerWidth / window.innerHeight, 0.1, 100);
  camera.position.set(0, 1.68, 0.85);
  camera.lookAt(0, 1.63, 0);

  scene.add(new THREE.AmbientLight(0xffffff, 0.7));
  var dirLight = new THREE.DirectionalLight(0xffffff, 1.2);
  dirLight.position.set(2, 3, 4);
  scene.add(dirLight);
  var fillLight = new THREE.DirectionalLight(0xaabbff, 0.4);
  fillLight.position.set(-2, 1, -1);
  scene.add(fillLight);

  var aiState = 'idle';
  var amplitude = 0;
  var smoothAmp = 0; // amplitude smoothed, used for viseme intensity + brow flicks
  var startTime = Date.now();

  // ---- Mouth / viseme state ----
  // Oculus viseme set shipped on RPM/Wolf3D GLBs. We don't detect phonemes;
  // we cycle through these pseudo-randomly during speaking so the mouth
  // changes shape instead of just opening on volume.
  var VISEMES = ['viseme_aa', 'viseme_E', 'viseme_I', 'viseme_O', 'viseme_U',
                 'viseme_PP', 'viseme_FF', 'viseme_kk', 'viseme_DD', 'viseme_nn'];
  var currentViseme = 'viseme_aa';
  var nextVisemeAt = 0;
  var visemeWeights = {}; // smoothed per-viseme weight, lerped each frame
  for (var vi = 0; vi < VISEMES.length; vi++) visemeWeights[VISEMES[vi]] = 0;
  var smoothMouthOpen = 0; // fallback when no visemes are present
  var smoothSmile = 0;

  // ---- Blink state ----
  // 80ms close + 100ms open; next blink scheduled 2-6s out. Suppressed during
  // listening nods so the two micro-motions don't fight.
  var blinkValue = 0; // 0 open, 1 closed
  var blinkPhase = 0; // 0 idle, 1 closing, 2 opening
  var blinkPhaseStart = 0;
  var nextBlinkAt = Date.now() + 1500;

  // ---- Eye gaze state ----
  // Target in normalized (-1..1, -1..1) eye-space; lerped toward each frame.
  // New targets picked every 1.5-3.5s, biased toward center on listening,
  // up-left/up-right on thinking ("looking up to think").
  var gazeX = 0, gazeY = 0;
  var gazeTargetX = 0, gazeTargetY = 0;
  var nextGazeAt = Date.now() + 1500;

  // ---- Head / spine state ----
  var lastNodTime = 0;
  var nodPhase = 0;

  var FACE_MESH_NAMES = ['Wolf3D_Head', 'Wolf3D_Teeth', 'EyeLeft', 'EyeRight',
                         'Wolf3D_Beard', 'Wolf3D_Outfit_Top'];
  var morphMeshes = []; // [{ mesh, dict, name }]
  var headBone = null;
  var spineBone = null;
  var headOrigQuat = null;
  var spineOrigQuat = null;

  /** Set named morph target on every mesh that exposes it. Silently
   *  no-ops on meshes that don't have that blendshape — which is fine,
   *  it just means that bit of motion won't render on this model. */
  function setMorph(name, value) {
    for (var i = 0; i < morphMeshes.length; i++) {
      var m = morphMeshes[i];
      var idx = m.dict[name];
      if (idx === undefined) continue;
      if (!m.mesh.morphTargetInfluences) continue;
      m.mesh.morphTargetInfluences[idx] = value;
    }
  }

  /** True if at least one mesh exposes this blendshape — used to decide
   *  whether to fall back to mouthOpen when visemes aren't present. */
  function hasMorph(name) {
    for (var i = 0; i < morphMeshes.length; i++) {
      if (morphMeshes[i].dict[name] !== undefined) return true;
    }
    return false;
  }

  var msgCount = 0;
  function onMsg(event) {
    try {
      var data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
      if (data.aiState !== undefined) aiState = data.aiState;
      if (data.amplitude !== undefined) amplitude = data.amplitude;
      msgCount++;
      if (msgCount % 90 === 1) {
        log('msg #' + msgCount + ' state=' + aiState + ' amp=' + amplitude.toFixed(3));
      }
    } catch(e) {}
  }
  window.addEventListener('message', onMsg);
  document.addEventListener('message', function(event) {
    try {
      var data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
      if (data.aiState !== undefined) aiState = data.aiState;
      if (data.amplitude !== undefined) amplitude = data.amplitude;
    } catch(e) {}
  });

  log('Decoding GLB...');
  try {
    var glbBase64 = "${glbBase64.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '')}";
    var binary = atob(glbBase64);
    var bytes = new Uint8Array(binary.length);
    for (var i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    log('GLB decoded: ' + bytes.length + ' bytes');

    var loader = new THREE.GLTFLoader();
    loader.parse(bytes.buffer, '', function(gltf) {
      var model = gltf.scene;
      scene.add(model);
      log('Model added to scene');

      var visemesFound = 0;
      model.traverse(function(child) {
        if (child.isMesh && FACE_MESH_NAMES.indexOf(child.name) >= 0) {
          var dict = child.morphTargetDictionary || {};
          var keys = Object.keys(dict);
          // Skip meshes that don't actually expose any blendshapes (e.g.
          // beard/outfit on most RPM exports) — otherwise every setMorph
          // call pays for empty-dict lookups across them every frame.
          if (keys.length === 0) return;
          morphMeshes.push({ mesh: child, dict: dict, name: child.name });
          // One-time log so a real device run tells us exactly what
          // blendshapes the bundled GLB exposes per mesh.
          log('mesh ' + child.name + ' blendshapes(' + keys.length + '): '
              + keys.slice(0, 20).join(',') + (keys.length > 20 ? ',...' : ''));
        }
        if (child.isBone) {
          if (child.name === 'Head') headBone = child;
          if (child.name === 'Spine') spineBone = child;
        }
      });

      for (var vi = 0; vi < VISEMES.length; vi++) {
        if (hasMorph(VISEMES[vi])) visemesFound++;
      }
      log('Morph meshes: ' + morphMeshes.length + ', head: ' + !!headBone
          + ', spine: ' + !!spineBone + ', visemes found: ' + visemesFound
          + '/' + VISEMES.length);

      statusEl.style.display = 'none';
      sendReady();
      animate();
    }, function(err) {
      var msg = 'GLB parse error: ' + (err.message || err);
      log(msg);
      sendError(msg);
      statusEl.textContent = 'Parse error';
    });
  } catch(e) {
    var msg = 'GLB decode error: ' + (e.message || e);
    log(msg);
    sendError(msg);
    statusEl.textContent = 'Decode error';
  }

  function pickViseme() {
    // Vowels weighted higher than consonants — roughly matches the duty
    // cycle of English speech and keeps the mouth visibly open.
    var r = Math.random();
    if (r < 0.55) return VISEMES[Math.floor(Math.random() * 5)]; // aa/E/I/O/U
    if (r < 0.85) return VISEMES[5 + Math.floor(Math.random() * 3)]; // PP/FF/kk
    return VISEMES[8 + Math.floor(Math.random() * 2)]; // DD/nn
  }

  function pickGazeTarget(state) {
    // Eye-space normalized: x +right/-left, y +up/-down. Cap magnitude so
    // we never roll the eyes hard enough to expose sclera and look uncanny.
    if (state === 'listening') {
      // Hold gaze near center, occasional small drift.
      return { x: (Math.random() - 0.5) * 0.3, y: (Math.random() - 0.5) * 0.2 };
    }
    if (state === 'thinking' || state === 'analyzing') {
      // "Looking up" while thinking — classic recall gesture.
      return { x: (Math.random() - 0.5) * 0.8, y: 0.25 + Math.random() * 0.35 };
    }
    if (state === 'speaking') {
      // Broader range while talking, but center-biased.
      return { x: (Math.random() - 0.5) * 0.6, y: (Math.random() - 0.5) * 0.4 };
    }
    return { x: (Math.random() - 0.5) * 0.5, y: (Math.random() - 0.5) * 0.3 };
  }

  function animate() {
    requestAnimationFrame(animate);
    var t = (Date.now() - startTime) / 1000;
    var now = Date.now();

    // Smooth amplitude — drives viseme intensity, brow flicks, and mouth
    // fallback when the GLB doesn't expose viseme blendshapes. The
    // incoming amplitude is RMS-ish in roughly [0, 0.3] during normal
    // speech, so a x2 multiplier keeps amp from saturating at 1.0 the
    // moment she opens her mouth — we want it to actually modulate.
    smoothAmp = lerp(smoothAmp, amplitude, 0.35);
    var amp = clamp(smoothAmp * 2.0, 0, 1);

    // ------------ Mouth: visemes during speaking ------------
    if (aiState === 'speaking') {
      if (now >= nextVisemeAt) {
        currentViseme = pickViseme();
        // Conversational English syllables are ~200-300ms; faster swaps
        // start to look like a chittering mouth on sustained speech.
        // Loud → faster swaps, quiet → slower.
        var ampScale = 1 - amp * 0.4;
        nextVisemeAt = now + (140 + Math.random() * 100) * ampScale;
      }
    } else {
      currentViseme = ''; // no target — all visemes fade to 0
    }

    var targetIntensity = aiState === 'speaking' ? (0.40 + amp * 0.55) : 0;
    for (var v = 0; v < VISEMES.length; v++) {
      var name = VISEMES[v];
      var target = (name === currentViseme) ? targetIntensity : 0;
      // Active viseme rises fast, others fade smoothly — crossfade
      var rate = (name === currentViseme) ? 0.55 : 0.3;
      visemeWeights[name] = lerp(visemeWeights[name], target, rate);
      setMorph(name, visemeWeights[name]);
    }

    // Fallback: if this GLB happens to lack viseme blendshapes, drive
    // mouthOpen the old way so we still see lip motion.
    if (!hasMorph('viseme_aa')) {
      var targetMouthOpen = aiState === 'speaking'
        ? Math.min(1.0, amplitude * 4.0 * (0.85 + Math.random() * 0.3))
        : 0;
      if (aiState === 'speaking' && targetMouthOpen < 0.15) targetMouthOpen = 0.15;
      smoothMouthOpen = lerp(smoothMouthOpen, targetMouthOpen, 0.45);
      setMorph('mouthOpen', smoothMouthOpen);
    }

    // ------------ Smile: dynamic per state + amplitude ------------
    var smileBase;
    switch (aiState) {
      case 'idle': smileBase = 0.40 + Math.sin(t * 0.5) * 0.08; break;
      case 'listening': smileBase = 0.50; break;
      case 'thinking': smileBase = 0.15; break;
      case 'analyzing': smileBase = 0.15; break;
      case 'speaking': smileBase = 0.30 + amp * 0.20; break;
      default: smileBase = 0.30;
    }
    // Attenuate smile while a viseme is actively driving the mouth open —
    // a wide smile + an "aa"/"O" viseme stacks into a stretched/distorted
    // shape. The active viseme weight smoothly fades, so the smile rides
    // back up naturally between viseme swaps.
    var activeVisemeWeight = currentViseme ? (visemeWeights[currentViseme] || 0) : 0;
    smileBase *= (1 - activeVisemeWeight * 0.5);
    smoothSmile = lerp(smoothSmile, smileBase, 0.08);
    setMorph('mouthSmile', smoothSmile);
    // Split-smile blendshapes are common on RPM exports — drive them too
    // when present so the smile isn't visibly skewed-symmetric.
    setMorph('mouthSmileLeft', smoothSmile * 0.95);
    setMorph('mouthSmileRight', smoothSmile);

    // ------------ Blink ------------
    if (blinkPhase === 0 && now >= nextBlinkAt) {
      blinkPhase = 1;
      blinkPhaseStart = now;
    }
    if (blinkPhase === 1) {
      var dt = now - blinkPhaseStart;
      blinkValue = clamp(dt / 80, 0, 1);
      if (dt >= 80) { blinkPhase = 2; blinkPhaseStart = now; }
    } else if (blinkPhase === 2) {
      var dt2 = now - blinkPhaseStart;
      blinkValue = clamp(1 - dt2 / 100, 0, 1);
      if (dt2 >= 100) {
        blinkPhase = 0;
        blinkValue = 0;
        // 8% chance of a double-blink — feels less metronomic.
        var nextDelay = (Math.random() < 0.08) ? 120 : (2000 + Math.random() * 4000);
        nextBlinkAt = now + nextDelay;
      }
    }
    setMorph('eyeBlinkLeft', blinkValue);
    setMorph('eyeBlinkRight', blinkValue);

    // ------------ Eye gaze ------------
    if (now >= nextGazeAt) {
      var tgt = pickGazeTarget(aiState);
      gazeTargetX = tgt.x;
      gazeTargetY = tgt.y;
      nextGazeAt = now + 1500 + Math.random() * 2000;
    }
    gazeX = lerp(gazeX, gazeTargetX, 0.08);
    gazeY = lerp(gazeY, gazeTargetY, 0.08);

    // Suppress gaze offset during blink-closed so eyes look "still" mid-blink.
    var gazeGate = 1 - blinkValue;
    var gx = gazeX * gazeGate;
    var gy = gazeY * gazeGate;
    // ARKit convention: eyeLookIn for the eye on the nose side of the gaze
    // direction, eyeLookOut for the other. So gazeX > 0 (right) means right
    // eye looks in (nasally) and left eye looks out.
    var lookRight = Math.max(0, gx);
    var lookLeft = Math.max(0, -gx);
    var lookUp = Math.max(0, gy);
    var lookDown = Math.max(0, -gy);
    setMorph('eyeLookOutLeft', lookLeft);
    setMorph('eyeLookInLeft', lookRight);
    setMorph('eyeLookOutRight', lookRight);
    setMorph('eyeLookInRight', lookLeft);
    setMorph('eyeLookUpLeft', lookUp);
    setMorph('eyeLookUpRight', lookUp);
    setMorph('eyeLookDownLeft', lookDown);
    setMorph('eyeLookDownRight', lookDown);

    // ------------ Brows ------------
    var browInner = 0, browDownL = 0, browDownR = 0, browOuter = 0;
    if (aiState === 'thinking' || aiState === 'analyzing') {
      // Light inner-brow lift — concentrated / curious.
      browInner = 0.35 + Math.sin(t * 0.6) * 0.08;
    } else if (aiState === 'listening') {
      browOuter = 0.15; // attentive, eyebrows softly up
    } else if (aiState === 'speaking') {
      // Emphasis frown on amplitude peaks. Subtle — capped low so it
      // doesn't read as anger.
      var emphasis = amp > 0.55 ? (amp - 0.55) * 0.6 : 0;
      browDownL = emphasis;
      browDownR = emphasis;
    }
    setMorph('browInnerUp', browInner);
    setMorph('browDownLeft', browDownL);
    setMorph('browDownRight', browDownR);
    setMorph('browOuterUpLeft', browOuter);
    setMorph('browOuterUpRight', browOuter);

    // ------------ Head bone ------------
    if (headBone) {
      if (!headOrigQuat) headOrigQuat = headBone.quaternion.clone();

      var driftScale = (aiState === 'thinking' || aiState === 'analyzing') ? 0.5 : 1.0;
      var yawDeg = (Math.sin(t * 0.3) * 3 + Math.sin(t * 0.7) * 1.5) * driftScale;
      var pitchDeg = (Math.sin(t * 0.5 + 1) * 2 + Math.sin(t * 1.1) * 1) * driftScale;
      var rollDeg = Math.sin(t * 0.2 + 2) * 1.5 * driftScale;

      // State-specific bias: listening looks slightly up at "you", thinking
      // tilts down/away.
      if (aiState === 'listening') {
        pitchDeg -= 1.5; // chin up a touch
        yawDeg *= 0.5; // hold steadier — looking at the user
      }
      if (aiState === 'thinking' || aiState === 'analyzing') {
        pitchDeg += 3;
      }
      if (aiState === 'speaking') {
        yawDeg += amplitude * 2;
        pitchDeg += amplitude * 1.5;
      }
      if (aiState === 'listening') {
        if (nodPhase === 0 && now - lastNodTime > 2000 + Math.random() * 2000) {
          nodPhase = 1;
          lastNodTime = now;
        }
        if (nodPhase > 0) {
          var elapsed = now - lastNodTime;
          if (elapsed < 200) pitchDeg += (elapsed / 200) * 4;
          else if (elapsed < 600) pitchDeg += 4 * (1 - (elapsed - 200) / 400);
          else nodPhase = 0;
        }
      }

      var euler = new THREE.Euler(pitchDeg * DEG, yawDeg * DEG, rollDeg * DEG, 'YXZ');
      var q = new THREE.Quaternion().setFromEuler(euler);
      headBone.quaternion.copy(headOrigQuat).multiply(q);
    }

    if (spineBone) {
      if (!spineOrigQuat) spineOrigQuat = spineBone.quaternion.clone();
      var breathQ = new THREE.Quaternion().setFromAxisAngle(
        new THREE.Vector3(1, 0, 0),
        Math.sin(t * 0.8) * 0.5 * DEG
      );
      spineBone.quaternion.copy(spineOrigQuat).multiply(breathQ);
    }

    renderer.render(scene, camera);
  }

  window.addEventListener('resize', function() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });
})();
</script>
</body>
</html>`;
}
